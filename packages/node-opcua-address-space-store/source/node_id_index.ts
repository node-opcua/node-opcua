/**
 * @module node-opcua-address-space-store
 *
 * NodeId -> node index for the compact store, every identifier kind included.
 *
 * An open-addressing hash in typed arrays: 11 bytes per slot at a load factor below 1/2, where
 * a Map keyed by the formatted NodeId costs the string plus about 70 bytes per entry. A numeric
 * identifier is keyed by its value; a string, GUID or opaque identifier by the id of its bytes
 * in the arena, so that the key is a fixed 32-bit word whatever the identifier is.
 */
import { type NodeId, NodeIdType } from "node-opcua-nodeid";
import type { StringArena } from "./string_arena.js";

export const NO_NODE = -1;
const FREE = 0; // in the kind column: never used
const TOMBSTONE = 0xff; // deleted, probes continue past it

export class NodeIdIndex {
    #ns: Uint16Array;
    #kind: Uint8Array;
    #word: Uint32Array;
    #value: Int32Array;
    #mask: number;
    #size = 0; // live entries
    #occupied = 0; // live plus tombstones
    readonly #arena: StringArena;

    constructor(arena: StringArena, expectedNodes = 1024) {
        this.#arena = arena;
        let n = 64;
        while (n < expectedNodes * 2) n *= 2;
        this.#ns = new Uint16Array(n);
        this.#kind = new Uint8Array(n);
        this.#word = new Uint32Array(n);
        this.#value = new Int32Array(n);
        this.#mask = n - 1;
    }

    public get size(): number {
        return this.#size;
    }

    /** the word that stands for the identifier, or -1 when it is not in the arena (so not indexed) */
    #wordOf(nodeId: NodeId, intern: boolean): number {
        switch (nodeId.identifierType) {
            case NodeIdType.NUMERIC:
                return (nodeId.value as number) >>> 0;
            case NodeIdType.STRING: {
                const s = nodeId.value as string;
                return intern ? this.#arena.intern(s) : this.#arena.find(s);
            }
            case NodeIdType.GUID: {
                // a GUID is kept as its canonical text: 36 bytes, hashed and compared like any string
                const s = (nodeId.value as string).toLowerCase();
                return intern ? this.#arena.intern(s) : this.#arena.find(s);
            }
            case NodeIdType.BYTESTRING: {
                const bytes = nodeId.value as Uint8Array;
                return intern ? this.#arena.internBytes(bytes) : this.#arena.findBytes(bytes);
            }
            default:
                return -1;
        }
    }

    #hash(ns: number, kind: number, word: number): number {
        let h = Math.imul(word ^ (kind << 28), 0x9e3779b1) ^ Math.imul(ns + 1, 0x85ebca6b);
        h ^= h >>> 15;
        return h & this.#mask;
    }

    public set(nodeId: NodeId, index: number): void {
        const word = this.#wordOf(nodeId, true);
        const ns = nodeId.namespace;
        const kind = nodeId.identifierType;
        let slot = this.#hash(ns, kind, word);
        let tombstone = -1;
        for (;;) {
            const k = this.#kind[slot];
            if (k === FREE) {
                break;
            }
            if (k === TOMBSTONE) {
                if (tombstone === -1) tombstone = slot;
            } else if (k === kind && this.#ns[slot] === ns && this.#word[slot] === word) {
                this.#value[slot] = index;
                return;
            }
            slot = (slot + 1) & this.#mask;
        }
        if (tombstone !== -1) {
            slot = tombstone;
        } else {
            this.#occupied++;
        }
        this.#ns[slot] = ns;
        this.#kind[slot] = kind;
        this.#word[slot] = word;
        this.#value[slot] = index;
        this.#size++;
        if (this.#occupied * 2 > this.#mask + 1) {
            this.#rehash();
        }
    }

    public get(nodeId: NodeId): number {
        const word = this.#wordOf(nodeId, false);
        if (word === -1) {
            return NO_NODE;
        }
        const slot = this.#find(nodeId.namespace, nodeId.identifierType, word);
        return slot === -1 ? NO_NODE : this.#value[slot];
    }

    public delete(nodeId: NodeId): boolean {
        const word = this.#wordOf(nodeId, false);
        if (word === -1) {
            return false;
        }
        const slot = this.#find(nodeId.namespace, nodeId.identifierType, word);
        if (slot === -1) {
            return false;
        }
        this.#kind[slot] = TOMBSTONE;
        this.#size--;
        return true;
    }

    #find(ns: number, kind: number, word: number): number {
        let slot = this.#hash(ns, kind, word);
        for (;;) {
            const k = this.#kind[slot];
            if (k === FREE) {
                return -1;
            }
            if (k === kind && this.#ns[slot] === ns && this.#word[slot] === word) {
                return slot;
            }
            slot = (slot + 1) & this.#mask;
        }
    }

    #rehash(): void {
        const ns = this.#ns;
        const kind = this.#kind;
        const word = this.#word;
        const value = this.#value;
        const n = (this.#mask + 1) * 2;
        this.#ns = new Uint16Array(n);
        this.#kind = new Uint8Array(n);
        this.#word = new Uint32Array(n);
        this.#value = new Int32Array(n);
        this.#mask = n - 1;
        this.#size = 0;
        this.#occupied = 0;
        for (let i = 0; i < kind.length; i++) {
            if (kind[i] === FREE || kind[i] === TOMBSTONE) continue;
            let slot = this.#hash(ns[i], kind[i], word[i]);
            while (this.#kind[slot] !== FREE) slot = (slot + 1) & this.#mask;
            this.#ns[slot] = ns[i];
            this.#kind[slot] = kind[i];
            this.#word[slot] = word[i];
            this.#value[slot] = value[i];
            this.#size++;
            this.#occupied++;
        }
    }
}
