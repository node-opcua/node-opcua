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
    /** reference types */
    symmetric?: boolean;
    inverseName?: string | null;
    /** views */
    containsNoLoops?: boolean;
    /** the AccessRestrictions flags the node declares; undefined inherits the namespace default */
    accessRestrictions?: number;
    /**
     * the RolePermissions the node declares: an empty list grants nothing (HasNoPermissions),
     * undefined or null inherits the namespace default
     */
    rolePermissions?: readonly RolePermissionEntry[] | null;
}

/** one entry of a RolePermissions attribute */
export interface RolePermissionEntry {
    roleId: NodeId;
    permissions: number;
}

/** the accessRestrictions column value for a node that declares none */
const INHERITED_ACCESS_RESTRICTIONS = 0xff;

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
    #flags: Uint8Array; // bit 0 historizing, bit 1 isAbstract, bit 2 deleted, bit 3 symmetric, bit 4 containsNoLoops
    #inverseName: Int32Array; // arena id or NO_STRING (reference types)
    #accessRestrictions: Uint8Array; // flags, or INHERITED_ACCESS_RESTRICTIONS
    // how many nodes have occupied each index: a view remembers the one it was built for
    #generation: Uint16Array;
    // the indexes of deleted nodes, taken again by the next additions
    #free: number[] = [];
    // the few nodes that declare RolePermissions (557 of the 5,476 nodes of the standard nodeset)
    readonly #rolePermissions = new Map<number, readonly RolePermissionEntry[]>();

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
        this.#inverseName = new Int32Array(n);
        this.#accessRestrictions = new Uint8Array(n).fill(INHERITED_ACCESS_RESTRICTIONS);
        this.#generation = new Uint16Array(n);
    }

    /** indexes handed out so far, deleted ones included */
    public get count(): number {
        return this.#count;
    }

    /** how many deleted indexes wait to be taken again */
    public get freeCount(): number {
        return this.#free.length;
    }

    public add(record: NodeRecord): number {
        if (this.byNodeId.get(record.nodeId) !== NO_NODE) {
            throw new Error(`NodeStore: node ${record.nodeId.toString()} exists already`);
        }
        let i: number;
        if (this.#free.length > 0) {
            // the index of a deleted node, every column of it written below
            i = this.#free.pop() as number;
        } else {
            if (this.#count === this.#capacity) {
                this.#grow(this.#count + 1);
            }
            i = this.#count++;
        }
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
        this.#parent[i] = record.parent ?? NO_NODE; // check-proto-pollution: ok - typed array, node index
        this.#valueRank[i] = record.valueRank ?? -1;
        this.#accessLevel[i] = record.accessLevel ?? 0;
        this.#userAccessLevel[i] = record.userAccessLevel ?? this.#accessLevel[i];
        this.#eventNotifier[i] = record.eventNotifier ?? 0;
        this.#minimumSamplingInterval[i] = record.minimumSamplingInterval ?? 0;
        this.#flags[i] =
            (record.historizing ? 1 : 0) |
            (record.isAbstract ? 2 : 0) |
            (record.symmetric ? 8 : 0) |
            (record.containsNoLoops ? 16 : 0);
        this.#inverseName[i] = record.inverseName ? this.strings.intern(record.inverseName) : NO_STRING; // check-proto-pollution: ok - typed array, node index
        this.#accessRestrictions[i] = record.accessRestrictions ?? INHERITED_ACCESS_RESTRICTIONS; // check-proto-pollution: ok - typed array, node index
        if (record.rolePermissions) {
            this.#rolePermissions.set(i, record.rolePermissions);
        } else {
            this.#rolePermissions.delete(i);
        }
        return i;
    }

    /**
     * the node is forgotten by NodeId at once, and its index is given to the next node added:
     * a view built for the old node tells the two apart by generation (see isDeleted)
     */
    public delete(i: number): void {
        if ((this.#flags[i] & 4) !== 0) return;
        this.byNodeId.delete(this.nodeId(i));
        this.#flags[i] |= 4;
        this.#generation[i] += 1; // check-proto-pollution: ok - typed array, node index
        this.#rolePermissions.delete(i);
        this.#free.push(i);
    }

    public isDeleted(i: number): boolean {
        return (this.#flags[i] & 4) !== 0;
    }

    /** the generation of the node at index `i`: moves each time the index is deleted */
    public generation(i: number): number {
        return this.#generation[i];
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
        this.#parent[i] = node; // check-proto-pollution: ok - typed array, node index
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
    public symmetric(i: number): boolean {
        return (this.#flags[i] & 8) !== 0;
    }
    public containsNoLoops(i: number): boolean {
        return (this.#flags[i] & 16) !== 0;
    }
    public inverseName(i: number): string | null {
        const id = this.#inverseName[i];
        return id === NO_STRING ? null : this.strings.get(id);
    }
    /** the AccessRestrictions the node declares, undefined when it inherits its namespace's */
    public accessRestrictions(i: number): number | undefined {
        const flags = this.#accessRestrictions[i];
        return flags === INHERITED_ACCESS_RESTRICTIONS ? undefined : flags;
    }
    public setAccessRestrictions(i: number, flags: number | undefined): void {
        this.#accessRestrictions[i] = flags ?? INHERITED_ACCESS_RESTRICTIONS; // check-proto-pollution: ok - typed array, node index
    }
    /** the RolePermissions the node declares, null when it inherits its namespace's */
    public rolePermissions(i: number): readonly RolePermissionEntry[] | null {
        return this.#rolePermissions.get(i) ?? null;
    }
    public setRolePermissions(i: number, entries: readonly RolePermissionEntry[] | null): void {
        if (entries) this.#rolePermissions.set(i, entries);
        else this.#rolePermissions.delete(i);
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
        this.#inverseName = resized(this.#inverseName, n, Int32Array);
        this.#generation = resized(this.#generation, n, Uint16Array);
        const restrictions = resized(this.#accessRestrictions, n, Uint8Array);
        if (n > this.#accessRestrictions.length) {
            restrictions.fill(INHERITED_ACCESS_RESTRICTIONS, this.#accessRestrictions.length);
        }
        this.#accessRestrictions = restrictions;
    }
}
