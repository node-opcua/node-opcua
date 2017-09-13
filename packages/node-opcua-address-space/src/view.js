"use strict";

/**
 * @module opcua.address_space
 */
var assert = require("node-opcua-assert");
var util = require("util");
var _ = require("underscore");

var NodeClass = require("node-opcua-data-model").NodeClass;

var DataValue =  require("node-opcua-data-value").DataValue;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;

var AttributeIds = require("node-opcua-data-model").AttributeIds;

var dumpIf = require("node-opcua-debug").dumpIf;

var BaseNode = require("./base_node").BaseNode;
var SessionContext = require("./session_context").SessionContext;

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
 * @param context {SessionContext}
 * @param attributeId {AttributeId}
 * @return {DataValue}
 */
View.prototype.readAttribute = function (context, attributeId) {

    assert(context instanceof SessionContext);

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
            return BaseNode.prototype.readAttribute.call(this, context, attributeId);
    }
    return new DataValue(options);
};
exports.View = View;


