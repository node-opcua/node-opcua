/**
 * What the JSON-LD mapper needs to know about a model, and nothing more.
 *
 * The mapper used to read an `IAddressSpace` directly, which tied it to a source that answers
 * synchronously and at random. A session answers asynchronously and in batches, and rewriting the
 * mapper around `await` would have turned four passes over the nodes into thousands of round
 * trips. So collection and mapping are separated instead: a collector fills this structure, the
 * mapper reads it, and the mapper never awaits.
 *
 * The structure is deliberately close to what OPC UA can actually tell you about a node, since
 * one of its two collectors has only Browse and Read to work with.
 */

import type { LocalizedText, NodeClass, QualifiedName } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { Variant } from "node-opcua-variant";

/** one edge, in the direction the source states it */
export interface RdfReference {
    referenceTypeId: NodeId;
    isForward: boolean;
    targetId: NodeId;
}

/** a model the exporter names in its own right */
export interface RdfModelReference {
    modelUri: string;
    version?: string;
    publicationDate?: Date;
}

/**
 * one node.
 *
 * A node the exporter merely has to *name* (a supertype in another model, say) needs only
 * `nodeId`, `nodeClass` and `browseName`; the rest may be absent, and `references` may be empty.
 * Only the nodes of the exported namespace are filled in completely.
 */
export interface RdfNode {
    nodeId: NodeId;
    nodeClass: NodeClass;
    browseName: QualifiedName;
    references: RdfReference[];

    description?: LocalizedText;
    /**
     * NodeSet2 metadata, not an OPC UA attribute, so a session-sourced model never carries it.
     * See "What a session cannot tell you" in VOCABULARY.md.
     */
    symbolicName?: string;
    typeDefinition?: NodeId;

    /** Variable and VariableType */
    dataType?: NodeId;
    valueRank?: number;
    arrayDimensions?: number[] | null;
    value?: Variant;

    /** ReferenceType */
    inverseName?: LocalizedText;
    symmetric?: boolean;
    subtypeOf?: NodeId;
}

/** the namespace being exported, and what the ontology node says about it */
export interface RdfTarget {
    index: number;
    namespaceUri: string;
    version?: string;
    publicationDate?: Date;
    requiredModels?: RdfModelReference[];
}

/** everything the mapper reads */
export interface RdfModel {
    /** index to uri, as the source's own namespace array orders it */
    namespaceUris: string[];
    target: RdfTarget;
    /** the exported namespace's nodes, in the order they are written */
    nodes: RdfNode[];
    /**
     * any node the mapper may have to name, including nodes of other models.
     *
     * An address space answers this from itself on demand; a session collector has to have
     * fetched the answer already, which is why the return is a node rather than a promise.
     */
    resolve(nodeId: NodeId): RdfNode | undefined;
}
