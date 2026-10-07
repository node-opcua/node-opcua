/**
 * @module node-opcua-address-space-store
 *
 * The values a reader in another thread cannot find in the typed columns (strings, arrays, and
 * the other non-scalar values) as bytes in one shared buffer: each node has a slot of its own,
 * at an offset, of a capacity, holding a length of bytes (the value's binary encoding).
 *
 * The owner is the only writer, under the node's seqlock (see ValueStore): a value that fits
 * its slot is written in place, a larger one takes a new slot at the top, the old one left as
 * garbage. When the buffer is full the live slots are copied into new buffers, the per-node
 * columns too, and the layout moves: a reader still holding the old buffers reads a consistent
 * old state until it takes the new ones.
 *
 * The new buffer holds the live bytes and a quarter more, in steps of 64 KB: the room the next
 * moved slots and new values take before the next compaction, which copies the live bytes once
 * more. A larger reserve would compact less often, at the cost of memory that stays empty.
 */
import { bufferOf, type ColumnSpace } from "./columns.js";

const MIN_HEAP = 4096;
const ALIGN = 8;
const STEP = 65536;
// the room a compaction leaves, as a fraction of the live bytes
const RESERVE = 0.25;

function slotFor(length: number): number {
    // some room to grow in place: a string that gets a little longer keeps its slot
    const wanted = Math.max(ALIGN, length + (length >> 3));
    return (wanted + ALIGN - 1) & ~(ALIGN - 1);
}

export class SharedHeap {
    readonly #space: ColumnSpace;
    #bytes: Uint8Array;
    #offset: Int32Array;
    #length: Int32Array;
    #capacity: Int32Array;
    #top = 0;
    #garbage = 0;

    constructor(space: ColumnSpace, nodes: number) {
        this.#space = space;
        this.#bytes = space.allocate(Uint8Array, MIN_HEAP);
        this.#offset = space.allocate(Int32Array, nodes);
        this.#length = space.allocate(Int32Array, nodes);
        this.#capacity = space.allocate(Int32Array, nodes);
    }

    /** the bytes of node `i`, written by the owner under the node's seqlock */
    public write(i: number, bytes: Uint8Array): void {
        const length = bytes.length;
        if (length > this.#capacity[i]) {
            const capacity = slotFor(length);
            this.#garbage += this.#capacity[i];
            this.#capacity[i] = 0; // check-proto-pollution: ok - typed array, node index
            if (this.#top + capacity > this.#bytes.length) {
                this.#compact(capacity);
            }
            this.#offset[i] = this.#top; // check-proto-pollution: ok - typed array, node index
            this.#capacity[i] = capacity; // check-proto-pollution: ok - typed array, node index
            this.#top += capacity;
        }
        this.#bytes.set(bytes, this.#offset[i]);
        this.#length[i] = length; // check-proto-pollution: ok - typed array, node index
    }

    /** node `i` has no bytes (its slot is kept, for the next value) */
    public clear(i: number): void {
        this.#length[i] = 0; // check-proto-pollution: ok - typed array, node index
    }

    /** node `i` is gone: its slot is garbage */
    public release(i: number): void {
        this.#garbage += this.#capacity[i];
        this.#capacity[i] = 0; // check-proto-pollution: ok - typed array, node index
        this.#length[i] = 0; // check-proto-pollution: ok - typed array, node index
    }

    public length(i: number): number {
        return this.#length[i];
    }

    /** a copy of the bytes of node `i`, for the owner: what it decodes the value from */
    public copy(i: number): Uint8Array {
        const offset = this.#offset[i];
        return this.#bytes.slice(offset, offset + this.#length[i]);
    }

    /** room for node indexes below `nodes` */
    public resize(nodes: number): void {
        const space = this.#space;
        this.#offset = space.resized(this.#offset, nodes, Int32Array);
        this.#length = space.resized(this.#length, nodes, Int32Array);
        this.#capacity = space.resized(this.#capacity, nodes, Int32Array);
    }

    /** the bytes in use, garbage included */
    public get used(): number {
        return this.#top;
    }

    public exportShared(): SharedHeapBuffers {
        return {
            bytes: bufferOf(this.#bytes),
            offset: bufferOf(this.#offset),
            length: bufferOf(this.#length)
        };
    }

    /** the live slots into new buffers, with room for `need` more bytes; the layout moves */
    #compact(need: number): void {
        const space = this.#space;
        const nodes = this.#offset.length;
        const wanted = Math.ceil((this.#top - this.#garbage + need) * (1 + RESERVE));
        const size = Math.max(MIN_HEAP, Math.ceil(wanted / STEP) * STEP);
        const bytes = space.allocate(Uint8Array, size);
        const offset = space.allocate(Int32Array, nodes);
        const length = space.allocate(Int32Array, nodes);
        const capacity = space.allocate(Int32Array, nodes);
        let top = 0;
        for (let i = 0; i < nodes; i++) {
            const used = this.#capacity[i];
            if (used === 0) continue;
            const n = this.#length[i];
            const slot = slotFor(n);
            bytes.set(this.#bytes.subarray(this.#offset[i], this.#offset[i] + n), top);
            offset[i] = top; // check-proto-pollution: ok - typed array, node index
            length[i] = n; // check-proto-pollution: ok - typed array, node index
            capacity[i] = slot; // check-proto-pollution: ok - typed array, node index
            top += slot;
        }
        this.#bytes = bytes;
        this.#offset = offset;
        this.#length = length;
        this.#capacity = capacity;
        this.#top = top;
        this.#garbage = 0;
        space.relayout();
    }
}

/** what a reader in another thread needs of the heap */
export interface SharedHeapBuffers {
    bytes: SharedArrayBuffer;
    offset: SharedArrayBuffer;
    length: SharedArrayBuffer;
}
