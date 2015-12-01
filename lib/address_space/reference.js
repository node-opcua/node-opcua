require("requirish")._(module);
var assert = require("better-assert");

var utils = require("lib/misc/utils");


function isNodeIdString(str) {
    assert(typeof str === "string");
    return str.substring(0, 2) === "i=" || str.substring(0, 3) === "ns=";
}

function is_valid_reference(ref) {
    var hasRequestedProperties = ref.hasOwnProperty("referenceType") &&
        ref.hasOwnProperty("nodeId") &&
        !utils.isNullOrUndefined(ref.isForward);

    if (!hasRequestedProperties) {
        return false;
    }
    assert(typeof ref.referenceType === "string");

    // referenceType shall no be a nodeId string (this could happen by mistake)
    assert(!isNodeIdString(ref.referenceType));
    return true;
}
/**
 * @class Reference
 * @param options.referenceType {String}
 * @param options.nodeId {NodeId}
 * @param options.isForward {Boolean}
 * @constructor
 */
function Reference(options) {
    this.referenceType = options.referenceType;
    this.isForward = options.isForward;
    this.nodeId = options.nodeId;
    assert(is_valid_reference(this));
}

/**
 *  ---- some text ----->
 */
function _arrow(text,length,isForward) {

    length = Math.max(length,text.length+ 8);
    var nb = Math.floor((length  - text.length )/2);
    var h = Array(nb).join('-');
    if (isForward) {
        return h + " "+ text +" "+  h + "> "
    }
    return '<'  + h +" "+  text +" "+  h + " ";
}

/**
 * turn reference into a arrow :   ---- REFERENCETYPE --> [NODEID]
 * @method toString
 * @return {String}
 */
Reference.prototype.toString = function (options) {

    var node    = this.nodeId.toString();
    var refType = this.referenceType.toString();

    if (options && options.addressSpace) {
        var obj = options.addressSpace.findObject(this.nodeId);
        node = obj.browseName.toString() + "[" + node  +"]";

        var ref = options.addressSpace.findReferenceType(this.referenceType);
        refType +=  "[" + ref.nodeId.toString()  +"]";
    }
    return _arrow(refType,40,this.isForward) + node ;
};

exports.Reference = Reference;
