"use strict";

/**
 * @module opcua.address_space
 */
var assert = require("node-opcua-assert");
var util = require("util");
var _ = require("underscore");


var NodeClass = require("node-opcua-data-model").NodeClass;
var AttributeIds = require("node-opcua-data-model").AttributeIds;

var resolveNodeId = require("node-opcua-nodeid").resolveNodeId;


var DataValue =  require("node-opcua-data-value").DataValue;
var DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;


var ec = require("node-opcua-basic-types");

var BaseNode = require("./base_node").BaseNode;
var SessionContext = require("./session_context").SessionContext;


/**
 * @class UAObject
 * @param options
 * @constructor
 */
function UAObject(options) {
    BaseNode.apply(this, arguments);
    this.eventNotifier = options.eventNotifier || 0;
    assert(_.isNumber(this.eventNotifier) && ec.isValidByte(this.eventNotifier));
    this.symbolicName = options.symbolicName || null;
}

util.inherits(UAObject, BaseNode);
UAObject.prototype.nodeClass = NodeClass.Object;
UAObject.typeDefinition = resolveNodeId("BaseObjectType");

var getCurrentClock = require("node-opcua-date-time").getCurrentClock;


UAObject.prototype.readAttribute = function (context, attributeId) {

    assert(context instanceof SessionContext);

    var now = getCurrentClock();
    var options = {};
    switch (attributeId) {
        case AttributeIds.EventNotifier:
            assert(ec.isValidByte(this.eventNotifier));
            options.value = {dataType: DataType.Byte, value: this.eventNotifier};
            options.serverTimestamp = now.timestamp;
            options.serverPicoseconds = now.picoseconds;
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, context, attributeId);
    }
    return new DataValue(options);
};


UAObject.prototype.clone = function (options,optionalfilter,extraInfo) {
    var self = this;
    options = options || {};
    options = _.extend(_.clone(options),{
        eventNotifier: self.eventNotifier,
        symbolicName: self.symbolicName
    });
    return self._clone(UAObject,options, optionalfilter, extraInfo);
};

exports.UAObject = UAObject;
require("./ua_object_raiseEvent").install(UAObject);
