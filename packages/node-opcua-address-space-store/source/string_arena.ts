/**
 * @module node-opcua-address-space-store
 *
 * Strings of the compact store: browse names, string identifiers, display names, GUIDs and
 * opaque identifiers as bytes, each kept once and addressed by a 32-bit id.
 *
 * Interning goes through an open-addressing hash over the bytes themselves, not a Map keyed by
 * JavaScript strings: a Map costs about 70 bytes per entry on top of the string, which on a
 * model of ten million names is more than the names. The bytes live in one growable buffer,
 * so the arena can later be shared between threads as a SharedArrayBuffer.
 */

import { bufferOf, ColumnSpace } from "./columns.js";

const EMPTY = -1;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** the FNV-1a hash of an ASCII string, computed on its char codes; -1 when it is not ASCII */
function asciiHash(s: string): number {
    let h = FNV_OFFSET;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c > 0x7f) {
            return -1;
        }
        h = Math.imul(h ^ c, FNV_PRIME);
    }
    return h >>> 0;
}

function fnv1a(bytes: Uint8Array, start: number, end: number): number {
    let h = FNV_OFFSET;
    for (let i = start; i < end; i++) {
        h = Math.imul(h ^ bytes[i], FNV_PRIME);
    }
    return h >>> 0;
}

export class StringArena {
    #bytes: Uint8Array;
    #used = 0;
    #starts: Int32Array;
    #lengths: Int32Array;
    #count = 0;
    // open addressing: slot -> string id, EMPTY when free; load factor kept below 1/2
    #slots: Int32Array;
    #mask: number;
    #scratch = new Uint8Array(256);
    #decoded: (string | undefined)[] = [];
    readonly #encoder = new TextEncoder();
    readonly #decoder = new TextDecoder();
    readonly #space: ColumnSpace;

    constructor(expectedStrings = 1024, expectedBytes = expectedStrings * 16, space = new ColumnSpace()) {
        this.#space = space;
        this.#bytes = space.allocate(Uint8Array, Math.max(64, expectedBytes));
        this.#starts = space.allocate(Int32Array, Math.max(16, expectedStrings));
        this.#lengths = space.allocate(Int32Array, Math.max(16, expectedStrings));
        let n = 32;
        while (n < expectedStrings * 2) n *= 2;
        this.#slots = space.allocate(Int32Array, n).fill(EMPTY);
        this.#mask = n - 1;
    }

    /** the buffers a reader in another thread finds strings with (see SharedStoreReader) */
    public exportShared(): SharedArenaBuffers {
        return {
            bytes: bufferOf(this.#bytes),
            starts: bufferOf(this.#starts),
            lengths: bufferOf(this.#lengths),
            slots: bufferOf(this.#slots),
            mask: this.#mask
        };
    }

    /** how many distinct strings are held */
    public get size(): number {
        return this.#count;
    }

    /** how many bytes the strings occupy */
    public get byteLength(): number {
        return this.#used;
    }

    /** the id of `s`, interning it if it is new */
    public intern(s: string): number {
        const hash = asciiHash(s);
        if (hash !== -1) {
            const found = this.#findAscii(s, hash);
            if (found !== -1) {
                return found;
            }
        }
        const length = this.#encode(s);
        return this.#internScratch(length);
    }

    /** the id of `s` if it has been interned, -1 otherwise; nothing is stored */
    public find(s: string): number {
        const hash = asciiHash(s);
        if (hash !== -1) {
            return this.#findAscii(s, hash);
        }
        const length = this.#encode(s);
        return this.#find(this.#scratch, 0, length);
    }

    /** an ASCII string is its own UTF-8: compared char by char against the bytes, no encoding */
    #findAscii(s: string, hash: number): number {
        let slot = hash & this.#mask;
        const length = s.length;
        for (;;) {
            const id = this.#slots[slot];
            if (id === EMPTY) {
                return -1;
            }
            if (this.#lengths[id] === length) {
                const at = this.#starts[id];
                let i = 0;
                while (i < length && this.#bytes[at + i] === s.charCodeAt(i)) i++;
                if (i === length) {
                    return id;
                }
            }
            slot = (slot + 1) & this.#mask;
        }
    }

    /** the id of these bytes (a GUID, an opaque identifier), interning them if new */
    public internBytes(bytes: Uint8Array): number {
        return this.#insert(bytes, 0, bytes.length, fnv1a(bytes, 0, bytes.length));
    }

    public findBytes(bytes: Uint8Array): number {
        return this.#find(bytes, 0, bytes.length);
    }

    /** the string with this id, decoded once and remembered */
    public get(id: number): string {
        let s = this.#decoded[id];
        if (s === undefined) {
            s = this.#decoder.decode(this.#bytes.subarray(this.#starts[id], this.#starts[id] + this.#lengths[id]));
            this.#decoded[id] = s;
        }
        return s;
    }

    /** the bytes with this id, as a view into the arena: not to be kept across a grow */
    public bytesOf(id: number): Uint8Array {
        return this.#bytes.subarray(this.#starts[id], this.#starts[id] + this.#lengths[id]);
    }

    public byteLengthOf(id: number): number {
        return this.#lengths[id];
    }

    public equals(id: number, s: string): boolean {
        const length = this.#encode(s);
        return this.#equalsBytes(id, this.#scratch, 0, length);
    }

    #encode(s: string): number {
        if (this.#scratch.length < s.length * 3) {
            this.#scratch = new Uint8Array(s.length * 3);
        }
        return this.#encoder.encodeInto(s, this.#scratch).written;
    }

    #equalsBytes(id: number, bytes: Uint8Array, start: number, end: number): boolean {
        const length = end - start;
        if (this.#lengths[id] !== length) {
            return false;
        }
        const at = this.#starts[id];
        for (let i = 0; i < length; i++) {
            if (this.#bytes[at + i] !== bytes[start + i]) {
                return false;
            }
        }
        return true;
    }

    #find(bytes: Uint8Array, start: number, end: number): number {
        let slot = fnv1a(bytes, start, end) & this.#mask;
        for (;;) {
            const id = this.#slots[slot];
            if (id === EMPTY) {
                return -1;
            }
            if (this.#equalsBytes(id, bytes, start, end)) {
                return id;
            }
            slot = (slot + 1) & this.#mask;
        }
    }

    #internScratch(length: number): number {
        return this.#insert(this.#scratch, 0, length, fnv1a(this.#scratch, 0, length));
    }

    #insert(bytes: Uint8Array, start: number, end: number, hash: number): number {
        let slot = hash & this.#mask;
        for (;;) {
            const id = this.#slots[slot];
            if (id === EMPTY) {
                break;
            }
            if (this.#equalsBytes(id, bytes, start, end)) {
                return id;
            }
            slot = (slot + 1) & this.#mask;
        }
        const id = this.#append(bytes, start, end);
        this.#slots[slot] = id;
        if (this.#count * 2 > this.#mask + 1) {
            this.#rehash();
        }
        return id;
    }

    #append(bytes: Uint8Array, start: number, end: number): number {
        const length = end - start;
        if (this.#used + length > this.#bytes.length) {
            let n = this.#bytes.length * 2;
            while (n < this.#used + length) n *= 2;
            this.#bytes = this.#space.resized(this.#bytes, n, Uint8Array);
        }
        if (this.#count === this.#starts.length) {
            const n = this.#starts.length * 2;
            this.#starts = this.#space.resized(this.#starts, n, Int32Array);
            this.#lengths = this.#space.resized(this.#lengths, n, Int32Array);
        }
        const id = this.#count++;
        this.#starts[id] = this.#used;
        this.#lengths[id] = length;
        this.#bytes.set(bytes.subarray(start, end), this.#used);
        this.#used += length;
        return id;
    }

    #rehash(): void {
        const n = (this.#mask + 1) * 2;
        const slots = this.#space.allocate(Int32Array, n).fill(EMPTY);
        const mask = n - 1;
        for (let id = 0; id < this.#count; id++) {
            const start = this.#starts[id];
            let slot = fnv1a(this.#bytes, start, start + this.#lengths[id]) & mask;
            while (slots[slot] !== EMPTY) slot = (slot + 1) & mask;
            slots[slot] = id;
        }
        this.#slots = slots;
        this.#mask = mask;
        this.#space.relayout();
    }
}

/** what a reader in another thread needs of an arena */
export interface SharedArenaBuffers {
    bytes: SharedArrayBuffer;
    starts: SharedArrayBuffer;
    lengths: SharedArrayBuffer;
    slots: SharedArrayBuffer;
    mask: number;
}
