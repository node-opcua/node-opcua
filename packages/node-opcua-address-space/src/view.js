"use strict";

/**
 * @module opcua.address_space
 */
const assert = require("node-opcua-assert").assert;
const util = require("util");
const _ = require("underscore");

const NodeClass = require("node-opcua-data-model").NodeClass;

const DataValue =  require("node-opcua-data-value").DataValue;
const DataType = require("node-opcua-variant").DataType;
const StatusCodes = require("node-opcua-status-code").StatusCodes;

const AttributeIds = require("node-opcua-data-model").AttributeIds;

const dumpIf = require("node-opcua-debug").dumpIf;

const BaseNode = require("./base_node").BaseNode;
const SessionContext = require("./session_context").SessionContext;

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

    const options = {};

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


