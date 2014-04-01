var util = require("util");
var Enum = require("enum");
var assert = require('better-assert');
var is_guid = require("./guid").is_guid;

var NodeIdType = new Enum({
    NUMERIC:          0x01,
    STRING:           0x02,
    GUID:             0x03,
    BYTESTRING:       0x04
});
exports.NodeIdType = NodeIdType;

/**
 * Construct a node ID
 * @param identifierType {NodeIdType}
 * @param value
 * @param namespace ( optional)
 * @constructor
 */
function NodeId(identifierType,value,namespace) {

    this.identifierType = NodeIdType.get(identifierType.value);
    assert(this.identifierType );
    this.value = value;
    this.namespace = namespace || 0 ;
}


NodeId.prototype.toString = function() {
    switch(this.identifierType) {
        case NodeIdType.NUMERIC:
            return "ns="+ this.namespace +";i="+this.value;
        case NodeIdType.STRING:
            return "ns="+ this.namespace +";s="+this.value+"";
        case NodeIdType.GUID:
            return "ns="+ this.namespace +";g="+this.value+"";
        default:
            assert(this.identifierType === NodeIdType.BYTESTRING,"invalid identifierType in NodeId : " +  this.identifierType);
            return "ns="+ this.namespace +";b="+this.value.toString("hex")+"";
    }
};
NodeId.prototype.toJSON = NodeId.prototype.toString;

exports.NodeId = NodeId;


/**
 * Convert a value into a nodeId:
 *    - if nodeId is a string of form : i=1234 => nodeId({ ns: 0 , value=1234})
 * @param value
 * @param namespace {integer}
 */

var rege_ns_i =/ns=([0-9]+)\;i=([0-9]+)/ ;
var rege_ns_s =/ns=([0-9]+)\;s=(.*)/ ;

function coerceNodeId(value,namespace){

    var matches;

    if (value instanceof NodeId) {
        return value;
    }

    value = value || 0;
    namespace = namespace || 0;

    var identifierType = NodeIdType.NUMERIC;

    if (typeof value === "string" ) {
        identifierType=  NodeIdType.STRING;
        if ( value.substr(0,2) === "i=" ) {

            identifierType = NodeIdType.NUMERIC;
            value = parseInt(value.substr(2),10);

        } else if ( value.substr(0,2) === "s=" ) {

            identifierType = NodeIdType.STRING;
            value = value.substr(2);

        } else if (is_guid(value)) {
            identifierType=  NodeIdType.GUID;

        } else if ( (matches = rege_ns_i.exec(value)) !== null)  {
            identifierType = NodeIdType.NUMERIC;
            namespace = parseInt(matches[1],10);
            value     = parseInt(matches[2],10);

        } else if ( (matches = rege_ns_s.exec(value)) !== null)  {
            identifierType = NodeIdType.STRING;
            namespace = parseInt(matches[1],10);
            value     = matches[2];
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
    if (typeof value === "string" ) {
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

ExpandedNodeId.prototype.toString = function() {
    return JSON.stringify(this);
};
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

    value = parseInt(value,10) || 0;
    namespace = namespace || 0;
    serverIndex = 0;
    namespaceUri = null;
    return  new ExpandedNodeId(NodeIdType.NUMERIC,value,namespace,namespaceUri,serverIndex);
};

var variables = require("./../lib/opcua_node_ids").VariableIds;
var objects   = require("./../lib/opcua_node_ids").ObjectIds;
var objectTypes   = require("./../lib/opcua_node_ids").ObjectTypeIds;
var variableTypes   = require("./../lib/opcua_node_ids").VariableTypeIds;
var methods     = require("./../lib/opcua_node_ids").MethodIds;

function resolveNodeId(node_or_string) {

    var nodeId;
    if(objects.hasOwnProperty(node_or_string)) {
        nodeId = resolveNodeId(objects[node_or_string],0);

    } else if(variables.hasOwnProperty(node_or_string)) {
        nodeId = resolveNodeId(variables[node_or_string],0);

    } else if(objectTypes.hasOwnProperty(node_or_string)) {
        nodeId = resolveNodeId(objectTypes[node_or_string],0);

    } else if(variableTypes.hasOwnProperty(node_or_string)) {
        nodeId = resolveNodeId(variableTypes[node_or_string],0);

    } else if(methods.hasOwnProperty(node_or_string)) {
        nodeId = resolveNodeId(methods[node_or_string],0);
    } else {
        nodeId = coerceNodeId(node_or_string);
    }

    return nodeId;
}

exports.resolveNodeId = resolveNodeId;

var _known_NodeIds = null;

NodeId.prototype.displayText = function()
{

    if (_known_NodeIds === null) {

        // build reverse index
        _known_NodeIds = {};
        function expand_map(reverse_index,direct_index) {
            for ( var name in direct_index ) {
                if (direct_index.hasOwnProperty(name)) {
                    var value = direct_index[name];
                    reverse_index[value] = name;
                }
            }
        }
        expand_map(_known_NodeIds,objects);
        expand_map(_known_NodeIds,objectTypes);
        expand_map(_known_NodeIds,variables);
        expand_map(_known_NodeIds,variableTypes);
        expand_map(_known_NodeIds,methods);
    }
    if (this.namespace === 0 ) {
        if (_known_NodeIds.hasOwnProperty(this.value)) {
            return  _known_NodeIds[this.value] + " (" + this.toString() +")";
        }
    }
    return this.toString();

};
