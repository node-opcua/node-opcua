/**
 * @module node-opcua-address-space-store
 *
 * The references of the compact store: one row per reference end, (source, type ordinal,
 * direction, target), in typed columns. After `index()` the rows are ordered by source, so the
 * references of a node are one contiguous run; rows added later wait in a small overflow until
 * the next `index()`. A removed row is a tombstone until then.
 */

const DEAD = 0xffff; // type ordinal of a removed row

export class ReferenceTable {
    #count = 0;
    #source: Int32Array;
    #typeOrdinal: Uint16Array;
    #forward: Uint8Array;
    #target: Int32Array;
    // after index(): offsets[node] .. offsets[node + 1] in `order` are the node's rows
    #offsets: Int32Array | null = null;
    #order: Int32Array | null = null;
    #indexedRows = 0;
    #overflow = new Map<number, number[]>();

    constructor(expectedRows = 1024) {
        const n = Math.max(16, expectedRows);
        this.#source = new Int32Array(n);
        this.#typeOrdinal = new Uint16Array(n);
        this.#forward = new Uint8Array(n);
        this.#target = new Int32Array(n);
    }

    /** rows added, removed ones included */
    public get rowCount(): number {
        return this.#count;
    }

    public get overflowSize(): number {
        return this.#count - this.#indexedRows;
    }

    public source(row: number): number {
        return this.#source[row];
    }
    public typeOrdinal(row: number): number {
        return this.#typeOrdinal[row];
    }
    public isForward(row: number): boolean {
        return this.#forward[row] === 1;
    }
    public target(row: number): number {
        return this.#target[row];
    }
    public isLive(row: number): boolean {
        return this.#typeOrdinal[row] !== DEAD;
    }

    /** one end of a reference; the other end is a row of its own (see addBoth) */
    public add(source: number, typeOrdinal: number, forward: boolean, target: number): number {
        if (typeOrdinal >= DEAD) {
            throw new Error("ReferenceTable: reference type ordinal out of range");
        }
        if (this.#count === this.#source.length) {
            this.#grow(this.#count + 1);
        }
        const row = this.#count++;
        this.#source[row] = source;
        this.#typeOrdinal[row] = typeOrdinal;
        this.#forward[row] = forward ? 1 : 0;
        this.#target[row] = target;
        if (this.#offsets !== null) {
            const rows = this.#overflow.get(source);
            if (rows) {
                rows.push(row);
            } else {
                this.#overflow.set(source, [row]);
            }
        }
        return row;
    }

    /** both ends: the forward row on `source`, the inverse row on `target` */
    public addBoth(source: number, typeOrdinal: number, target: number): void {
        this.add(source, typeOrdinal, true, target);
        this.add(target, typeOrdinal, false, source);
    }

    public remove(row: number): void {
        this.#typeOrdinal[row] = DEAD;
    }

    /** the row of `source` that matches, or -1 */
    public find(source: number, typeOrdinal: number, forward: boolean, target: number): number {
        const f = forward ? 1 : 0;
        for (const row of this.rowsOf(source)) {
            if (this.#typeOrdinal[row] === typeOrdinal && this.#forward[row] === f && this.#target[row] === target) {
                return row;
            }
        }
        return -1;
    }

    /** the live rows of one node */
    public *rowsOf(node: number): IterableIterator<number> {
        if (this.#offsets !== null && node + 1 < this.#offsets.length) {
            const order = this.#order as Int32Array;
            const end = this.#offsets[node + 1];
            for (let k = this.#offsets[node]; k < end; k++) {
                const row = order[k];
                if (this.#typeOrdinal[row] !== DEAD) yield row;
            }
            const extra = this.#overflow.get(node);
            if (extra) {
                for (const row of extra) if (this.#typeOrdinal[row] !== DEAD) yield row;
            }
            return;
        }
        // not indexed yet: scan
        for (let row = 0; row < this.#count; row++) {
            if (this.#source[row] === node && this.#typeOrdinal[row] !== DEAD) yield row;
        }
    }

    /** the rows of `node` that go `forward` with a type ordinal accepted by `types` */
    public collect(node: number, forward: boolean, types: (ordinal: number) => boolean, out: number[] = []): number[] {
        const f = forward ? 1 : 0;
        for (const row of this.rowsOf(node)) {
            if (this.#forward[row] === f && types(this.#typeOrdinal[row])) {
                out.push(row);
            }
        }
        return out;
    }

    /**
     * order the rows by source. Dead rows are dropped and the columns are trimmed to what is
     * used, so this is also the compaction step. `nodeCount` bounds the source indexes.
     */
    public index(nodeCount: number): void {
        // drop dead rows
        let live = 0;
        for (let row = 0; row < this.#count; row++) {
            if (this.#typeOrdinal[row] === DEAD) continue;
            if (live !== row) {
                this.#source[live] = this.#source[row];
                this.#typeOrdinal[live] = this.#typeOrdinal[row];
                this.#forward[live] = this.#forward[row];
                this.#target[live] = this.#target[row];
            }
            live++;
        }
        this.#count = live;
        this.#source = this.#source.slice(0, live);
        this.#typeOrdinal = this.#typeOrdinal.slice(0, live);
        this.#forward = this.#forward.slice(0, live);
        this.#target = this.#target.slice(0, live);
        // counting sort by source
        const offsets = new Int32Array(nodeCount + 1);
        for (let row = 0; row < live; row++) offsets[this.#source[row] + 1]++;
        for (let node = 0; node < nodeCount; node++) offsets[node + 1] += offsets[node];
        const fill = offsets.slice(0, nodeCount);
        const order = new Int32Array(live);
        for (let row = 0; row < live; row++) order[fill[this.#source[row]]++] = row;
        this.#offsets = offsets;
        this.#order = order;
        this.#indexedRows = live;
        this.#overflow.clear();
    }

    #grow(needed: number): void {
        let n = this.#source.length * 2;
        while (n < needed) n *= 2;
        const copy = <T extends Int32Array | Uint16Array | Uint8Array>(col: T, Type: new (n: number) => T): T => {
            const next = new Type(n);
            next.set(col as unknown as ArrayLike<number>);
            return next;
        };
        this.#source = copy(this.#source, Int32Array);
        this.#typeOrdinal = copy(this.#typeOrdinal, Uint16Array);
        this.#forward = copy(this.#forward, Uint8Array);
        this.#target = copy(this.#target, Int32Array);
    }
}
