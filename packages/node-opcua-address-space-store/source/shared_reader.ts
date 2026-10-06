/**
 * @module node-opcua-address-space-store
 *
 * A store seen from another thread: the NodeId index, the node classes, access levels and
 * values of a shared CompactStore, read in place. The thread that owns the store is the only
 * writer; this side never writes.
 *
 * A value is read under its seqlock: the version word is even and unchanged across the reads
 * of the fields, else the read is retried. The version is read with Atomics.load, which is what
 * keeps the field reads between the two version reads under the memory model.
 *
 * What is not in shared columns is answered NotShared, and the caller asks the owner: values
 * kept as objects (strings, arrays, structures), Variables bound to a getter, and every NodeId
 * a reader cannot place after the owner reallocated a column (see isCurrent).
 */
import { NodeClass } from "node-opcua-data-model";
import { type NodeId, NodeIdType } from "node-opcua-nodeid";
import { NAMESPACE_DEFAULT_RESTRICTIONS, NAMESPACE_DEFAULT_ROLE_PERMISSIONS, type SharedStoreDescriptor } from "./compact_store.js";
import { NO_NODE, NodeIdIndex } from "./node_id_index.js";
import { BOUND, INHERITED_ACCESS_RESTRICTIONS, OWN_ROLE_PERMISSIONS } from "./node_store.js";
import { ValueKind } from "./value_store.js";

const FREE = 0;
const EMPTY = -1;
const DELETED = 4;
const CURRENT_READ = 1;

/** what a read of a value from another thread ends with */
export enum SharedReadStatus {
    /** the fields of `out` hold the value */
    Good = 0,
    /** no such node, or a deleted one */
    NotFound = 1,
    /** not a Variable, or its access level does not let it be read */
    NotReadable = 2,
    /** a value this side cannot read (an object, nothing yet, a binding): ask the owner */
    NotShared = 3
}

/** the fields of a value read in place */
export interface SharedValue {
    dataType: number;
    /** a number, or a boolean as 0 or 1 (see `kind`) */
    value: number;
    kind: ValueKind;
    statusCode: number;
    sourceTimestamp: number;
    sourcePicoseconds: number;
    serverTimestamp: number;
    serverPicoseconds: number;
    /** the version word the value was read under: what orders it against the changes the owner reports */
    version: number;
}

export class SharedStoreReader {
    readonly #layout: Int32Array;
    readonly #layoutSeen: number;
    // nodes
    readonly #nodeClass: Uint8Array;
    readonly #accessLevel: Uint8Array;
    readonly #userAccessLevel: Uint8Array;
    readonly #flags: Uint8Array;
    readonly #namespace: Uint16Array;
    readonly #accessRestrictions: Uint8Array;
    readonly #namespacePolicy: Uint8Array;
    readonly #minimumSamplingInterval: Float32Array;
    readonly #generation: Uint16Array;
    // the NodeId index
    readonly #ns: Uint16Array;
    readonly #kind: Uint8Array;
    readonly #word: Uint32Array;
    readonly #index: Int32Array;
    readonly #mask: number;
    // the string arena, for string identifiers
    readonly #bytes: Uint8Array;
    readonly #starts: Int32Array;
    readonly #lengths: Int32Array;
    readonly #slots: Int32Array;
    readonly #slotMask: number;
    // values
    readonly #valueKind: Uint8Array;
    readonly #dataType: Uint8Array;
    readonly #number: Float64Array;
    readonly #statusCode: Uint32Array;
    readonly #sourceTimestamp: Float64Array;
    readonly #serverTimestamp: Float64Array;
    readonly #sourcePicoseconds: Uint16Array;
    readonly #serverPicoseconds: Uint16Array;
    readonly #version: Uint32Array;

    constructor(descriptor: SharedStoreDescriptor) {
        this.#layout = new Int32Array(descriptor.layout);
        this.#layoutSeen = descriptor.layoutSeen;
        const n = descriptor.nodes;
        this.#nodeClass = new Uint8Array(n.nodeClass);
        this.#accessLevel = new Uint8Array(n.accessLevel);
        this.#userAccessLevel = new Uint8Array(n.userAccessLevel);
        this.#flags = new Uint8Array(n.flags);
        this.#namespace = new Uint16Array(n.namespace);
        this.#accessRestrictions = new Uint8Array(n.accessRestrictions);
        this.#namespacePolicy = new Uint8Array(descriptor.namespacePolicy);
        this.#minimumSamplingInterval = new Float32Array(n.minimumSamplingInterval);
        this.#generation = new Uint16Array(n.generation);
        this.#ns = new Uint16Array(n.index.ns);
        this.#kind = new Uint8Array(n.index.kind);
        this.#word = new Uint32Array(n.index.word);
        this.#index = new Int32Array(n.index.value);
        this.#mask = n.index.mask;
        this.#bytes = new Uint8Array(n.strings.bytes);
        this.#starts = new Int32Array(n.strings.starts);
        this.#lengths = new Int32Array(n.strings.lengths);
        this.#slots = new Int32Array(n.strings.slots);
        this.#slotMask = n.strings.mask;
        const v = descriptor.values;
        this.#valueKind = new Uint8Array(v.kind);
        this.#dataType = new Uint8Array(v.dataType);
        this.#number = new Float64Array(v.number);
        this.#statusCode = new Uint32Array(v.statusCode);
        this.#sourceTimestamp = new Float64Array(v.sourceTimestamp);
        this.#serverTimestamp = new Float64Array(v.serverTimestamp);
        this.#sourcePicoseconds = new Uint16Array(v.sourcePicoseconds);
        this.#serverPicoseconds = new Uint16Array(v.serverPicoseconds);
        this.#version = new Uint32Array(v.version);
    }

    /**
     * false once the owner reallocated a column: the buffers held here are no longer the ones
     * written to. Checked before a batch; a stale reader asks the owner for a new descriptor.
     */
    public isCurrent(): boolean {
        return Atomics.load(this.#layout, 0) === this.#layoutSeen;
    }

    /** the node index of a NodeId, or NO_NODE (numeric and string identifiers; the others: NO_NODE) */
    public find(nodeId: NodeId): number {
        switch (nodeId.identifierType) {
            case NodeIdType.NUMERIC:
                return this.#find(nodeId.namespace, NodeIdType.NUMERIC, (nodeId.value as number) >>> 0);
            case NodeIdType.STRING: {
                const word = this.#stringId(nodeId.value as string);
                return word === EMPTY ? NO_NODE : this.#find(nodeId.namespace, NodeIdType.STRING, word);
            }
            default:
                return NO_NODE;
        }
    }

    /** the NodeClass of node `i`, as a number; 0 (Unspecified) for NO_NODE */
    public nodeClass(i: number): number {
        return i === NO_NODE ? 0 : this.#nodeClass[i];
    }

    /** true when node `i` was deleted (and its index not given to another node yet) */
    public isDeleted(i: number): boolean {
        return i === NO_NODE || (this.#flags[i] & DELETED) !== 0;
    }

    /** the generation of index `i`: moves when the node is deleted, so a node held by index can be told from the next one */
    public generation(i: number): number {
        return this.#generation[i];
    }

    public minimumSamplingInterval(i: number): number {
        return this.#minimumSamplingInterval[i];
    }

    /**
     * true when no permission rule applies to node `i` beyond its access levels: no access
     * restrictions of its own or of its namespace, no role permissions of its own or of its
     * namespace, no getter. Such a value may be served to any session in place; the others
     * are the owner's to answer, with the session's roles and channel.
     */
    public isOpen(i: number): boolean {
        const flags = this.#flags[i];
        if ((flags & (OWN_ROLE_PERMISSIONS | BOUND | DELETED)) !== 0) return false;
        const policy = this.#namespacePolicy[this.#namespace[i]];
        if ((policy & NAMESPACE_DEFAULT_ROLE_PERMISSIONS) !== 0) return false;
        const own = this.#accessRestrictions[i];
        if (own === INHERITED_ACCESS_RESTRICTIONS) return (policy & NAMESPACE_DEFAULT_RESTRICTIONS) === 0;
        return own === 0;
    }

    /**
     * true when a Read of the Value of node `i` would be Good and may be answered here, for any
     * session: a readable Variable holding a scalar, under no permission rule (see isOpen)
     */
    public canServe(i: number): boolean {
        if (i === NO_NODE || this.#nodeClass[i] !== NodeClass.Variable) return false;
        if ((this.#accessLevel[i] & CURRENT_READ) === 0 || (this.#userAccessLevel[i] & CURRENT_READ) === 0) return false;
        const kind = this.#valueKind[i];
        if (kind !== ValueKind.Number && kind !== ValueKind.Boolean) return false;
        return this.isOpen(i);
    }

    /** the Value of node `i` into `out`, under the node's seqlock */
    public readValue(i: number, out: SharedValue): SharedReadStatus {
        if (i === NO_NODE || (this.#flags[i] & DELETED) !== 0) {
            return SharedReadStatus.NotFound;
        }
        if (this.#nodeClass[i] !== NodeClass.Variable || (this.#accessLevel[i] & CURRENT_READ) === 0) {
            return SharedReadStatus.NotReadable;
        }
        if ((this.#userAccessLevel[i] & CURRENT_READ) === 0) {
            return SharedReadStatus.NotReadable;
        }
        const version = this.#version;
        for (;;) {
            const before = Atomics.load(version, i);
            if ((before & 1) !== 0) continue; // a write is in progress
            const kind = this.#valueKind[i] as ValueKind;
            if (kind !== ValueKind.Number && kind !== ValueKind.Boolean) {
                return SharedReadStatus.NotShared;
            }
            out.kind = kind;
            out.dataType = this.#dataType[i];
            out.value = this.#number[i];
            out.statusCode = this.#statusCode[i];
            out.sourceTimestamp = this.#sourceTimestamp[i];
            out.sourcePicoseconds = this.#sourcePicoseconds[i];
            out.serverTimestamp = this.#serverTimestamp[i];
            out.serverPicoseconds = this.#serverPicoseconds[i];
            if (Atomics.load(version, i) === before) {
                out.version = before;
                return SharedReadStatus.Good;
            }
        }
    }

    #find(ns: number, kind: number, word: number): number {
        let slot = NodeIdIndex.hash(ns, kind, word, this.#mask);
        for (;;) {
            const k = this.#kind[slot];
            if (k === FREE) return NO_NODE;
            if (k === kind && this.#ns[slot] === ns && this.#word[slot] === word) return this.#index[slot];
            slot = (slot + 1) & this.#mask;
        }
    }

    /** the arena id of an ASCII string, or EMPTY; a non-ASCII string is not looked up here */
    #stringId(s: string): number {
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            if (c > 0x7f) return EMPTY;
            h = Math.imul(h ^ c, 0x01000193);
        }
        let slot = (h >>> 0) & this.#slotMask;
        const length = s.length;
        for (;;) {
            const id = this.#slots[slot];
            if (id === EMPTY) return EMPTY;
            if (this.#lengths[id] === length) {
                const at = this.#starts[id];
                let i = 0;
                while (i < length && this.#bytes[at + i] === s.charCodeAt(i)) i++;
                if (i === length) return id;
            }
            slot = (slot + 1) & this.#slotMask;
        }
    }
}
