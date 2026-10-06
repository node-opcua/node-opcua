/**
 * @module node-opcua-address-space
 *
 * The nodeset records written straight into a compact store: no node object is created.
 * Same producer as the object applier (NodesetRecordApplier), other sink.
 */
import { type CompactStore, NO_NODE, type RolePermissionEntry, type StoreAddressSpace } from "node-opcua-address-space-store";
import { NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { DataType, VariantArrayType, type VariantOptions } from "node-opcua-variant";
import type { NodeSetPermissionsPolicy } from "../interfaces/nodeset_loader_options.js";
import {
    type NodesetHeaderRecord,
    type NodesetNodeRecord,
    type NodesetRecord,
    type NodesetRecordConsumer,
    XmlExtensionObjectFragment
} from "./nodeset_record.js";

const UA_NAMESPACE_URI = "http://opcfoundation.org/UA/";

/** who hands out namespace indexes: the address space, or a plain table in a test */
export interface NamespaceRegistry {
    /** the index of a namespace, registering it when it is new */
    indexOf(namespaceUri: string): number;
}

/** the same two policies as the object loader, with the same defaults */
export interface StoreRecordApplierOptions {
    /** the nodeset's RolePermissions: kept (the default) or dropped */
    permissions?: NodeSetPermissionsPolicy;
    /** the nodeset's AccessRestrictions: kept, or dropped (the default) */
    accessRestrictions?: NodeSetPermissionsPolicy;
}

export class StoreRecordApplier implements NodesetRecordConsumer {
    // per document: the file's namespace table to the store's
    #table: number[] = [];
    #headerSeen = false;
    #nodeCount = 0;
    #pendingValues = 0;
    #deferredValues = 0;
    // a type definition or data type declared before its node exists: set at finish()
    #deferredTypeDefinitions: [number, NodeId][] = [];
    #deferredDataTypes: [number, NodeId][] = [];
    #deferredParents: [number, NodeId][] = [];
    readonly #store: CompactStore;
    readonly #namespaces: NamespaceRegistry;
    readonly #loadTime = Date.now();
    readonly #keepPermissions: boolean;
    readonly #keepAccessRestrictions: boolean;

    constructor(store: CompactStore, namespaces: NamespaceRegistry, options: StoreRecordApplierOptions = {}) {
        this.#store = store;
        this.#namespaces = namespaces;
        this.#keepPermissions = (options.permissions ?? "apply") === "apply";
        this.#keepAccessRestrictions = (options.accessRestrictions ?? "ignore") === "apply";
    }

    /** nodes applied by this applier */
    public get nodeCount(): number {
        return this.#nodeCount;
    }

    public apply(record: NodesetRecord): void {
        if (record.kind === "header") {
            this.#applyHeader(record);
            return;
        }
        if (!this.#headerSeen) {
            throw new Error("StoreRecordApplier: a node record came before the header record");
        }
        this.#applyNode(record);
    }

    /** at the end of a document, or of a set of documents: resolve the references that waited */
    public finish(): { unresolved: number } {
        const store = this.#store;
        const unresolved = store.resolvePending();
        for (const [i, nodeId] of this.#deferredTypeDefinitions) {
            const t = store.find(nodeId);
            if (t !== NO_NODE) store.nodes.setTypeDefinition(i, t);
        }
        for (const [i, nodeId] of this.#deferredDataTypes) {
            const t = store.find(nodeId);
            if (t !== NO_NODE) store.nodes.setDataType(i, t);
        }
        for (const [i, nodeId] of this.#deferredParents) {
            const t = store.find(nodeId);
            if (t !== NO_NODE) store.nodes.setParent(i, t);
        }
        this.#deferredTypeDefinitions = [];
        this.#deferredDataTypes = [];
        this.#deferredParents = [];
        store.finish();
        return { unresolved: unresolved.length };
    }

    #applyHeader(header: NodesetHeaderRecord): void {
        this.#headerSeen = true;
        this.#table = [];
        for (const model of header.models) {
            this.#namespaces.indexOf(model.modelUri);
        }
        if (header.models.length === 0) {
            for (const uri of header.namespaceUris) {
                this.#namespaces.indexOf(uri);
            }
        }
        // the file's table: the UA namespace, then the declared URIs in order; a repeat takes no slot
        const seen = new Set<string>();
        for (const uri of [UA_NAMESPACE_URI, ...header.namespaceUris]) {
            if (seen.has(uri)) continue;
            seen.add(uri);
            this.#table.push(this.#namespaces.indexOf(uri));
        }
    }

    #translateNamespace(fileIndex: number): number {
        const index = this.#table[fileIndex];
        if (index === undefined) {
            throw new Error(`StoreRecordApplier: no namespace for file index ${fileIndex}`);
        }
        return index;
    }

    #translate(fileLocal: NodeId): NodeId {
        const namespace = this.#translateNamespace(fileLocal.namespace);
        return namespace === fileLocal.namespace ? fileLocal : new NodeId(fileLocal.identifierType, fileLocal.value, namespace);
    }

    #applyNode(record: NodesetNodeRecord): void {
        const store = this.#store;
        const nodeId = this.#translate(record.nodeId);
        const i = store.addNode({
            nodeId,
            nodeClass: record.nodeClass,
            browseName: record.browseName.name ?? "",
            browseNameNamespace: this.#translateNamespace(record.browseName.namespaceIndex),
            displayName: record.displayName && record.displayName !== record.browseName.name ? record.displayName : null,
            description: record.description ?? null,
            valueRank: record.valueRank,
            // the document gives the levels as numbers; CurrentRead when it says nothing, and the
            // user level follows the node's unless declared (same reading as the object applier)
            accessLevel: parseAccessLevel(record.accessLevel, 1),
            userAccessLevel: record.userAccessLevel ? parseAccessLevel(record.userAccessLevel, 1) : undefined,
            minimumSamplingInterval: record.minimumSamplingInterval,
            historizing: record.historizing,
            eventNotifier: record.eventNotifier,
            isAbstract: record.isAbstract,
            symmetric: record.symmetric,
            inverseName: record.inverseName ?? null,
            containsNoLoops: record.containsNoLoops,
            accessRestrictions: this.#keepAccessRestrictions ? parseAccessRestrictions(record.accessRestrictions) : undefined,
            rolePermissions: this.#keepPermissions ? this.#rolePermissions(record) : undefined
        });
        this.#nodeCount++;
        for (const reference of record.references) {
            const referenceType = this.#translate(reference.referenceType);
            const target = this.#translate(reference.nodeId);
            store.addReference(i, referenceType, reference.isForward, target);
            // the type definition and the data type are also columns, kept resolved by index
            if (reference.isForward && referenceType.namespace === 0 && referenceType.value === 40 /* HasTypeDefinition */) {
                const t = store.find(target);
                if (t !== NO_NODE) store.nodes.setTypeDefinition(i, t);
                else this.#deferredTypeDefinitions.push([i, target]);
            }
        }
        if (record.dataType) {
            const dataTypeId = this.#translate(record.dataType);
            const dataType = store.find(dataTypeId);
            if (dataType !== NO_NODE) store.nodes.setDataType(i, dataType);
            else this.#deferredDataTypes.push([i, dataTypeId]);
        }
        if (record.parentNodeId) {
            const parentId = this.#translate(record.parentNodeId);
            const parent = store.find(parentId);
            if (parent !== NO_NODE) store.nodes.setParent(i, parent);
            else this.#deferredParents.push([i, parentId]);
        }
        if (record.value && (record.nodeClass === NodeClass.Variable || record.nodeClass === NodeClass.VariableType)) {
            this.#applyValue(i, record.value);
        }
    }

    #rolePermissions(record: NodesetNodeRecord): RolePermissionEntry[] | undefined {
        if (record.rolePermissions) {
            return record.rolePermissions.map((r) => ({ roleId: this.#translate(r.roleId), permissions: r.permissions }));
        }
        // HasNoPermissions grants nothing; an absent RolePermissions inherits the namespace default
        return record.hasNoPermissions ? [] : undefined;
    }

    #applyValue(i: number, value: VariantOptions): void {
        if (holdsXmlFragment(value.value)) {
            // an extension object the loader left as its XML: the node objects decode it once every
            // document is in; the store has no decoder yet, so the Variable waits for a value rather
            // than serve something a client cannot decode
            this.#deferredValues++;
            return;
        }
        const now = this.#loadTime;
        const dataType =
            (typeof value.dataType === "string" ? DataType[value.dataType as keyof typeof DataType] : value.dataType) ??
            DataType.Null;
        const isScalar = value.arrayType === undefined || value.arrayType === VariantArrayType.Scalar;
        const v = value.value;
        if (isScalar && (typeof v === "number" || typeof v === "boolean")) {
            this.#store.values.setScalar(i, dataType, v, 0, now, now);
        } else {
            this.#store.values.setObject(i, dataType, value, 0, now, now);
            this.#pendingValues++;
        }
    }

    /** values kept as objects (strings, arrays, structures) */
    public get objectValueCount(): number {
        return this.#pendingValues;
    }

    /** extension object values the document gave as XML, left unset (BadWaitingForInitialData) */
    public get deferredValueCount(): number {
        return this.#deferredValues;
    }
}

/** true when a value is, or holds, an extension object still in its XML form */
function holdsXmlFragment(value: unknown): boolean {
    if (value instanceof XmlExtensionObjectFragment) return true;
    return Array.isArray(value) && value.some((element) => element instanceof XmlExtensionObjectFragment);
}

function parseAccessLevel(text: string | undefined, absent: number): number {
    const value = parseInt(text || "", 10);
    return Number.isNaN(value) ? absent : value;
}

/** the AccessRestrictions attribute of the document: a number; absent or invalid inherits */
function parseAccessRestrictions(text: string | undefined): number | undefined {
    if (text === undefined || text === "") {
        return undefined;
    }
    const value = parseInt(text, 10);
    return Number.isNaN(value) ? undefined : value & 0xf;
}

/** what a compact address space is loaded through: the records go in, finish() once they are all in */
export interface CompactRecordConsumer extends NodesetRecordConsumer {
    finish(): { unresolved: number };
}

/**
 * the consumer a nodeset producer feeds to load a compact address space: the records written
 * into its store, the namespaces registered on it, and what the space derives from its columns
 * derived again at the end
 */
export function compactRecordConsumer(space: StoreAddressSpace, options: StoreRecordApplierOptions = {}): CompactRecordConsumer {
    const applier = new StoreRecordApplier(space.store, { indexOf: (uri) => space.namespaceIndexOf(uri) }, options);
    return {
        apply: (record) => applier.apply(record),
        finish: () => {
            const result = applier.finish();
            space.finishLoad();
            return result;
        }
    };
}
