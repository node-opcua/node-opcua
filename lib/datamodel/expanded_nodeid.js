"use strict";
/* global: Buffer */
/**
 * @module opcua.datamodel
 */
require("requirish")._(module);
var util = require("util");

var NodeId = require("lib/datamodel/nodeid").NodeId;
var NodeIdType = require("lib/datamodel/nodeid").NodeIdType;

var _ = require("underscore");
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
 * @param {Number}                    namespace        - the index of the related namespace (optional , default value = 0 )
 * @param {String|null}               namespaceUri     - NamespaceUri
 * @param {UInteger32|null}               serverIndex      - the server Index
 * @constructor
 */
function ExpandedNodeId(identifierType, value, namespace, namespaceUri, serverIndex) {
    NodeId.apply(this, arguments);
    this.namespaceUri = namespaceUri || null;
    this.serverIndex = serverIndex || 0;
}
util.inherits(ExpandedNodeId, NodeId);
exports.ExpandedNodeId = ExpandedNodeId;

/**
 * @method toString
 * @return {string}
 */
ExpandedNodeId.prototype.toString = function () {

    var str = NodeId.prototype.toString.call(this);
    if (this.namespaceUri) {
        str += ";namespaceUri:" + this.namespaceUri;
    }
    if (this.serverIndex) {
        str += ";serverIndex:" + this.serverIndex;
    }
    return str;
};


/**
 * convert nodeId to a JSON string. same as {@link NodeId#toString }
 * @method  toJSON
 * @return {String}
 */
ExpandedNodeId.prototype.toJSON = function () {
    return this.toString();
};


var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;
function coerceExpandedNodeId(value) {
    var n = coerceNodeId(value);
    return new ExpandedNodeId(n.identifierType, n.value, n.namespace, /*namespaceUri*/null, /*serverIndex*/0)

}
exports.coerceExpandedNodeId = coerceExpandedNodeId;

/**
 * @method  makeExpandedNodeId
 * @param  value {ExpandedNodeId|NodeId|Integer}
 * @param [namespace=0] {Integer} the namespace
 * @return {ExpandedNodeId}
 */
exports.makeExpandedNodeId = function makeExpandedNodeId(value, namespace) {

    if (value === undefined && namespace === undefined) {
        return new ExpandedNodeId(NodeIdType.NUMERIC, 0, 0, null, 0);
    }
    var serverIndex = 0, n;
    var namespaceUri = null;

    if (value instanceof ExpandedNodeId) {
        // construct from a ExpandedNodeId => copy
        n = value;
        return new ExpandedNodeId(n.identifierType, n.value, n.namespace, n.namespaceUri, n.serverIndex);
    }
    if (value instanceof NodeId) {
        // construct from a nodeId
        n = value;
        return new ExpandedNodeId(n.identifierType, n.value, n.namespace, namespaceUri, serverIndex);
    }

    var valueInt = parseInt(value, 10);
    if (!_.isFinite(valueInt)) {
        throw new Error(" cannot makeExpandedNodeId out of " + value);
    }
    namespace = namespace || 0;
    return new ExpandedNodeId(NodeIdType.NUMERIC, valueInt, namespace, namespaceUri, serverIndex);
};
