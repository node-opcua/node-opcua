/**
 * @module node-opcua-address-space-store
 *
 * The nodes of the compact store. A node is an index; every attribute is a typed column. The
 * node classes, references and values are addressed by that index, nothing is an object until
 * a view is asked for.
 */
import type { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { NO_NODE, NodeIdIndex } from "./node_id_index.js";
import { StringArena } from "./string_arena.js";

export { NO_NODE };

export const NO_STRING = -1;

/** what a node is created from; strings are interned, NodeIds resolved to indexes by the caller */
export interface NodeRecord {
    nodeId: NodeId;
    nodeClass: NodeClass;
    browseName: string;
    browseNameNamespace: number;
    displayName?: string | null;
    description?: string | null;
    /** node index of the type definition, or NO_NODE */
    typeDefinition?: number;
    /** node index of the data type (Variables, VariableTypes), or NO_NODE */
    dataType?: number;
    /** node index of the declared parent, or NO_NODE */
    parent?: number;
    valueRank?: number;
    accessLevel?: number;
    userAccessLevel?: number;
    minimumSamplingInterval?: number;
    historizing?: boolean;
    eventNotifier?: number;
    isAbstract?: boolean;
}

type Column = Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array;

/** `col` resized to `n` entries, grown or trimmed; `Type` is its own constructor */
function resized<T extends Column>(col: T, n: number, Type: new (n: number) => T): T {
    const next = new Type(n);
    next.set((col.length > n ? col.subarray(0, n) : col) as unknown as ArrayLike<number>);
    return next;
}

export class NodeStore {
    public readonly strings: StringArena;
    public readonly byNodeId: NodeIdIndex;
    #count = 0;
    #capacity: number;

    // identity
    #namespace: Uint16Array;
    #identifierType: Uint8Array;
    #identifier: Uint32Array; // numeric value, or the arena id of the string / guid / opaque bytes
    // attributes
    #nodeClass: Uint8Array;
    #browseName: Int32Array; // arena id
    #browseNameNamespace: Uint16Array;
    #displayName: Int32Array; // arena id or NO_STRING (defaults to the browse name)
    #description: Int32Array; // arena id or NO_STRING
    #typeDefinition: Int32Array; // node index or NO_NODE
    #dataType: Int32Array; // node index or NO_NODE
    #parent: Int32Array; // the declared parent (ParentNodeId), node index or NO_NODE
    #valueRank: Int8Array;
    #accessLevel: Uint8Array;
    #userAccessLevel: Uint8Array;
    #eventNotifier: Uint8Array;
    #minimumSamplingInterval: Float32Array;
    #flags: Uint8Array; // bit 0 historizing, bit 1 isAbstract, bit 2 deleted

    constructor(expectedNodes = 1024) {
        this.strings = new StringArena(Math.max(64, expectedNodes >> 2));
        this.byNodeId = new NodeIdIndex(this.strings, expectedNodes);
        const n = Math.max(16, expectedNodes);
        this.#capacity = n;
        this.#namespace = new Uint16Array(n);
        this.#identifierType = new Uint8Array(n);
        this.#identifier = new Uint32Array(n);
        this.#nodeClass = new Uint8Array(n);
        this.#browseName = new Int32Array(n);
        this.#browseNameNamespace = new Uint16Array(n);
        this.#displayName = new Int32Array(n);
        this.#description = new Int32Array(n);
        this.#typeDefinition = new Int32Array(n);
        this.#dataType = new Int32Array(n);
        this.#parent = new Int32Array(n);
        this.#valueRank = new Int8Array(n);
        this.#accessLevel = new Uint8Array(n);
        this.#userAccessLevel = new Uint8Array(n);
        this.#eventNotifier = new Uint8Array(n);
        this.#minimumSamplingInterval = new Float32Array(n);
        this.#flags = new Uint8Array(n);
    }

    /** indexes handed out so far, deleted ones included */
    public get count(): number {
        return this.#count;
    }

    public add(record: NodeRecord): number {
        if (this.byNodeId.get(record.nodeId) !== NO_NODE) {
            throw new Error(`NodeStore: node ${record.nodeId.toString()} exists already`);
        }
        if (this.#count === this.#capacity) {
            this.#grow(this.#count + 1);
        }
        const i = this.#count++;
        const nodeId = record.nodeId;
        this.#namespace[i] = nodeId.namespace;
        this.#identifierType[i] = nodeId.identifierType;
        this.byNodeId.set(nodeId, i);
        this.#identifier[i] = this.#identifierWord(nodeId);
        this.#nodeClass[i] = record.nodeClass;
        this.#browseName[i] = this.strings.intern(record.browseName);
        this.#browseNameNamespace[i] = record.browseNameNamespace;
        this.#displayName[i] = record.displayName ? this.strings.intern(record.displayName) : NO_STRING;
        this.#description[i] = record.description ? this.strings.intern(record.description) : NO_STRING;
        this.#typeDefinition[i] = record.typeDefinition ?? NO_NODE;
        this.#dataType[i] = record.dataType ?? NO_NODE;
        this.#parent[i] = record.parent ?? NO_NODE;
        this.#valueRank[i] = record.valueRank ?? -1;
        this.#accessLevel[i] = record.accessLevel ?? 0;
        this.#userAccessLevel[i] = record.userAccessLevel ?? this.#accessLevel[i];
        this.#eventNotifier[i] = record.eventNotifier ?? 0;
        this.#minimumSamplingInterval[i] = record.minimumSamplingInterval ?? 0;
        this.#flags[i] = (record.historizing ? 1 : 0) | (record.isAbstract ? 2 : 0);
        return i;
    }

    /** the node is forgotten by NodeId at once; its index is a tombstone until a compaction */
    public delete(i: number): void {
        this.byNodeId.delete(this.nodeId(i));
        this.#flags[i] |= 4;
    }

    public isDeleted(i: number): boolean {
        return (this.#flags[i] & 4) !== 0;
    }

    public find(nodeId: NodeId): number {
        return this.byNodeId.get(nodeId);
    }

    public nodeId(i: number): NodeId {
        const type = this.#identifierType[i] as NodeIdType;
        const word = this.#identifier[i];
        switch (type) {
            case NodeIdType.NUMERIC:
                return new NodeId(NodeIdType.NUMERIC, word, this.#namespace[i]);
            case NodeIdType.STRING:
            case NodeIdType.GUID:
                return new NodeId(type, this.strings.get(word), this.#namespace[i]);
            case NodeIdType.BYTESTRING:
                return new NodeId(NodeIdType.BYTESTRING, Buffer.from(this.strings.bytesOf(word)), this.#namespace[i]);
            default:
                throw new Error("NodeStore: invalid identifier type");
        }
    }

    public namespace(i: number): number {
        return this.#namespace[i];
    }
    public nodeClass(i: number): NodeClass {
        return this.#nodeClass[i] as NodeClass;
    }
    public browseName(i: number): string {
        return this.strings.get(this.#browseName[i]);
    }
    public browseNameId(i: number): number {
        return this.#browseName[i];
    }
    public browseNameNamespace(i: number): number {
        return this.#browseNameNamespace[i];
    }
    public displayName(i: number): string {
        const id = this.#displayName[i];
        return this.strings.get(id === NO_STRING ? this.#browseName[i] : id);
    }
    public description(i: number): string | null {
        const id = this.#description[i];
        return id === NO_STRING ? null : this.strings.get(id);
    }
    public typeDefinition(i: number): number {
        return this.#typeDefinition[i];
    }
    public setTypeDefinition(i: number, node: number): void {
        this.#typeDefinition[i] = node;
    }
    public dataType(i: number): number {
        return this.#dataType[i];
    }
    public setDataType(i: number, node: number): void {
        this.#dataType[i] = node;
    }
    /** the parent the document declared, when it did */
    public parent(i: number): number {
        return this.#parent[i];
    }
    public setParent(i: number, node: number): void {
        this.#parent[i] = node;
    }
    public valueRank(i: number): number {
        return this.#valueRank[i];
    }
    public accessLevel(i: number): number {
        return this.#accessLevel[i];
    }
    public userAccessLevel(i: number): number {
        return this.#userAccessLevel[i];
    }
    public eventNotifier(i: number): number {
        return this.#eventNotifier[i];
    }
    public minimumSamplingInterval(i: number): number {
        return this.#minimumSamplingInterval[i];
    }
    public historizing(i: number): boolean {
        return (this.#flags[i] & 1) !== 0;
    }
    public isAbstract(i: number): boolean {
        return (this.#flags[i] & 2) !== 0;
    }

    /** after a bulk load: drop the growth slack of every column */
    public compact(): void {
        if (this.#capacity === this.#count) return;
        this.#capacity = this.#count;
        this.#resize(this.#count);
    }

    #identifierWord(nodeId: NodeId): number {
        switch (nodeId.identifierType) {
            case NodeIdType.NUMERIC:
                return (nodeId.value as number) >>> 0;
            case NodeIdType.STRING:
                return this.strings.find(nodeId.value as string);
            case NodeIdType.GUID:
                return this.strings.find((nodeId.value as string).toLowerCase());
            case NodeIdType.BYTESTRING:
                return this.strings.findBytes(nodeId.value as Uint8Array);
            default:
                throw new Error("NodeStore: invalid identifier type");
        }
    }

    #grow(needed: number): void {
        let n = this.#capacity * 2;
        while (n < needed) n *= 2;
        this.#capacity = n;
        this.#resize(n);
    }

    #resize(n: number): void {
        this.#namespace = resized(this.#namespace, n, Uint16Array);
        this.#identifierType = resized(this.#identifierType, n, Uint8Array);
        this.#identifier = resized(this.#identifier, n, Uint32Array);
        this.#nodeClass = resized(this.#nodeClass, n, Uint8Array);
        this.#browseName = resized(this.#browseName, n, Int32Array);
        this.#browseNameNamespace = resized(this.#browseNameNamespace, n, Uint16Array);
        this.#displayName = resized(this.#displayName, n, Int32Array);
        this.#description = resized(this.#description, n, Int32Array);
        this.#typeDefinition = resized(this.#typeDefinition, n, Int32Array);
        this.#dataType = resized(this.#dataType, n, Int32Array);
        this.#parent = resized(this.#parent, n, Int32Array);
        this.#valueRank = resized(this.#valueRank, n, Int8Array);
        this.#accessLevel = resized(this.#accessLevel, n, Uint8Array);
        this.#userAccessLevel = resized(this.#userAccessLevel, n, Uint8Array);
        this.#eventNotifier = resized(this.#eventNotifier, n, Uint8Array);
        this.#minimumSamplingInterval = resized(this.#minimumSamplingInterval, n, Float32Array);
        this.#flags = resized(this.#flags, n, Uint8Array);
    }
}
