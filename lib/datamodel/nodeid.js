/**
 * @module opcua.datamodel
 */

var util = require("util");
var Enum = require("enum");
var assert = require('better-assert');
var is_guid = require("./guid").is_guid;

/**
 * is an enumeration that specifies the possible types of a {@link NodeId} value.
 * @property NodeIdType
 * @attribute  NUMERIC nodeId is a numeric
 * @attribute  STRING nodeId is a String
 * @attribute  GUID nodeId is a  GUID
 * @attribute  BYTESTRING nodeId is a BytString or a Opaque blob
 */
var NodeIdType = new Enum({
    NUMERIC:          0x01,
    STRING:           0x02,
    GUID:             0x03,
    BYTESTRING:       0x04
});
exports.NodeIdType = NodeIdType;

/**
 * Construct a node ID
 *
 * @class NodeId
 * @param {NodeIdType}                identifierType   - the nodeID type
 * @param {Number|String|GUID|Buffer} value            - the node id value. The type of Value depends on identifierType.
 * @param {number}                    namespace        - the index of the related namespace (optional , default value = 0 )
 *
 * @example
 *
 *    ``` javascript
 *    var nodeId = new NodeId(NodeIdType.NUMERIC,123,1);
 *    ```
 * @constructor
 */
function NodeId(identifierType,value,namespace) {

    /**
     * @property  identifierType
     * @type { NodeIdType }
     */
    this.identifierType = NodeIdType.get(identifierType.value);
    assert(this.identifierType );
    /**
     * @property  value
     * @type  {*}
     */
    this.value = value;
    /**
     * @property namespace
     * @type {Number}
     */
    this.namespace = namespace || 0 ;
}


/**
 * get the string representation of the nodeID.
 *
 * @method toString
 * @example
 *
 *    ``` javascript
 *    var nodeid = new NodeId(NodeIdType.NUMERIC, 123,1);
 *    console.log(nodeid.toString());
 *    ```
 *
 *    ```
 *    >"ns=1;i=123"
 *    ```
 *
 * @return {string}
 */
NodeId.prototype.toString = function() {
    switch(this.identifierType) {
        case NodeIdType.NUMERIC:
            return "ns="+ this.namespace +";i="+this.value;
        case NodeIdType.STRING:
            return "ns="+ this.namespace +";s="+this.value;
        case NodeIdType.GUID:
            return "ns="+ this.namespace +";g="+this.value;
        default:
            assert(this.identifierType === NodeIdType.BYTESTRING,"invalid identifierType in NodeId : " +  this.identifierType);
            return "ns="+ this.namespace +";b="+this.value.toString("hex");
    }
};


/**
 * convert nodeId to a JSON string. same as {@link NodeId#toString }
 * @method  toJSON
 * @return {String}
 */
NodeId.prototype.toJSON = NodeId.prototype.toString;

exports.NodeId = NodeId;


var rege_ns_i =/ns=([0-9]+)\;i=([0-9]+)/ ;
var rege_ns_s =/ns=([0-9]+)\;s=(.*)/ ;
var rege_ns_b =/ns=([0-9]+)\;b=(.*)/ ;
var rege_ns_g =/ns=([0-9]+)\;g=(.*)/ ;


/**
 * Convert a value into a nodeId:
 * @method coerceNodeId
 *
 * @description:
 *    - if nodeId is a string of form : "i=1234" => nodeId({ namespace: 0 , value=1234  , identifierType: NodeIdType.NUMERIC})
 *    - if nodeId is a string of form : "s=foo"  => nodeId({ namespace: 0 , value="foo" , identifierType: NodeIdType.STRING})
 *    - if nodeId is a {@link NodeId} :  coerceNodeId returns value
 *
 * @param value
 * @param namespace {Integer}
 */
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

        } else if ( value.substr(0,2) === "b=" ) {

            identifierType = NodeIdType.BYTESTRING;
            value = new Buffer(value.substr(2),"hex");

        } else if ( value.substr(0,2) === "g=" ) {

            identifierType = NodeIdType.GUID;
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

        } else if ( (matches = rege_ns_b.exec(value)) !== null)  {
            identifierType = NodeIdType.BYTESTRING;
            namespace = parseInt(matches[1],10);
            value     = new Buffer(matches[2],"hex");

        } else if ( (matches = rege_ns_g.exec(value)) !== null)  {
            identifierType = NodeIdType.GUID;
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


/**
 * construct a node Id from a value and a namespace.
 * @method makeNodeId
 * @param {string|buffer} value
 * @param namespace
 * @return {NodeId}
 */
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


/**
 * An ExpandedNodeId extends the NodeId structure.
 *
 * An ExpandedNodeId extends the NodeId structure by allowing the NamespaceUri to be
 * explicitly specified instead of using the NamespaceIndex. The NamespaceUri is optional. If it
 * is specified then the NamespaceIndex inside the NodeId shall be ignored.
 *
 * The ExpandedNodeId is encoded by first encoding a NodeId as described in Clause 5 .2.2.9
 * and then encoding NamespaceUri as a String.
 *
 * An instance of an ExpandedNodeId may still use the NamespaceIndex instead of the
 * NamespaceUri. In this case, the NamespaceUri is not encoded in the stream. The presence of
 * the NamespaceUri in the stream is indicated by setting the NamespaceUri flag in the encoding
 * format byte for the NodeId.
 *
 * If the NamespaceUri is present then the encoder shall encode the NamespaceIndex as 0 in
 * the stream when the NodeId portion is encoded. The unused NamespaceIndex is included in
 * the stream for consistency,
 *
 * An ExpandedNodeId may also have a ServerIndex which is encoded as a UInt32 after the
 * NamespaceUri. The ServerIndex flag in the NodeId encoding byte indicates whether the
 * ServerIndex is present in the stream. The ServerIndex is omitted if it is equal to zero.
 *
 * @class  ExpandedNodeId
 * @extends NodeId
 *
 *
 *
 * @param {NodeIdType}                identifierType   - the nodeID type
 * @param {Number|String|GUID|Buffer} value            - the node id value. The type of Value depends on identifierType.
 * @param {number}                    namespace        - the index of the related namespace (optional , default value = 0 )
 * @param {String|null}               namespaceUri     - NamespaceUri
 * @param {UInt32|null}               serverIndex      - the server Index
 * @constructor
 */
function ExpandedNodeId(identifierType,value,namespace,namespaceUri,serverIndex) {
    NodeId.apply(this,arguments);
    this.namespaceUri = namespaceUri;
    this.serverIndex = serverIndex || 0 ;
}
util.inherits(ExpandedNodeId,NodeId);
exports.ExpandedNodeId = ExpandedNodeId;

/**
 * @method toString
 * @return {string}
 */
ExpandedNodeId.prototype.toString = function() {
    return JSON.stringify(this);
};

/**
 * @method  makeExpandedNodeId
 * @param value
 * @param namespace
 * @return {ExpandedNodeId}
 */
exports.makeExpandedNodeId = function makeExpandedNodeId(value,namespace) {

    value = parseInt(value,10) || 0;
    namespace = namespace || 0;
    serverIndex = 0;
    namespaceUri = null;
    return  new ExpandedNodeId(NodeIdType.NUMERIC,value,namespace,namespaceUri,serverIndex);
};

var variables = require("./../opcua_node_ids").VariableIds;
var objects   = require("./../opcua_node_ids").ObjectIds;
var objectTypes   = require("./../opcua_node_ids").ObjectTypeIds;
var variableTypes   = require("./../opcua_node_ids").VariableTypeIds;
var methods     = require("./../opcua_node_ids").MethodIds;

/**
 * @method resolveNodeId
 * @param node_or_string
 * @return {*}
 */
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

/**
 * @class NodeId
 * @method displayText
 * @return {String}
 */
NodeId.prototype.displayText = function() {

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
