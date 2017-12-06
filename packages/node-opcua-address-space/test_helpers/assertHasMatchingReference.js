var assert = require("node-opcua-assert");


var Reference = require("../src/reference").Reference;
var sameNodeId = require("node-opcua-nodeid").sameNodeId;

/**
 * asserts that the provided reference exists in the node references
 *
 * @function assertHasMatchingReference
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
function assertHasMatchingReference(node, reference) {

    var addressSpace = node.addressSpace;

    var normalizedReference = addressSpace.normalizeReferenceType(reference);
    assert(typeof normalizedReference.referenceType === "string");

    var refs = node.findReferences(normalizedReference.referenceType,normalizedReference.isForward);

    refs = refs.filter(function(ref){
        return sameNodeId(ref.nodeId,normalizedReference.nodeId);
    });

    var dispOpts = { addressSpace: addressSpace};

    if (refs.length !== 1) {
        throw new Error(" Cannot find reference " + ( new Reference(normalizedReference).toString(dispOpts)) );
    }
    assert(refs.length === 1);

}
module.exports = assertHasMatchingReference;
