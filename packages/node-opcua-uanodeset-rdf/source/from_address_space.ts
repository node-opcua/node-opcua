/**
 * Collecting an `RdfModel` from a loaded address space.
 *
 * This is the complete source: an address space retains the NodeSet2 metadata that OPC UA has no
 * attribute for, so an export taken this way is the reference against which a session-sourced one
 * is judged.
 *
 * Foreign nodes are converted lazily. The mapper names supertypes, reference types and type
 * definitions belonging to models this one only imports, and there is no point walking all of
 * `Opc.Ua` to find the handful it actually asks for.
 */

import type { BaseNode, IAddressSpace, UAReferenceType, UAVariable } from "node-opcua-address-space";
import { NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { RdfModel, RdfModelReference, RdfNode } from "./model.js";

/** the shape of a namespace this collector reads, which `INamespace` satisfies structurally */
interface NamespaceLike {
    namespaceUri: string;
    version?: string;
    publicationDate?: Date;
    index: number;
    nodeIterator(): IterableIterator<BaseNode>;
    getRequiredModels?(): RdfModelReference[] | undefined;
}

/**
 * one node.
 *
 * `full` is false for a node the exporter only has to name. Skipping the value read there is not
 * an optimisation for its own sake: reading a value can be expensive, or fail, on a node this
 * document never describes.
 */
function toRdfNode(node: BaseNode, full: boolean): RdfNode {
    const out: RdfNode = {
        nodeId: node.nodeId,
        nodeClass: node.nodeClass,
        browseName: node.browseName,
        references: node.allReferences().map((reference) => ({
            referenceTypeId: reference.referenceType,
            isForward: reference.isForward,
            targetId: reference.nodeId
        }))
    };

    const typeDefinition = (node as { typeDefinitionObj?: BaseNode }).typeDefinitionObj?.nodeId;
    if (typeDefinition) out.typeDefinition = typeDefinition;
    const supertype = (node as { subtypeOfObj?: BaseNode }).subtypeOfObj?.nodeId;
    if (supertype) out.subtypeOf = supertype;
    if (node.description?.text) out.description = node.description;

    if (node.nodeClass === NodeClass.ReferenceType) {
        const referenceType = node as UAReferenceType;
        out.symmetric = !!(referenceType as { symmetric?: boolean }).symmetric;
        if (referenceType.inverseName) out.inverseName = referenceType.inverseName;
    }

    if (!full) return out;

    const symbolicName = (node as { symbolicName?: string }).symbolicName;
    if (symbolicName) out.symbolicName = symbolicName;

    if (node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.VariableType) {
        const variable = node as UAVariable;
        if (variable.dataType) out.dataType = variable.dataType;
        if (variable.valueRank !== undefined) out.valueRank = variable.valueRank;
        if (variable.arrayDimensions) out.arrayDimensions = variable.arrayDimensions;
        try {
            const dataValue = variable.readValue();
            if (dataValue?.value) out.value = dataValue.value;
        } catch {
            // a value that cannot be read contributes none, which is not an error for an export
        }
    }
    return out;
}

/** the model a namespace of an address space describes */
export function addressSpaceToRdfModel(addressSpace: IAddressSpace, modelUri?: string): RdfModel {
    const namespaces = addressSpace.getNamespaceArray() as unknown as NamespaceLike[];
    const target = modelUri ? namespaces.find((n) => n.namespaceUri === modelUri) : namespaces[namespaces.length - 1];
    if (!target) {
        throw new Error(`the address space holds no namespace ${modelUri}`);
    }

    const cache = new Map<string, RdfNode>();
    const nodes: RdfNode[] = [];
    for (const node of namespaces[target.index].nodeIterator()) {
        const converted = toRdfNode(node, true);
        cache.set(node.nodeId.toString(), converted);
        nodes.push(converted);
    }

    return {
        namespaceUris: namespaces.map((n) => n.namespaceUri),
        target: {
            index: target.index,
            namespaceUri: target.namespaceUri,
            version: target.version,
            publicationDate: target.publicationDate,
            requiredModels: target.getRequiredModels?.()
        },
        nodes,
        resolve(nodeId: NodeId): RdfNode | undefined {
            const key = nodeId.toString();
            const known = cache.get(key);
            if (known) return known;
            const found = addressSpace.findNode(nodeId);
            if (!found) return undefined;
            const converted = toRdfNode(found, false);
            cache.set(key, converted);
            return converted;
        }
    };
}
