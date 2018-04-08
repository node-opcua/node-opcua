"use strict";

var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
var BrowseDescription = require("node-opcua-service-browse").BrowseDescription;
var SessionContext = require("./session_context").SessionContext;
var DataValue = require("node-opcua-data-value").DataValue;
var StatusCodes = require("node-opcua-status-code").StatusCodes;

var _ = require("underscore");

/**
 * Pseudo session is an helper object that exposes the same async methods
 * than the ClientSession. It can be used on a server address space.
 *
 * Code reused !
 * The primary benefit of this object  is that its makes advanced OPCUA
 * operations that uses browse, translate, read, write etc similar
 * whether we work inside a server or through a client session.
 *
 * @param addressSpace {AddressSpace}
 * @constructor
 */
function PseudoSession(addressSpace) {
    this.addressSpace = addressSpace;
}

PseudoSession.prototype.browse = function (nodesToBrowse, callback) {

    var isArray = _.isArray(nodesToBrowse);
    if (!isArray) {
        nodesToBrowse = [nodesToBrowse];
    }
    var self = this;
    var results = [];
    nodesToBrowse.forEach(function (browseDescription) {
        browseDescription.referenceTypeId = resolveNodeId(browseDescription.referenceTypeId);
        browseDescription = new BrowseDescription(browseDescription);
        var nodeId = resolveNodeId(browseDescription.nodeId);
        var r = self.addressSpace.browseSingleNode(nodeId, browseDescription);
        results.push(r);
    });
    callback(null, isArray ? results : results[0]);
};


PseudoSession.prototype.read = function (nodesToRead, callback) {

    var isArray =_.isArray(nodesToRead);
    if (!isArray) {
        nodesToRead = [nodesToRead];
    }
    var self = this;
    var context = new SessionContext({session: null});
    var dataValues = nodesToRead.map(function (nodeToRead) {

        var nodeId = nodeToRead.nodeId;
        var attributeId = nodeToRead.attributeId;
        var indexRange = nodeToRead.indexRange;
        var dataEncoding = nodeToRead.dataEncoding;
        var obj = self.addressSpace.findNode(nodeId);
        if (!obj) {
            return new DataValue({statusCode: StatusCodes.BadNodeIdUnknown});
        }
        var dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
        return dataValue;
    });
    callback(null, isArray ? dataValues : dataValues[0]);

};
exports.PseudoSession = PseudoSession;
