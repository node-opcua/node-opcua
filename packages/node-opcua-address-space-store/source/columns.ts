/**
 * @module node-opcua-address-space-store
 *
 * Where the typed columns of a store live: in ordinary ArrayBuffers, or in SharedArrayBuffers
 * that other threads read without asking the thread that owns the store.
 *
 * A shared store has one writer, the thread that owns it. Readers in other threads hold the
 * same buffers; when a column is reallocated (grown, trimmed, rehashed) the owner gets new
 * buffers the readers do not have yet, and the layout counter moves so that they know to ask
 * for the new ones.
 */

export type Column = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

/** a typed array class, constructed from a length or over a buffer */
export interface ColumnType<T extends Column> {
    new (length: number): T;
    new (buffer: SharedArrayBuffer): T;
    readonly BYTES_PER_ELEMENT: number;
}

export class ColumnSpace {
    public readonly shared: boolean;
    /** moves each time a column is reallocated: a reader holding older buffers asks for the new ones */
    public readonly layout: Int32Array;

    constructor(shared = false) {
        this.shared = shared;
        this.layout = shared ? new Int32Array(new SharedArrayBuffer(4)) : new Int32Array(1);
    }

    /** a new column of `length` entries, zeroed */
    public allocate<T extends Column>(Type: ColumnType<T>, length: number): T {
        return this.shared ? new Type(new SharedArrayBuffer(length * Type.BYTES_PER_ELEMENT)) : new Type(length);
    }

    /** `col` copied into a new column of `length` entries, grown or trimmed; the layout moves */
    public resized<T extends Column>(col: T, length: number, Type: ColumnType<T>): T {
        const next = this.allocate(Type, length);
        next.set((col.length > length ? col.subarray(0, length) : col) as unknown as ArrayLike<number>);
        this.relayout();
        return next;
    }

    /** tell the readers that a column moved to a new buffer */
    public relayout(): void {
        Atomics.add(this.layout, 0, 1);
    }
}

/** the buffer behind a column, for a reader in another thread; only meaningful in a shared space */
export function bufferOf(column: Column): SharedArrayBuffer {
    const buffer = column.buffer;
    if (!(buffer instanceof SharedArrayBuffer)) {
        throw new Error("bufferOf: the column is not shared (create the store with shared: true)");
    }
    return buffer;
}
