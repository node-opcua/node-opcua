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
 *
 * In a shared store, a value kept as an object is kept as its binary encoding in a shared heap
 * instead, for the readers of the other threads (see SharedHeap), and decoded when the owner reads
 * it. A structure stays an object, since a reader may not know its type: the owner answers it.
 */
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { DataType, decodeVariant, encodeVariant, Variant, VariantArrayType, type VariantOptions } from "node-opcua-variant";
import { bufferOf, type Column, ColumnSpace, type ColumnType } from "./columns.js";
import { SharedHeap, type SharedHeapBuffers } from "./shared_heap.js";

/**
 * the largest encoding kept in the shared heap: a larger value (a large array) stays an object with the
 * owner, which hands its buffer over to the reader that asks, rather than copy it into the heap on every
 * write, out of it on every read, and again at every compaction
 */
const MAX_SHARED_ENCODING = 64 * 1024;

/**
 * the binary encoding of a value for the readers of other threads; null for what they cannot use, or too
 * large. A structure goes too: the other threads pass its bytes on without decoding them, whatever its type.
 */
function encodedForReaders(value: unknown, dataType: DataType): Uint8Array | null {
    if (dataType === DataType.Variant || dataType === DataType.DiagnosticInfo) {
        return null;
    }
    try {
        const variant = variantOf(value);
        const size = new BinaryStreamSizeCalculator();
        encodeVariant(variant, size);
        if (size.length > MAX_SHARED_ENCODING) return null;
        if (scratch.length < size.length) scratch = Buffer.alloc(Math.max(size.length, scratch.length * 2));
        encodeVariant(variant, new BinaryStream(scratch));
        // the bytes are copied into the heap before the next encoding reuses the scratch buffer
        return scratch.subarray(0, size.length);
    } catch {
        return null;
    }
}

let scratch = Buffer.alloc(4096);

/**
 * the Variant to encode: a scalar written by the views (a number DataType, checked when the value
 * was written) is set field by field, without the checks of the constructor; anything else, from the
 * loader for instance (a DataType given by name, a plain array), goes through the constructor
 */
function variantOf(value: unknown): Variant {
    if (value instanceof Variant) return value;
    const o = value as VariantOptions;
    if (typeof o.dataType === "number" && (o.arrayType === undefined || o.arrayType === VariantArrayType.Scalar)) {
        const variant = new Variant(null);
        variant.dataType = o.dataType;
        variant.arrayType = VariantArrayType.Scalar;
        variant.value = o.value;
        return variant;
    }
    return new Variant(o);
}

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

/** StatusCodes.BadResourceUnavailable: a value a thread left half written */
const BAD_RESOURCE_UNAVAILABLE = 0x80040000;

/**
 * how long a writer waits for a value another thread holds before taking it over: a write holds a value
 * for well under a microsecond, so a claim held this long belongs to a thread that ended in the middle of it
 */
export const CLAIM_PATIENCE_MS = 500;

/**
 * claim value `i` of a shared version column for a write: from an even version to the next odd one,
 * waiting while another thread holds it. A claim still held after `patience` ms is taken over (the
 * version moves by two, so that the release of the former holder fails). Returns the version claimed (odd).
 */
export function claimValue(version: Uint32Array, i: number, patience = CLAIM_PATIENCE_MS): number {
    let held = -1;
    let since = 0;
    let spins = 0;
    for (;;) {
        const current = Atomics.load(version, i);
        if ((current & 1) === 0) {
            if (Atomics.compareExchange(version, i, current, current + 1) === current) return current + 1;
            continue;
        }
        if (current !== held) {
            // another holder, or the same one again: its own patience
            held = current;
            since = Date.now();
            spins = 0;
        } else if ((++spins & 1023) === 0 && Date.now() - since > patience) {
            if (Atomics.compareExchange(version, i, current, current + 2) === current) return current + 2;
        }
    }
}

/** release the claim `claimed` of value `i`; false when it was taken over meanwhile: what was written is not the value */
export function releaseClaim(version: Uint32Array, i: number, claimed: number): boolean {
    return Atomics.compareExchange(version, i, claimed, claimed + 1) === claimed;
}

/** the columns a number or a boolean is written into, by the owner and by a thread writing in place */
export interface ScalarColumns {
    kind: Uint8Array;
    dataType: Uint8Array;
    number: Float64Array;
    statusCode: Uint32Array;
    sourceTimestamp: Float64Array;
    sourcePicoseconds: Uint16Array;
    serverTimestamp: Float64Array;
    serverPicoseconds: Uint16Array;
}

/** the fields of a number or a boolean, written under the claim of value `i` */
export function writeScalarFields(
    c: ScalarColumns,
    i: number,
    dataType: number,
    value: number | boolean,
    statusCode: number,
    sourceTimestamp: number,
    serverTimestamp: number,
    sourcePicoseconds: number,
    serverPicoseconds: number
): void {
    c.kind[i] = typeof value === "boolean" ? ValueKind.Boolean : ValueKind.Number;
    c.dataType[i] = dataType;
    c.number[i] = typeof value === "boolean" ? (value ? 1 : 0) : value;
    c.statusCode[i] = statusCode;
    c.sourceTimestamp[i] = sourceTimestamp;
    c.sourcePicoseconds[i] = sourcePicoseconds;
    c.serverTimestamp[i] = serverTimestamp;
    c.serverPicoseconds[i] = serverPicoseconds;
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
    // the scalar columns above, as writeScalarFields takes them
    #scalar!: ScalarColumns;
    readonly #objects = new Map<number, unknown>();
    readonly #space: ColumnSpace;
    // the objects as bytes, for the readers of other threads: a shared store only
    readonly #heap: SharedHeap | null;

    constructor(expectedNodes = 1024, space = new ColumnSpace()) {
        this.#space = space;
        const n = Math.max(16, expectedNodes);
        this.#kind = space.allocate(Uint8Array, n);
        this.#dataType = space.allocate(Uint8Array, n);
        this.#number = space.allocate(Float64Array, n);
        this.#statusCode = space.allocate(Uint32Array, n);
        this.#sourceTimestamp = space.allocate(Float64Array, n);
        this.#serverTimestamp = space.allocate(Float64Array, n);
        this.#sourcePicoseconds = space.allocate(Uint16Array, n);
        this.#serverPicoseconds = space.allocate(Uint16Array, n);
        this.#version = space.allocate(Uint32Array, n);
        this.#heap = space.shared ? new SharedHeap(space, n) : null;
        this.#gatherScalarColumns();
    }

    #gatherScalarColumns(): void {
        this.#scalar = {
            kind: this.#kind,
            dataType: this.#dataType,
            number: this.#number,
            statusCode: this.#statusCode,
            sourceTimestamp: this.#sourceTimestamp,
            sourcePicoseconds: this.#sourcePicoseconds,
            serverTimestamp: this.#serverTimestamp,
            serverPicoseconds: this.#serverPicoseconds
        };
    }

    /** the columns a reader in another thread reads values from (see SharedStoreReader) */
    public exportShared(): SharedValueBuffers {
        return {
            kind: bufferOf(this.#kind),
            dataType: bufferOf(this.#dataType),
            number: bufferOf(this.#number),
            statusCode: bufferOf(this.#statusCode),
            sourceTimestamp: bufferOf(this.#sourceTimestamp),
            serverTimestamp: bufferOf(this.#serverTimestamp),
            sourcePicoseconds: bufferOf(this.#sourcePicoseconds),
            serverPicoseconds: bufferOf(this.#serverPicoseconds),
            version: bufferOf(this.#version),
            heap: (this.#heap as SharedHeap).exportShared()
        };
    }

    /** the bytes a reader of another thread decodes the object of node `i` from; 0: it asks the owner */
    public encodedLength(i: number): number {
        return this.#heap ? this.#heap.length(i) : 0;
    }

    /** the bytes of the shared heap in use (garbage included); 0 in a store of one thread */
    public get heapSize(): number {
        return this.#heap ? this.#heap.used : 0;
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
        writeScalarFields(
            this.#scalar,
            i,
            dataType,
            value,
            statusCode,
            sourceTimestamp,
            serverTimestamp,
            sourcePicoseconds,
            serverPicoseconds
        );
        this.#objects.delete(i);
        this.#heap?.clear(i);
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
        // encoded before the write begins: the seqlock is held for the copy only
        const encoded = this.#heap ? encodedForReaders(value, dataType) : null;
        this.#begin(i);
        this.#kind[i] = ValueKind.Object;
        this.#dataType[i] = dataType;
        this.#number[i] = 0;
        this.#statusCode[i] = statusCode;
        this.#sourceTimestamp[i] = sourceTimestamp;
        this.#sourcePicoseconds[i] = sourcePicoseconds;
        this.#serverTimestamp[i] = serverTimestamp;
        this.#serverPicoseconds[i] = serverPicoseconds;
        if (encoded && this.#heap) {
            this.#heap.write(i, encoded);
            if (dataType === DataType.ExtensionObject) {
                // the owner keeps the structure too: its type may be one only the address space can decode
                this.#objects.set(i, value);
            } else {
                // the bytes are the only copy: the owner decodes them when it reads the value
                this.#objects.delete(i);
            }
        } else {
            this.#objects.set(i, value);
            this.#heap?.clear(i);
        }
        this.#end(i);
    }

    /** a status without a value (BadWaitingForInitialData and the like) */
    public setStatus(i: number, statusCode: number, serverTimestamp: number): void {
        this.#begin(i);
        this.#kind[i] = ValueKind.None;
        this.#statusCode[i] = statusCode;
        this.#serverTimestamp[i] = serverTimestamp;
        this.#objects.delete(i);
        this.#heap?.clear(i);
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
        this.#heap?.release(i);
        this.#end(i);
    }

    /**
     * the whole value of a node, as plain fields. `withObject` false: without the object of a
     * non-scalar value, which a shared store would decode, for a caller that has it already
     */
    public get(i: number, withObject = true): StoredValue {
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
                value = withObject ? (this.#objects.get(i) ?? this.#decoded(i)) : undefined;
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

    /** a copy of the encoding of value `i` in the shared heap; null when it has none */
    public encodedCopy(i: number): Uint8Array | null {
        return this.#heap && this.#heap.length(i) > 0 ? this.#heap.copy(i) : null;
    }

    /** a value kept as bytes only (a shared store): decoded from a copy, an array must not alias the heap */
    #decoded(i: number): Variant | undefined {
        if (!this.#heap || this.#heap.length(i) === 0) return undefined;
        return decodeVariant(new BinaryStream(Buffer.from(this.#heap.copy(i))));
    }

    /** how many values are kept as objects */
    public get objectCount(): number {
        return this.#objects.size;
    }

    // the version word is the seqlock of the value: odd while a write is in progress. In a
    // shared store the changes are atomic, so that a reader in another thread sees them
    // ordered with the field writes between them, and a write begins by claiming the slot
    // (see claimValue), so that writers in several threads never interleave their fields
    #begin(i: number): void {
        if (this.#space.shared) claimValue(this.#version, i);
        else this.#version[i] += 1;
    }
    #end(i: number): void {
        if (this.#space.shared) Atomics.add(this.#version, i, 1);
        else this.#version[i] += 1;
    }

    /**
     * after a thread that wrote values in place has ended: a value it left claimed (odd) is released, and
     * marked BadResourceUnavailable until the next write, so that readers and writers do not wait for it
     * forever. A write holds a value for well under a microsecond: one held by the same claim for `patience`
     * ms is abandoned. Returns how many were released.
     */
    public releaseAbandoned(patience = 10): number {
        if (!this.#space.shared) return 0;
        return this.#settleWriters(patience);
    }

    #settleWriters(patience: number): number {
        const version = this.#version;
        let released = 0;
        for (let i = 0; i < version.length; i++) {
            let held = Atomics.load(version, i);
            // each claim has its own patience: one a live thread just took is waited for, never taken
            let deadline = Date.now() + patience;
            while ((held & 1) !== 0) {
                if (Date.now() > deadline && Atomics.compareExchange(version, i, held, held + 2) === held) {
                    this.#statusCode[i] = BAD_RESOURCE_UNAVAILABLE;
                    this.#end(i);
                    released++;
                    break;
                }
                const now = Atomics.load(version, i);
                if (now !== held) {
                    held = now;
                    deadline = Date.now() + patience;
                }
            }
        }
        return released;
    }

    #resize(n: number): void {
        const space = this.#space;
        if (space.shared) {
            // a writer in another thread checks the layout around its claim: once it moved, nothing more is
            // written into these columns, and the writes already under way end before they are copied
            Atomics.add(space.layout, 0, 1);
            this.#settleWriters(50);
        }
        const resized = <T extends Column>(col: T, length: number, Type: ColumnType<T>) => space.resized(col, length, Type);
        this.#kind = resized(this.#kind, n, Uint8Array);
        this.#dataType = resized(this.#dataType, n, Uint8Array);
        this.#number = resized(this.#number, n, Float64Array);
        this.#statusCode = resized(this.#statusCode, n, Uint32Array);
        this.#sourceTimestamp = resized(this.#sourceTimestamp, n, Float64Array);
        this.#serverTimestamp = resized(this.#serverTimestamp, n, Float64Array);
        this.#sourcePicoseconds = resized(this.#sourcePicoseconds, n, Uint16Array);
        this.#serverPicoseconds = resized(this.#serverPicoseconds, n, Uint16Array);
        this.#version = resized(this.#version, n, Uint32Array);
        this.#heap?.resize(n);
        this.#gatherScalarColumns();
    }
}

/** what a reader in another thread needs of the values */
export interface SharedValueBuffers {
    kind: SharedArrayBuffer;
    dataType: SharedArrayBuffer;
    number: SharedArrayBuffer;
    statusCode: SharedArrayBuffer;
    sourceTimestamp: SharedArrayBuffer;
    serverTimestamp: SharedArrayBuffer;
    sourcePicoseconds: SharedArrayBuffer;
    serverPicoseconds: SharedArrayBuffer;
    version: SharedArrayBuffer;
    heap: SharedHeapBuffers;
}
