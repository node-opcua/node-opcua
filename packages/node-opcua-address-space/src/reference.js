
const assert = require("node-opcua-assert").assert;

const utils = require("node-opcua-utils");
const NodeId = require("node-opcua-nodeid").NodeId;

function isNodeIdString(str) {
    assert(typeof str === "string");
    return str.substring(0, 2) === "i=" || str.substring(0, 3) === "ns=";
}

function is_valid_reference(ref) {
    const hasRequestedProperties = ref.hasOwnProperty("referenceType") &&
        ref.hasOwnProperty("nodeId") &&
        !utils.isNullOrUndefined(ref.isForward);

    if (!hasRequestedProperties) {
        return false;
    }

    assert(ref.referenceType instanceof NodeId);
    assert(!ref.referenceTypeName || typeof ref.referenceTypeName === "string");
    //xx // referenceType shall no be a nodeId string (this could happen by mistake)
    //xx assert(!isNodeIdString(ref.referenceType));
    return true;
}
/**
 * @class Reference
 * @param options.referenceType {NodeId}
 * @param options.nodeId        {NodeId}
 * @param options.isForward     {Boolean}
 * @constructor
 */
function Reference(options) {
    assert(options.referenceType instanceof NodeId);
    assert(options.nodeId instanceof NodeId);
    this.referenceType = options.referenceType;
    this.isForward = options.isForward;
    this.nodeId = options.nodeId;
    this._referenceType = options._referenceType;
    this.node = options.node;
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
    const nb = Math.floor((length  - text.length - 2)/2);
    const h = Array(nb).join('-');

    const extra = (text.length %2 === 1) ? "-" : "";

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

    let infoNode   = _w(this.nodeId.toString(),24);
    let refType    = this.referenceType.toString();

    if (options && options.addressSpace) {
        const node = options.addressSpace.findNode(this.nodeId);
        infoNode = "[" + infoNode  +"]" + _w(node.browseName.toString(),40) ;

        const ref = options.addressSpace.findReferenceType(this.referenceType);
        refType +=  "[" + ref.nodeId.toString()  +"]";
    }
    return _arrow(refType,40,this.isForward) + infoNode ;
};

Reference.prototype.__defineGetter__("hash",function() {

    if (!this.__hash) {
        this.__hash = (this.isForward ? "" : "!") + this.referenceType.toString() + "-" + this.nodeId.toString();
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

