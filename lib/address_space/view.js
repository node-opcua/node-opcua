"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;


var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;


var translate_service = require("lib/services/translate_browse_paths_to_node_ids_service");
var BrowsePathResult = translate_service.BrowsePathResult;
var BrowsePath = translate_service.BrowsePath;

var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");

var dumpIf = require("lib/misc/utils").dumpIf;

var BaseNode = require("lib/address_space/base_node").BaseNode;

/**
 * @class View
 * @extends  BaseNode
 * @param options
 * @constructor
 */
function View(options) {
    BaseNode.apply(this, arguments);
    this.containsNoLoops = options.containsNoLoops ? true : false;
    this.eventNotifier = 0;
}
util.inherits(View, BaseNode);
View.prototype.nodeClass = NodeClass.View;

/**
 * @method readAttribute
 * @param attributeId
 * @return {DataValue}
 */
View.prototype.readAttribute = function (attributeId) {

    var options = {};

    switch (attributeId) {
        case AttributeIds.EventNotifier:
            options.value = {dataType: DataType.UInt32, value: this.eventNotifier};
            options.statusCode = StatusCodes.Good;
            break;
        case AttributeIds.ContainsNoLoops:
            options.value = {dataType: DataType.Boolean, value: this.containsNoLoops};
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, attributeId);
    }
    return new DataValue(options);
};
exports.View = View;


