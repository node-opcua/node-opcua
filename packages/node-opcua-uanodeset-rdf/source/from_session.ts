/**
 * Collecting an `RdfModel` over a session.
 *
 * This is what makes a server exportable when its nodeset file is not available, which for a
 * vendor's own companion specification is often the only way to get the model into a graph store
 * at all.
 *
 * It is not the equal of `addressSpaceToRdfModel`, and the differences are not bugs to be fixed
 * later. OPC UA has no service that lists the nodes of a namespace, so the model is whatever a
 * crawl from Root reaches; `SymbolicName` is NodeSet2 metadata rather than an attribute, so it is
 * simply gone; and `NamespaceMetadataType` carries no list of required models, so the ontology
 * node has no `owl:imports` unless the caller supplies one. "What a session cannot tell you" in
 * `VOCABULARY.md` is the full list.
 */

import { AttributeIds, LocalizedText, NodeClass, QualifiedName } from "node-opcua-data-model";
import { coerceNodeId, type ExpandedNodeId, type NodeId, resolveNodeId } from "node-opcua-nodeid";
import {
    browseAll,
    type IBasicSessionBrowseAsyncMultiple,
    type IBasicSessionBrowseNextAsyncMultiple,
    type IBasicSessionReadAsyncMultiple
} from "node-opcua-pseudo-session";
import { BrowseDirection, type ReferenceDescription } from "node-opcua-service-browse";
import type { RdfModel, RdfNode } from "./model.js";

/**
 * what collecting a model asks of a session, written out rather than named.
 *
 * Three services and no more: browse, follow the continuation point a browse hands back, and read
 * attributes. Anything satisfying that will do, and both things that do are useful here: a
 * `ClientSession` against a real server, and a `PseudoSession` over an address space. Spelling the
 * intersection out is also what keeps `create`, `close`, subscriptions and the rest of a session's
 * surface out of the contract, so a caller can pass something far smaller than a session.
 */
export type RdfSession = IBasicSessionBrowseAsyncMultiple & IBasicSessionBrowseNextAsyncMultiple & IBasicSessionReadAsyncMultiple;

/** `Root`, where a crawl has to start, since nothing lists the nodes of a namespace */
const ROOT = resolveNodeId("RootFolder");
/** `Server_NamespaceArray` */
const NAMESPACE_ARRAY = resolveNodeId("Server_NamespaceArray");
/** `Server_Namespaces`, the folder of `NamespaceMetadataType` objects */
const NAMESPACES_FOLDER = coerceNodeId("i=11715");
/** `References`, so one browse per node covers every relation in both directions */
const REFERENCES = resolveNodeId("References");
/** BrowseName, NodeClass and TypeDefinition of each target, which is all the mapper needs to name it */
const RESULT_MASK = 0x3f;

/**
 * how many nodes to read attributes for at once.
 *
 * `browseAll` reads the server's own browse limits, but nothing here reads `MaxNodesPerRead`:
 * honouring a server's operation limits belongs in a client that specialises in it, not in a
 * bare exporter. This is a figure every server in practice accepts.
 */
const READ_CHUNK = 100;

function stubOf(reference: ReferenceDescription): RdfNode {
    return {
        nodeId: reference.nodeId,
        nodeClass: reference.nodeClass,
        browseName: reference.browseName,
        references: []
    };
}

/** the namespace array, which is the only thing that turns a uri into the index NodeIds use */
async function readNamespaceArray(session: RdfSession): Promise<string[]> {
    const [dataValue] = await session.read([{ nodeId: NAMESPACE_ARRAY, attributeId: AttributeIds.Value }]);
    const value = dataValue?.value?.value as string[] | undefined;
    if (!value?.length) {
        throw new Error("the server does not expose Server_NamespaceArray, so no namespace can be named");
    }
    return [...value];
}

/**
 * every node a crawl from Root reaches, with the references of those in the target namespace.
 *
 * References are kept only for the target namespace because they are all the mapper reads: for
 * any other node it asks for a name. That also bounds memory on a server whose base namespace is
 * far larger than the model being exported.
 */
async function crawl(session: RdfSession, targetIndex: number): Promise<{ nodes: RdfNode[]; known: Map<string, RdfNode> }> {
    const known = new Map<string, RdfNode>();
    const nodes: RdfNode[] = [];

    const rootReference = { nodeId: ROOT, nodeClass: NodeClass.Object, browseName: new QualifiedName({ name: "Root" }) };
    known.set(ROOT.toString(), { ...rootReference, references: [] });

    let frontier: NodeId[] = [ROOT];
    const visited = new Set<string>([ROOT.toString()]);

    while (frontier.length) {
        const results = await browseAll(
            session,
            frontier.map((nodeId) => ({
                nodeId,
                browseDirection: BrowseDirection.Both,
                referenceTypeId: REFERENCES,
                includeSubtypes: true,
                nodeClassMask: 0,
                resultMask: RESULT_MASK
            }))
        );

        const next: NodeId[] = [];
        for (let index = 0; index < frontier.length; index++) {
            const from = frontier[index];
            const references = results[index]?.references ?? [];
            const owner = known.get(from.toString());

            for (const reference of references) {
                const key = reference.nodeId.toString();
                if (!known.has(key)) known.set(key, stubOf(reference));
                if (owner && from.namespace === targetIndex) {
                    owner.references.push({
                        referenceTypeId: reference.referenceTypeId,
                        isForward: reference.isForward,
                        targetId: reference.nodeId
                    });
                }
                if (!visited.has(key) && reference.isForward) {
                    visited.add(key);
                    next.push(reference.nodeId);
                }
            }
            if (owner && from.namespace === targetIndex) {
                nodes.push(owner);
                // a node's own type definition is the target of its forward HasTypeDefinition
                // edge. ReferenceDescription.typeDefinition is the *target's* type, not this
                // node's, and reading it as this node's silently retypes half the model.
                const typeDefinition = references.find(
                    (reference) => reference.isForward && isHasTypeDefinition(reference)
                )?.nodeId;
                if (typeDefinition) owner.typeDefinition = typeDefinition;
                const supertype = references.find((reference) => !reference.isForward && isHasSubtype(reference));
                if (supertype) owner.subtypeOf = supertype.nodeId;
            }
        }
        frontier = next;
    }
    return { nodes, known };
}

const HAS_SUBTYPE = resolveNodeId("HasSubtype");
const HAS_TYPE_DEFINITION = resolveNodeId("HasTypeDefinition");
const isHasSubtype = (reference: ReferenceDescription) => reference.referenceTypeId.toString() === HAS_SUBTYPE.toString();
const isHasTypeDefinition = (reference: ReferenceDescription) =>
    reference.referenceTypeId.toString() === HAS_TYPE_DEFINITION.toString();

/**
 * the reference-type hierarchy, which `isHierarchical` walks and a stub does not carry.
 *
 * Reference types are few, and almost all of them belong to the base namespace, so this is a
 * handful of browses however large the model is.
 */
async function fillReferenceTypeChains(session: RdfSession, known: Map<string, RdfNode>): Promise<void> {
    const pending = () =>
        [...known.values()].filter((node) => node.nodeClass === NodeClass.ReferenceType && node.subtypeOf === undefined);

    let batch = pending();
    const asked = new Set<string>();
    while (batch.length) {
        const fresh = batch.filter((node) => !asked.has(node.nodeId.toString()));
        if (!fresh.length) return;
        for (const node of fresh) asked.add(node.nodeId.toString());

        const results = await browseAll(
            session,
            fresh.map((node) => ({
                nodeId: node.nodeId,
                browseDirection: BrowseDirection.Inverse,
                referenceTypeId: HAS_SUBTYPE,
                includeSubtypes: false,
                nodeClassMask: 0,
                resultMask: RESULT_MASK
            }))
        );
        for (let index = 0; index < fresh.length; index++) {
            const reference = results[index]?.references?.[0];
            if (!reference) continue;
            fresh[index].subtypeOf = reference.nodeId;
            const key = reference.nodeId.toString();
            if (!known.has(key)) known.set(key, stubOf(reference));
        }
        batch = pending();
    }
}

/** the attributes a node carries that no browse reports */
async function readAttributes(session: RdfSession, nodes: RdfNode[]): Promise<void> {
    type Wanted = { node: RdfNode; attributeId: AttributeIds };
    const wanted: Wanted[] = [];
    for (const node of nodes) {
        wanted.push({ node, attributeId: AttributeIds.Description });
        if (node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.VariableType) {
            wanted.push({ node, attributeId: AttributeIds.DataType });
            wanted.push({ node, attributeId: AttributeIds.ValueRank });
            wanted.push({ node, attributeId: AttributeIds.ArrayDimensions });
            wanted.push({ node, attributeId: AttributeIds.Value });
        }
        if (node.nodeClass === NodeClass.ReferenceType) {
            wanted.push({ node, attributeId: AttributeIds.Symmetric });
            wanted.push({ node, attributeId: AttributeIds.InverseName });
        }
    }

    for (let start = 0; start < wanted.length; start += READ_CHUNK) {
        const chunk = wanted.slice(start, start + READ_CHUNK);
        const dataValues = await session.read(chunk.map(({ node, attributeId }) => ({ nodeId: node.nodeId, attributeId })));
        for (let index = 0; index < chunk.length; index++) {
            const dataValue = dataValues[index];
            if (!dataValue?.statusCode.isGood()) continue;
            const { node, attributeId } = chunk[index];
            const value = dataValue.value?.value;
            switch (attributeId) {
                case AttributeIds.Description:
                    if (value instanceof LocalizedText && value.text) node.description = value;
                    break;
                case AttributeIds.DataType:
                    if (value) node.dataType = value as NodeId;
                    break;
                case AttributeIds.ValueRank:
                    if (typeof value === "number") node.valueRank = value;
                    break;
                case AttributeIds.ArrayDimensions:
                    if (value) node.arrayDimensions = Array.from(value as ArrayLike<number>);
                    break;
                case AttributeIds.Value:
                    if (dataValue.value) node.value = dataValue.value;
                    break;
                case AttributeIds.Symmetric:
                    node.symmetric = !!value;
                    break;
                case AttributeIds.InverseName:
                    if (value instanceof LocalizedText && value.text) node.inverseName = value;
                    break;
                default:
                    break;
            }
        }
    }
}

/**
 * the version and publication date a `NamespaceMetadataType` object states.
 *
 * There is no `RequiredModels` here to read: the type does not have one. That is why a
 * session-sourced ontology node carries no `owl:imports`.
 */
async function readNamespaceMetadata(
    session: RdfSession,
    namespaceUri: string
): Promise<{ version?: string; publicationDate?: Date }> {
    try {
        const folder = await browseAll(session, {
            nodeId: NAMESPACES_FOLDER,
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: REFERENCES,
            includeSubtypes: true,
            nodeClassMask: 0,
            resultMask: RESULT_MASK
        });
        const entry = folder.references?.find((reference) => reference.browseName.name === namespaceUri);
        if (!entry) return {};

        const properties = await browseAll(session, {
            nodeId: entry.nodeId,
            browseDirection: BrowseDirection.Forward,
            referenceTypeId: REFERENCES,
            includeSubtypes: true,
            nodeClassMask: 0,
            resultMask: RESULT_MASK
        });
        const find = (name: string) => properties.references?.find((reference) => reference.browseName.name === name)?.nodeId;
        const versionId = find("NamespaceVersion");
        const publicationId = find("NamespacePublicationDate");
        if (!versionId && !publicationId) return {};

        const dataValues = await session.read(
            [versionId, publicationId]
                .filter((nodeId): nodeId is ExpandedNodeId => !!nodeId)
                .map((nodeId) => ({ nodeId, attributeId: AttributeIds.Value }))
        );
        const out: { version?: string; publicationDate?: Date } = {};
        let cursor = 0;
        if (versionId) {
            const value = dataValues[cursor++]?.value?.value;
            if (typeof value === "string" && value) out.version = value;
        }
        if (publicationId) {
            const value = dataValues[cursor]?.value?.value;
            if (value instanceof Date) out.publicationDate = value;
        }
        return out;
    } catch {
        // a server without Server/Namespaces states no version, which is not an error for an export
        return {};
    }
}

/** the model a namespace of a server describes, as far as a session can see it */
export async function sessionToRdfModel(session: RdfSession, modelUri?: string): Promise<RdfModel> {
    const namespaceUris = await readNamespaceArray(session);
    const targetIndex = modelUri ? namespaceUris.indexOf(modelUri) : namespaceUris.length - 1;
    if (targetIndex < 0) {
        throw new Error(`the server holds no namespace ${modelUri}`);
    }
    const namespaceUri = namespaceUris[targetIndex];

    const { nodes, known } = await crawl(session, targetIndex);
    await fillReferenceTypeChains(session, known);
    await readAttributes(session, nodes);
    const metadata = await readNamespaceMetadata(session, namespaceUri);

    // a crawl reaches nodes in the order the hierarchy happens to lay them out, which is not an
    // order anyone chose. Sorting makes two exports of the same server comparable.
    nodes.sort((a, b) => a.nodeId.toString().localeCompare(b.nodeId.toString()));

    return {
        namespaceUris,
        target: { index: targetIndex, namespaceUri, version: metadata.version, publicationDate: metadata.publicationDate },
        nodes,
        resolve: (nodeId: NodeId) => known.get(nodeId.toString())
    };
}
