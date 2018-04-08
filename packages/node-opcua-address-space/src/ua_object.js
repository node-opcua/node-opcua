"use strict";

/**
 * @module opcua.address_space
 */
const assert = require("node-opcua-assert").assert;
const util = require("util");
const _ = require("underscore");


const NodeClass = require("node-opcua-data-model").NodeClass;
const AttributeIds = require("node-opcua-data-model").AttributeIds;

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;


const DataValue =  require("node-opcua-data-value").DataValue;
const DataType = require("node-opcua-variant").DataType;
const StatusCodes = require("node-opcua-status-code").StatusCodes;


const ec = require("node-opcua-basic-types");

const BaseNode = require("./base_node").BaseNode;
const SessionContext = require("./session_context").SessionContext;


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

const getCurrentClock = require("node-opcua-date-time").getCurrentClock;


UAObject.prototype.readAttribute = function (context, attributeId) {

    assert(context instanceof SessionContext);

    const now = getCurrentClock();
    const options = {};
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
    const self = this;
    options = options || {};
    options = _.extend(_.clone(options),{
        eventNotifier: self.eventNotifier,
        symbolicName: self.symbolicName
    });
    return self._clone(UAObject,options, optionalfilter, extraInfo);
};

exports.UAObject = UAObject;
require("./ua_object_raiseEvent").install(UAObject);
