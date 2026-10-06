/**
 * @module node-opcua-address-space-store
 *
 * The references of the compact store: one row per reference end, (source, type ordinal,
 * direction, target), in typed columns. After `index()` the rows are ordered by source, so the
 * references of a node are one contiguous run; rows added later wait in a small overflow until
 * the next `index()`. A removed row is a tombstone until then.
 *
 * A node with many references (a folder of a hundred thousand devices) gets two hashes of its
 * own, built the first time it is searched and kept up to date on every add and remove: its
 * rows by target, for the duplicate check and the removal, and by the target's browse name,
 * for the child lookup. The rest of the nodes are scanned: a few rows. The keys are small
 * integers (a node index, an arena id) so the maps hash them as such; what they do not
 * distinguish (two reference types to one target, one name in two namespaces) the caller
 * sorts out on the short list a key gives.
 */

const DEAD = 0xffff; // type ordinal of a removed row
/** rows from which a node is worth hashing */
const BIG = 64;

/** the browse name of a target as its arena id, from the owner of the names (NodeStore) */
export type TargetNameKey = (target: number) => number;

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
    // the hashes of the big nodes: rows by target, and rows by target name
    readonly #byEnd = new Map<number, Map<number, Rows>>();
    readonly #byName = new Map<number, Map<number, Rows>>();
    #nameKey: TargetNameKey | null = null;

    constructor(expectedRows = 1024) {
        const n = Math.max(16, expectedRows);
        this.#source = new Int32Array(n);
        this.#typeOrdinal = new Uint16Array(n);
        this.#forward = new Uint8Array(n);
        this.#target = new Int32Array(n);
    }

    /** how a target's browse name is keyed; without it no name hash is built */
    public setTargetNameKey(nameKey: TargetNameKey): void {
        this.#nameKey = nameKey;
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

    /** the rows of a node, dead ones included: what a scan of it costs */
    public rowCountOf(node: number): number {
        let n = 0;
        if (this.#offsets !== null) {
            if (node + 1 < this.#offsets.length) n = this.#offsets[node + 1] - this.#offsets[node];
            n += this.#overflow.get(node)?.length ?? 0;
        } else {
            for (let row = 0; row < this.#count; row++) if (this.#source[row] === node) n++;
        }
        return n;
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
        const byEnd = this.#byEnd.get(source);
        if (byEnd !== undefined) {
            addTo(byEnd, target, row);
            addTo(this.#byName.get(source) as Map<number, Rows>, (this.#nameKey as TargetNameKey)(target), row);
        }
        return row;
    }

    /** both ends: the forward row on `source`, the inverse row on `target` */
    public addBoth(source: number, typeOrdinal: number, target: number): void {
        this.add(source, typeOrdinal, true, target);
        this.add(target, typeOrdinal, false, source);
    }

    public remove(row: number): void {
        if (this.#typeOrdinal[row] === DEAD) return;
        const source = this.#source[row];
        const byEnd = this.#byEnd.get(source);
        if (byEnd !== undefined) {
            const target = this.#target[row];
            removeFrom(byEnd, target, row);
            removeFrom(this.#byName.get(source) as Map<number, Rows>, (this.#nameKey as TargetNameKey)(target), row);
        }
        this.#typeOrdinal[row] = DEAD;
    }

    /** both ends of a reference gone: the row on `source` and its inverse on `target`; false when there was none */
    public removeBoth(source: number, typeOrdinal: number, forward: boolean, target: number): boolean {
        const row = this.find(source, typeOrdinal, forward, target);
        if (row === -1) {
            return false;
        }
        this.remove(row);
        const inverse = this.find(target, typeOrdinal, !forward, source);
        if (inverse !== -1) this.remove(inverse);
        return true;
    }

    /** every row of `node`, and the inverse row each one has on the other end */
    public removeAllOf(node: number): void {
        for (const row of [...this.rowsOf(node)]) {
            const inverse = this.find(this.#target[row], this.#typeOrdinal[row], this.#forward[row] === 0, node);
            if (inverse !== -1) this.remove(inverse);
            this.remove(row);
        }
        this.#byEnd.delete(node);
        this.#byName.delete(node);
    }

    /** the row of `source` that matches, or -1 */
    public find(source: number, typeOrdinal: number, forward: boolean, target: number): number {
        const f = forward ? 1 : 0;
        const byEnd = this.#hashOf(source);
        if (byEnd !== null) {
            const rows = byEnd.get(target);
            if (rows === undefined) return -1;
            if (typeof rows === "number") {
                return this.#typeOrdinal[rows] === typeOrdinal && this.#forward[rows] === f ? rows : -1;
            }
            for (const row of rows) {
                if (this.#typeOrdinal[row] === typeOrdinal && this.#forward[row] === f) return row;
            }
            return -1;
        }
        for (const row of this.rowsOf(source)) {
            if (this.#typeOrdinal[row] === typeOrdinal && this.#forward[row] === f && this.#target[row] === target) {
                return row;
            }
        }
        return -1;
    }

    /** the live rows of `node` whose target carries the browse name `nameId`, in any namespace */
    public rowsNamed(node: number, nameId: number): readonly number[] {
        const nameOf = this.#nameKey;
        if (nameOf === null) {
            throw new Error("ReferenceTable: no target name key was set");
        }
        if (this.#hashOf(node) !== null) {
            const byName = this.#byName.get(node) as Map<number, Rows>;
            const rows = byName.get(nameId);
            return rows === undefined ? [] : typeof rows === "number" ? [rows] : rows;
        }
        // a small node: its few rows looked at directly, no generator on this path
        const out: number[] = [];
        const typeOrdinal = this.#typeOrdinal;
        const target = this.#target;
        const take = (row: number) => {
            if (typeOrdinal[row] !== DEAD && nameOf(target[row]) === nameId) out.push(row);
        };
        if (this.#offsets !== null) {
            if (node + 1 < this.#offsets.length) {
                const order = this.#order as Int32Array;
                const end = this.#offsets[node + 1];
                for (let k = this.#offsets[node]; k < end; k++) take(order[k]);
            }
            const extra = this.#overflow.get(node);
            if (extra) for (const row of extra) take(row);
        } else {
            for (let row = 0; row < this.#count; row++) if (this.#source[row] === node) take(row);
        }
        return out;
    }

    /** the live rows of one node */
    public *rowsOf(node: number): IterableIterator<number> {
        if (this.#offsets !== null) {
            // a node added since the last index() has every row in the overflow
            if (node + 1 < this.#offsets.length) {
                const order = this.#order as Int32Array;
                const end = this.#offsets[node + 1];
                for (let k = this.#offsets[node]; k < end; k++) {
                    const row = order[k];
                    if (this.#typeOrdinal[row] !== DEAD) yield row;
                }
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
        // the rows moved: the hashes are rebuilt on demand
        this.#byEnd.clear();
        this.#byName.clear();
    }

    /** the end hash of a node: the one it has, a new one when it is big, else null */
    #hashOf(node: number): Map<number, Rows> | null {
        const existing = this.#byEnd.get(node);
        if (existing !== undefined) {
            return existing;
        }
        if (this.#nameKey === null || this.rowCountOf(node) < BIG) {
            return null;
        }
        const byEnd = new Map<number, Rows>();
        const byName = new Map<number, Rows>();
        const nameOf = this.#nameKey;
        for (const row of this.rowsOf(node)) {
            const target = this.#target[row];
            addTo(byEnd, target, row);
            addTo(byName, nameOf(target), row);
        }
        this.#byEnd.set(node, byEnd);
        this.#byName.set(node, byName);
        return byEnd;
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

/** one row under a key is kept as the number itself; a second one makes it a list */
type Rows = number | number[];

function addTo(map: Map<number, Rows>, key: number, row: number): void {
    const rows = map.get(key);
    if (rows === undefined) map.set(key, row);
    else if (typeof rows === "number") map.set(key, [rows, row]);
    else rows.push(row);
}

function removeFrom(map: Map<number, Rows>, key: number, row: number): void {
    const rows = map.get(key);
    if (rows === undefined) return;
    if (typeof rows === "number") {
        if (rows === row) map.delete(key);
        return;
    }
    const k = rows.indexOf(row);
    if (k !== -1) rows.splice(k, 1);
    if (rows.length === 1) map.set(key, rows[0]);
    else if (rows.length === 0) map.delete(key);
}
