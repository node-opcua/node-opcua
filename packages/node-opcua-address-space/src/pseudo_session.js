"use strict";

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const BrowseDescription = require("node-opcua-service-browse").BrowseDescription;
const SessionContext = require("./session_context").SessionContext;
const DataValue = require("node-opcua-data-value").DataValue;
const StatusCodes = require("node-opcua-status-code").StatusCodes;

const _ = require("underscore");

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

    const isArray = _.isArray(nodesToBrowse);
    if (!isArray) {
        nodesToBrowse = [nodesToBrowse];
    }
    const self = this;
    const results = [];
    nodesToBrowse.forEach(function (browseDescription) {
        browseDescription.referenceTypeId = resolveNodeId(browseDescription.referenceTypeId);
        browseDescription = new BrowseDescription(browseDescription);
        const nodeId = resolveNodeId(browseDescription.nodeId);
        const r = self.addressSpace.browseSingleNode(nodeId, browseDescription);
        results.push(r);
    });
    callback(null, isArray ? results : results[0]);
};


PseudoSession.prototype.read = function (nodesToRead, callback) {

    const isArray =_.isArray(nodesToRead);
    if (!isArray) {
        nodesToRead = [nodesToRead];
    }
    const self = this;
    const context = new SessionContext({session: null});
    const dataValues = nodesToRead.map(function (nodeToRead) {

        const nodeId = nodeToRead.nodeId;
        const attributeId = nodeToRead.attributeId;
        const indexRange = nodeToRead.indexRange;
        const dataEncoding = nodeToRead.dataEncoding;
        const obj = self.addressSpace.findNode(nodeId);
        if (!obj) {
            return new DataValue({statusCode: StatusCodes.BadNodeIdUnknown});
        }
        const dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
        return dataValue;
    });
    callback(null, isArray ? dataValues : dataValues[0]);

};
exports.PseudoSession = PseudoSession;
