/**
 * @module node-opcua-address-space-store
 *
 * The values of the Variables: a scalar number or boolean lives in typed columns with its
 * status code and timestamps; anything else (strings, arrays, structures, NodeIds...) is kept
 * as an object in a side table, present only for the Variables that have one.
 *
 * Every write bumps the node's version word, so a reader can tell that a value changed
 * without comparing it, and, once the columns are shared between threads, read the fields of
 * a value consistently (odd version: a write is in progress, read again).
 */
import type { DataType } from "node-opcua-variant";

/** what the columns hold for a node */
export enum ValueKind {
    /** no value stored (not a Variable, or never set) */
    None = 0,
    /** a number in the double column, with the DataType it carries */
    Number = 1,
    Boolean = 2,
    /** an object in the side table: a string, an array, a structure, anything non-scalar */
    Object = 3
}

export interface StoredValue {
    kind: ValueKind;
    dataType: DataType;
    /** the number, the boolean as 0 or 1, or the object */
    value: unknown;
    statusCode: number;
    sourceTimestamp: number;
    sourcePicoseconds: number;
    serverTimestamp: number;
    serverPicoseconds: number;
}

function resized<T extends Uint8Array | Uint16Array | Uint32Array | Float64Array>(
    col: T,
    n: number,
    Type: new (n: number) => T
): T {
    const next = new Type(n);
    next.set((col.length > n ? col.subarray(0, n) : col) as unknown as ArrayLike<number>);
    return next;
}

export class ValueStore {
    #kind: Uint8Array;
    #dataType: Uint8Array;
    #number: Float64Array;
    #statusCode: Uint32Array;
    #sourceTimestamp: Float64Array; // milliseconds since the epoch
    #serverTimestamp: Float64Array;
    #sourcePicoseconds: Uint16Array; // picoseconds / 100000, the resolution a Date cannot hold
    #serverPicoseconds: Uint16Array;
    #version: Uint32Array;
    readonly #objects = new Map<number, unknown>();

    constructor(expectedNodes = 1024) {
        const n = Math.max(16, expectedNodes);
        this.#kind = new Uint8Array(n);
        this.#dataType = new Uint8Array(n);
        this.#number = new Float64Array(n);
        this.#statusCode = new Uint32Array(n);
        this.#sourceTimestamp = new Float64Array(n);
        this.#serverTimestamp = new Float64Array(n);
        this.#sourcePicoseconds = new Uint16Array(n);
        this.#serverPicoseconds = new Uint16Array(n);
        this.#version = new Uint32Array(n);
    }

    public get capacity(): number {
        return this.#kind.length;
    }

    /** make room for node indexes below `count` */
    public ensure(count: number): void {
        if (count <= this.#kind.length) return;
        let n = this.#kind.length * 2;
        while (n < count) n *= 2;
        this.#resize(n);
    }

    public compact(count: number): void {
        if (count < this.#kind.length) this.#resize(count);
    }

    public kind(i: number): ValueKind {
        return this.#kind[i] as ValueKind;
    }
    public version(i: number): number {
        return this.#version[i];
    }
    public statusCode(i: number): number {
        return this.#statusCode[i];
    }
    public dataType(i: number): DataType {
        return this.#dataType[i] as DataType;
    }
    public number(i: number): number {
        return this.#number[i];
    }
    public sourceTimestamp(i: number): number {
        return this.#sourceTimestamp[i];
    }
    public serverTimestamp(i: number): number {
        return this.#serverTimestamp[i];
    }

    /** a number or a boolean: the common case, written without touching the side table */
    public setScalar(
        i: number,
        dataType: DataType,
        value: number | boolean,
        statusCode: number,
        sourceTimestamp: number,
        serverTimestamp: number,
        sourcePicoseconds = 0,
        serverPicoseconds = 0
    ): void {
        this.#begin(i);
        this.#kind[i] = typeof value === "boolean" ? ValueKind.Boolean : ValueKind.Number;
        this.#dataType[i] = dataType;
        this.#number[i] = typeof value === "boolean" ? (value ? 1 : 0) : value;
        this.#statusCode[i] = statusCode;
        this.#sourceTimestamp[i] = sourceTimestamp;
        this.#sourcePicoseconds[i] = sourcePicoseconds;
        this.#serverTimestamp[i] = serverTimestamp;
        this.#serverPicoseconds[i] = serverPicoseconds;
        this.#objects.delete(i);
        this.#end(i);
    }

    /** anything that is not a scalar number or boolean */
    public setObject(
        i: number,
        dataType: DataType,
        value: unknown,
        statusCode: number,
        sourceTimestamp: number,
        serverTimestamp: number,
        sourcePicoseconds = 0,
        serverPicoseconds = 0
    ): void {
        this.#begin(i);
        this.#kind[i] = ValueKind.Object;
        this.#dataType[i] = dataType;
        this.#number[i] = 0;
        this.#statusCode[i] = statusCode;
        this.#sourceTimestamp[i] = sourceTimestamp;
        this.#sourcePicoseconds[i] = sourcePicoseconds;
        this.#serverTimestamp[i] = serverTimestamp;
        this.#serverPicoseconds[i] = serverPicoseconds;
        this.#objects.set(i, value);
        this.#end(i);
    }

    /** a status without a value (BadWaitingForInitialData and the like) */
    public setStatus(i: number, statusCode: number, serverTimestamp: number): void {
        this.#begin(i);
        this.#kind[i] = ValueKind.None;
        this.#statusCode[i] = statusCode;
        this.#serverTimestamp[i] = serverTimestamp;
        this.#objects.delete(i);
        this.#end(i);
    }

    /** only the timestamps move (a value re-read from its source that did not change) */
    /** the server timestamp alone: the value was re-verified, not re-obtained */
    public setServerTimestamp(i: number, serverTimestamp: number, serverPicoseconds = 0): void {
        this.#begin(i);
        this.#serverTimestamp[i] = serverTimestamp; // check-proto-pollution: ok - typed array, node index
        this.#serverPicoseconds[i] = serverPicoseconds; // check-proto-pollution: ok - typed array, node index
        this.#end(i);
    }

    public touch(i: number, sourceTimestamp: number, serverTimestamp: number, sourcePicoseconds = 0, serverPicoseconds = 0): void {
        this.#begin(i);
        this.#sourceTimestamp[i] = sourceTimestamp;
        this.#sourcePicoseconds[i] = sourcePicoseconds;
        this.#serverTimestamp[i] = serverTimestamp;
        this.#serverPicoseconds[i] = serverPicoseconds;
        this.#end(i);
    }

    public clear(i: number): void {
        this.#begin(i);
        this.#kind[i] = ValueKind.None;
        this.#dataType[i] = 0;
        this.#number[i] = 0;
        this.#statusCode[i] = 0;
        this.#sourceTimestamp[i] = 0;
        this.#serverTimestamp[i] = 0;
        this.#sourcePicoseconds[i] = 0;
        this.#serverPicoseconds[i] = 0;
        this.#objects.delete(i);
        this.#end(i);
    }

    /** the whole value of a node, as plain fields */
    public get(i: number): StoredValue {
        const kind = this.#kind[i] as ValueKind;
        let value: unknown;
        switch (kind) {
            case ValueKind.Number:
                value = this.#number[i];
                break;
            case ValueKind.Boolean:
                value = this.#number[i] !== 0;
                break;
            case ValueKind.Object:
                value = this.#objects.get(i);
                break;
            default:
                value = undefined;
        }
        return {
            kind,
            dataType: this.#dataType[i] as DataType,
            value,
            statusCode: this.#statusCode[i],
            sourceTimestamp: this.#sourceTimestamp[i],
            sourcePicoseconds: this.#sourcePicoseconds[i],
            serverTimestamp: this.#serverTimestamp[i],
            serverPicoseconds: this.#serverPicoseconds[i]
        };
    }

    /** how many values are kept as objects */
    public get objectCount(): number {
        return this.#objects.size;
    }

    #begin(i: number): void {
        this.#version[i] += 1; // odd while the write is in progress
    }
    #end(i: number): void {
        this.#version[i] += 1;
    }

    #resize(n: number): void {
        this.#kind = resized(this.#kind, n, Uint8Array);
        this.#dataType = resized(this.#dataType, n, Uint8Array);
        this.#number = resized(this.#number, n, Float64Array);
        this.#statusCode = resized(this.#statusCode, n, Uint32Array);
        this.#sourceTimestamp = resized(this.#sourceTimestamp, n, Float64Array);
        this.#serverTimestamp = resized(this.#serverTimestamp, n, Float64Array);
        this.#sourcePicoseconds = resized(this.#sourcePicoseconds, n, Uint16Array);
        this.#serverPicoseconds = resized(this.#serverPicoseconds, n, Uint16Array);
        this.#version = resized(this.#version, n, Uint32Array);
    }
}
