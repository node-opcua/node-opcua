var assert = require("better-assert");
require("requirish")._(module);

var Reference = require("lib/address_space/reference").Reference;

/**
 * findMatchingReference
 * @param node
 * @param options
 *
 * @example:
 *
 *     findMatchingReference(node,{ referenceType: "Organizes",i sForward:true, nodeId: "ns=1,i=12");
 *
 *
 */
function assertHasMatchingReference(node, options) {

    var addressSpace = node.__address_space;

    var options2 = addressSpace.normalizeReferenceType(options);

    assert(typeof options2.referenceType === "string");
    var refs = node.findReferences(options2.referenceType,options2.isForward);

    refs = refs.filter(function(ref){
        return ref.nodeId === options2.nodeId;
    });

    var dispOpts = { addressSpace: addressSpace};

    if (refs.length !== 1) {
        throw new Error(" Cannot find reference " + ( new Reference(options2).toString(dispOpts)) );
    }
    assert(refs.length === 1);

}
module.exports = assertHasMatchingReference;
