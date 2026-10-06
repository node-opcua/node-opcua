/**
 * @module node-opcua-address-space
 *
 * The nodeset records written straight into a compact store: no node object is created.
 * Same producer as the object applier (NodesetRecordApplier), other sink.
 */
import { type CompactStore, NO_NODE } from "node-opcua-address-space-store";
import { makeAccessLevelFlag, NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { DataType, VariantArrayType, type VariantOptions } from "node-opcua-variant";
import type { NodesetHeaderRecord, NodesetNodeRecord, NodesetRecord, NodesetRecordConsumer } from "./nodeset_record.js";

const UA_NAMESPACE_URI = "http://opcfoundation.org/UA/";

/** who hands out namespace indexes: the address space, or a plain table in a test */
export interface NamespaceRegistry {
    /** the index of a namespace, registering it when it is new */
    indexOf(namespaceUri: string): number;
}

export class StoreRecordApplier implements NodesetRecordConsumer {
    // per document: the file's namespace table to the store's
    #table: number[] = [];
    #headerSeen = false;
    #nodeCount = 0;
    #pendingValues = 0;
    // a type definition or data type declared before its node exists: set at finish()
    #deferredTypeDefinitions: [number, NodeId][] = [];
    #deferredDataTypes: [number, NodeId][] = [];
    readonly #store: CompactStore;
    readonly #namespaces: NamespaceRegistry;
    readonly #loadTime = Date.now();

    constructor(store: CompactStore, namespaces: NamespaceRegistry) {
        this.#store = store;
        this.#namespaces = namespaces;
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
        this.#deferredTypeDefinitions = [];
        this.#deferredDataTypes = [];
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
            accessLevel: record.accessLevel === undefined ? undefined : makeAccessLevelFlag(record.accessLevel),
            userAccessLevel: record.userAccessLevel === undefined ? undefined : makeAccessLevelFlag(record.userAccessLevel),
            minimumSamplingInterval: record.minimumSamplingInterval,
            historizing: record.historizing,
            eventNotifier: record.eventNotifier,
            isAbstract: record.isAbstract
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
        if (record.value && (record.nodeClass === NodeClass.Variable || record.nodeClass === NodeClass.VariableType)) {
            this.#applyValue(i, record.value);
        }
    }

    #applyValue(i: number, value: VariantOptions): void {
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

    /** values kept as objects (strings, arrays, extension objects, deferred XML fragments) */
    public get objectValueCount(): number {
        return this.#pendingValues;
    }
}
