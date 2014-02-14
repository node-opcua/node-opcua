var util = require("util");
var Enum = require("enum");
var assert = require("assert");

var is_guid = require("./guid").is_guid;

var NodeIdType = new Enum({
    NUMERIC:          0x01,
    STRING:           0x02,
    GUID:             0x03,
    BYTESTRING:       0x04
});
exports.NodeIdType = NodeIdType;

function NodeId(identifierType,value,namespace) {
    this.identifierType =identifierType;
    this.value = value;
    this.namespace = namespace;
}

var re = new RegExp("\"", 'g');

NodeId.prototype.toString = function() {
    switch(this.identifierType) {
        case NodeIdType.NUMERIC:
            return "ns="+ this.namespace +";i="+this.value;
            break;
        case NodeIdType.STRING:
            return "ns="+ this.namespace +";s='"+this.value+"'";
            break;
        case NodeIdType.GUID:
            return "ns="+ this.namespace +";g='"+this.value+"'";
            break;
        case NodeIdType.BYTESTRING:
            return "ns="+ this.namespace +";b="+toHex(this.value)+"";
            break;
        default:
            return JSON.stringify(this).replace(re,"");
    }
};


/**
 * Convert a value into a nodeId:
 *    - if nodeId is a string of form : i=1234 => nodeId({ ns: 0 , value=1234})
 * @param value
 * @param namespace {integer}
 */
function coerceNodeId(value,namespace){

    if (value instanceof NodeId) {
        return value;
    }

    value = value || 0;
    namespace = namespace || 0;
    var identifierType = NodeIdType.NUMERIC;

    if (typeof value == "string" ) {
        identifierType=  NodeIdType.STRING;
        if ( value.substr(0,2) === "i=" ) {

            identifierType = NodeIdType.NUMERIC;
            value = parseInt(value.substr(2));

        } else if (is_guid(value)) {
            identifierType=  NodeIdType.GUID;
        } else {
            identifierType = NodeIdType.NUMERIC;
            var r = /ns=([0-9]+)\;i=([0-9]+)/ ;
            var matches = r.exec(value);
            if (matches) {
                namespace = parseInt(matches[1]);
                value     = parseInt(matches[2]);
            }
        }

    } else  if ( value instanceof Buffer) {
        identifierType=  NodeIdType.BYTESTRING;

    } else if (value instanceof Object) {

        var tmp= value;
        value = tmp.value;
        namespace = namespace ||  tmp.namespace;
        identifierType = tmp.identifierTypes;
        return NodeId(value,namespace);
    }
    return new NodeId(identifierType,value,namespace);
}
exports.coerceNodeId = coerceNodeId;



var makeNodeId = function makeNodeId(value,namespace) {

    value = value || 0;
    namespace = namespace || 0;

    var identifierType = NodeIdType.NUMERIC;
    if (typeof value == "string" ) {
        //            1         2         3
        //  012345678901234567890123456789012345
        // "72962B91-FA75-4AE6-8D28-B404DC7DAF63"
        if (is_guid(value)) {
            identifierType=  NodeIdType.GUID;
        } else {
            identifierType=  NodeIdType.STRING;
        }

    } else  if ( value instanceof Buffer) {
        identifierType=  NodeIdType.BYTESTRING;
    }

    var nodeId = new NodeId(identifierType,value,namespace);

    assert(nodeId.hasOwnProperty("identifierType"));

    return nodeId;
};

exports.makeNodeId = makeNodeId;


function ExpandedNodeId(identifierType,value,namespace,namespaceUri,serverIndex) {
    NodeId.apply(this,arguments);
    this.namespaceUri = namespaceUri;
    this.serverIndex = serverIndex;
}
util.inherits(ExpandedNodeId,NodeId);
exports.ExpandedNodeId = ExpandedNodeId;

//------
// An ExpandedNodeId extends the NodeId structure by allowing the NamespaceUri to be
// explicitly specified instead of using the NamespaceIndex. The NamespaceUri is optional. If it
// is specified then the NamespaceIndex inside the NodeId shall be ignored.
//
// The ExpandedNodeId is encoded by first encoding a NodeId as described in Clause 5 .2.2.9
// and then encoding NamespaceUri as a String.
//
// An instance of an ExpandedNodeId may still use the NamespaceIndex instead of the
// NamespaceUri. In this case, the NamespaceUri is not encoded in the stream. The presence of
// the NamespaceUri in the stream is indicated by setting the NamespaceUri flag in the encoding
// format byte for the NodeId.
//
// If the NamespaceUri is present then the encoder shall encode the NamespaceIndex as 0 in
// the stream when the NodeId portion is encoded. The unused NamespaceIndex is included in
// the stream for consistency,
//
// An ExpandedNodeId may also have a ServerIndex which is encoded as a UInt32 after the
// NamespaceUri. The ServerIndex flag in the NodeId encoding byte indicates whether the
// ServerIndex is present in the stream. The ServerIndex is omitted if it is equal to zero.
//
exports.makeExpandedNodeId = function makeExpandedNodeId(value,namespace) {

    value = parseInt(value) || 0;
    namespace = namespace || 0;
    serverIndex = 0;
    namespaceUri = null;
    return  new ExpandedNodeId(NodeIdType.NUMERIC,value,namespace,namespaceUri,serverIndex);
};