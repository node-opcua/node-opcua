/**
 * @module node-opcua-address-space
 */
import { assert } from "node-opcua-assert";
import { NodeId, sameNodeId } from "node-opcua-nodeid";
import { AddReferenceOpts, BaseNode, UAReference } from "..";

/**
 * asserts that the provided reference exists in the node references
 *
 * @method assertHasMatchingReference
 *
 * @param node
 * @param reference (Reference}
 * @param reference.referenceType {String}
 * @param reference.nodeId        {NodeId}
 * @param reference.isForward     {Boolean}
 *
 * @example:
 *
 *     assertHasMatchingReference(node,{ referenceType: "Organizes",i sForward:true, nodeId: "ns=1,i=12" });
 *
 *
 */
export function assertHasMatchingReference(node: BaseNode, reference: AddReferenceOpts): void {
    const addressSpace = node.addressSpace;

    const normalizedReference = addressSpace.normalizeReferenceType(reference);
    assert(normalizedReference.referenceType instanceof NodeId);

    let refs = node.findReferences(normalizedReference.referenceType, normalizedReference.isForward);

    refs = refs.filter((ref: UAReference) => {
        return sameNodeId(ref.nodeId, normalizedReference.nodeId);
    });

    const dispOpts = { addressSpace };

    if (refs.length !== 1) {
        throw new Error(" Cannot find reference " + JSON.stringify(normalizedReference));
    }
    assert(refs.length === 1);
}
