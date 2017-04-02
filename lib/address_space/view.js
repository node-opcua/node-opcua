"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;

var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;
var SessionContext = require("lib/server/session_context").SessionContext;

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


