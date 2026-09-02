/**
 * @module node-opcua-address-space
 *
 * The loader's intermediate form. A NodeSet2 document, whatever it comes from (XML, an image),
 * is a stream of records: one header, then one record per node. A producer makes records, a
 * consumer applies them; the parse of the XML and the mutation of the address space are no
 * longer one and the same pass.
 *
 * Ids are untranslated: a `NodeId` or `QualifiedName` in a record carries the namespace index
 * of the **file's own namespace table** (0 = `http://opcfoundation.org/UA/`, then the
 * `<NamespaceUris>` entries in order), never the target address space's. The consumer that
 * applies the records owns the translation. Ids also sit inside values (NodeId and
 * QualifiedName variants, the `dataType` of an `Argument`), hence objects rather than tuples in
 * memory; the tuple form is the serialization of the precompiled image.
 */
import type { RequiredModel } from "node-opcua-address-space-base";
import type { NodeClass, QualifiedName } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { VariantOptions } from "node-opcua-variant";
import type { EnumFieldOptions, StructureFieldOptions } from "node-opcua-xml2json";

/** bumped whenever the record shape changes; the precompiled image carries it */
export const NODESET_RECORD_SCHEMA = 1;

export interface NodesetModelRecord {
    modelUri: string;
    version: string;
    publicationDate?: Date;
    requiredModels: RequiredModel[];
    symbolicName?: string;
    accessRestrictions?: string;
}

/** the first record of a document: what the loader needs before any node */
export interface NodesetHeaderRecord {
    kind: "header";
    namespaceUris: string[];
    models: NodesetModelRecord[];
    /** alias name to the id it stands for, file-local; no record refers to an alias by name */
    aliases: Record<string, NodeId>;
}

export interface NodesetReferenceRecord {
    isForward: boolean;
    referenceType: NodeId;
    nodeId: NodeId;
}

export interface NodesetRolePermissionRecord {
    roleId: NodeId;
    permissions: number;
}

export type NodesetDefinitionField = Omit<StructureFieldOptions, "dataType"> & EnumFieldOptions & { dataType?: NodeId | null };

export interface NodesetDataTypeDefinitionRecord {
    name?: string;
    isUnion?: boolean;
    fields: NodesetDefinitionField[];
}

/**
 * an extension object the reader could not decode on the spot: its XML body waits in the value
 * until the data types are known, then a consumer decodes it
 */
export class XmlExtensionObjectFragment {
    constructor(
        /** the "Default XML" encoding id of the type, file-local */
        public readonly typeId: NodeId,
        public readonly bodyXML: string
    ) {}
}

/** one node of the document; every attribute the XML reader reads, none applied */
export interface NodesetNodeRecord {
    kind: "node";
    nodeClass: NodeClass;
    nodeId: NodeId;
    browseName: QualifiedName;
    displayName?: string;
    description?: string;
    references: NodesetReferenceRecord[];
    releaseStatus?: "Draft" | "Deprecated";
    symbolicName?: string;
    /** the access policy as declared, whatever the loader options; the consumer applies its options */
    accessRestrictions?: string;
    hasNoPermissions?: boolean;
    rolePermissions?: NodesetRolePermissionRecord[];
    // types
    isAbstract?: boolean;
    // objects and object types
    eventNotifier?: number;
    // reference types
    inverseName?: string;
    symmetric?: boolean;
    // views
    containsNoLoops?: boolean;
    // variables, variable types and methods
    parentNodeId?: NodeId | null;
    // variables and variable types
    dataType?: NodeId | null;
    valueRank?: number;
    arrayDimensions?: number[] | null;
    minimumSamplingInterval?: number;
    historizing?: boolean;
    accessLevel?: string;
    userAccessLevel?: string;
    /**
     * the value as the reader produced it, ids file-local; an ExtensionObject value may hold
     * {@link XmlExtensionObjectFragment} placeholders, scalar or as array elements
     */
    value?: VariantOptions;
    // methods
    methodDeclarationId?: NodeId | null;
    // data types
    definition?: NodesetDataTypeDefinitionRecord;
}

export type NodesetRecord = NodesetHeaderRecord | NodesetNodeRecord;

/**
 * the bytes of source a producer consumed to emit a record, stamped on the record under a
 * symbol so that it is never serialized; a consumer sums them to pace its yields
 */
export const recordBytes = Symbol("recordBytes");
export type NodesetRecordWithBytes = NodesetRecord & { [recordBytes]?: number };

export type NodesetRecordProducer = AsyncIterable<NodesetRecord>;

export interface NodesetRecordConsumer {
    /** one record, in document order, the header first */
    apply(record: NodesetRecord): void;
}
