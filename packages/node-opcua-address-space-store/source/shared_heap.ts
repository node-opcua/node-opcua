/**
 * @module node-opcua-address-space-store
 *
 * The values a reader in another thread cannot find in the typed columns (strings, arrays, and
 * the other non-scalar values) as bytes in one shared buffer: each node has a slot of its own,
 * at an offset, of a capacity, holding a length of bytes (the value's binary encoding).
 *
 * A node's slot is written under the node's claim (see ValueStore), by the owner or by a thread
 * writing a value in place (see SharedStoreReader.writeBytes): a value that fits its slot is
 * written in place, a larger one takes a new slot at the top, taken by compare-exchange so that
 * writers in several threads never take the same bytes, the old one left as garbage. When the
 * buffer is full the owner copies the live slots into new buffers, the per-node columns too, and
 * the layout moves: a reader still holding the old buffers reads a consistent old state until it
 * takes the new ones, and a writer of another thread leaves the value to the owner.
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

/** the heap's counters, shared: the first free byte, and the bytes of the slots left behind */
const TOP = 0;
const GARBAGE = 1;

/** the capacity of a new slot for `length` bytes */
export function slotFor(length: number): number {
    // some room to grow in place: a string that gets a little longer keeps its slot
    const wanted = Math.max(ALIGN, length + (length >> 3));
    return (wanted + ALIGN - 1) & ~(ALIGN - 1);
}

/** `capacity` bytes taken at the top of `bytes`, by compare-exchange: their offset, or -1 when they do not fit */
export function takeSlot(state: Int32Array, bytes: Uint8Array, capacity: number): number {
    for (;;) {
        const top = Atomics.load(state, TOP);
        if (top + capacity > bytes.length) return -1;
        if (Atomics.compareExchange(state, TOP, top, top + capacity) === top) return top;
    }
}

/** the slot of `capacity` bytes a node left for a new one is garbage, for the next compaction */
export function leaveSlot(state: Int32Array, capacity: number): void {
    if (capacity > 0) Atomics.add(state, GARBAGE, capacity);
}

export class SharedHeap {
    readonly #space: ColumnSpace;
    #bytes: Uint8Array;
    #offset: Int32Array;
    #length: Int32Array;
    #capacity: Int32Array;
    readonly #state: Int32Array;
    /**
     * called before a compaction, with the node the owner is writing: the writers of other threads
     * are to be done with the current buffers (see ValueStore)
     */
    public beforeCompact: ((writing: number) => void) | null = null;

    constructor(space: ColumnSpace, nodes: number) {
        this.#space = space;
        this.#bytes = space.allocate(Uint8Array, MIN_HEAP);
        this.#offset = space.allocate(Int32Array, nodes);
        this.#length = space.allocate(Int32Array, nodes);
        this.#capacity = space.allocate(Int32Array, nodes);
        this.#state = space.allocate(Int32Array, 2);
    }

    /** the bytes of node `i`, written by the owner under the node's claim */
    public write(i: number, bytes: Uint8Array): void {
        const length = bytes.length;
        if (length > this.#capacity[i]) {
            const capacity = slotFor(length);
            leaveSlot(this.#state, this.#capacity[i]);
            this.#capacity[i] = 0; // check-proto-pollution: ok - typed array, node index
            let offset = takeSlot(this.#state, this.#bytes, capacity);
            if (offset < 0) {
                this.#compact(capacity, i);
                offset = takeSlot(this.#state, this.#bytes, capacity);
            }
            this.#offset[i] = offset; // check-proto-pollution: ok - typed array, node index
            this.#capacity[i] = capacity; // check-proto-pollution: ok - typed array, node index
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
        leaveSlot(this.#state, this.#capacity[i]);
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
        return Atomics.load(this.#state, TOP);
    }

    /** the bytes of the slots left behind, until the next compaction */
    public get garbage(): number {
        return Atomics.load(this.#state, GARBAGE);
    }

    public exportShared(): SharedHeapBuffers {
        return {
            bytes: bufferOf(this.#bytes),
            offset: bufferOf(this.#offset),
            length: bufferOf(this.#length),
            capacity: bufferOf(this.#capacity),
            state: bufferOf(this.#state)
        };
    }

    /** the live slots into new buffers, with room for `need` more bytes; the layout moves */
    #compact(need: number, writing: number): void {
        this.beforeCompact?.(writing);
        const space = this.#space;
        const nodes = this.#offset.length;
        const live = Atomics.load(this.#state, TOP) - Atomics.load(this.#state, GARBAGE);
        const wanted = Math.ceil((live + need) * (1 + RESERVE));
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
        Atomics.store(this.#state, TOP, top);
        Atomics.store(this.#state, GARBAGE, 0);
        space.relayout();
    }
}

/** what a reader in another thread needs of the heap */
export interface SharedHeapBuffers {
    bytes: SharedArrayBuffer;
    offset: SharedArrayBuffer;
    length: SharedArrayBuffer;
    /** the bytes of each node's slot: what a value written in place may take without a new slot */
    capacity: SharedArrayBuffer;
    /** the first free byte and the garbage (see takeSlot, leaveSlot) */
    state: SharedArrayBuffer;
}
