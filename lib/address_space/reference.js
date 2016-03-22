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
 * @method _arrow
 * @private
 *
 * @example
 *       ---- some text ----->
 */
function _arrow(text,length,isForward) {

    length = Math.max(length,text.length+ 8);
    var nb = Math.floor((length  - text.length - 2)/2);
    var h = Array(nb).join('-');

    var extra = (text.length %2 === 1) ? "-" : "";

    if (isForward) {
        return extra + h + " "+ text +" "+  h + "> "
    }
    return '<'  + h +" "+  text +" "+  h + extra + " ";
}

function _w(str,width) {
    return (str + "                                         ").substr(0,width);
}

/**
 * turn reference into a arrow :   ---- REFERENCETYPE --> [NODEID]
 * @method toString
 * @return {String}
 */
Reference.prototype.toString = function (options) {

    var infoNode   = _w(this.nodeId.toString(),24);
    var refType    = this.referenceType.toString();

    if (options && options.addressSpace) {
        var node = options.addressSpace.findNode(this.nodeId);
        infoNode = "[" + infoNode  +"]" + _w(node.browseName.toString(),40) ;

        var ref = options.addressSpace.findReferenceType(this.referenceType);
        refType +=  "[" + ref.nodeId.toString()  +"]";
    }
    return _arrow(refType,40,this.isForward) + infoNode ;
};

Reference.prototype.__defineGetter__("hash",function() {

    if (!this.__hash) {
        this.__hash = (this.isForward ? "" : "!") + this.referenceType + "-" + this.nodeId.toString();
    }
    return this.__hash;
});

Reference.prototype.dispose = function() {
    this.__hash = null;
    this._referenceType =null;
    this.node = null;
    this.nodeId = null;
    this.referenceType = null;
};

exports.Reference = Reference;

function _resolveReferenceNode(addressSpace, reference) {
    if (!reference.node) {
        reference.node = addressSpace.findNode(reference.nodeId);
    }
    return reference.node;
}
Reference._resolveReferenceNode = _resolveReferenceNode;
function _resolveReferenceType(addressSpace, reference) {
    if (!reference._referenceType) {
        if (!reference.referenceType) {
            console.log("ERROR MISSING reference".red,reference)
        }
        reference._referenceType  =  addressSpace.findReferenceType(reference.referenceType);
    }
    return reference._referenceType;
}
Reference._resolveReferenceType = _resolveReferenceType;

