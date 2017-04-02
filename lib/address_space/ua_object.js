"use strict";

/**
 * @module opcua.address_space
 */
require("requirish")._(module);

var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;


var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;
var SessionContext = require("lib/server/session_context").SessionContext;

var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");
var ec = require("lib/misc/encode_decode");

var BaseNode = require("lib/address_space/base_node").BaseNode;


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

UAObject.prototype.readAttribute = function (context, attributeId) {

    assert(context instanceof SessionContext);

    var options = {};
    switch (attributeId) {
        case AttributeIds.EventNotifier:
            assert(ec.isValidByte(this.eventNotifier));
            options.value = {dataType: DataType.Byte, value: this.eventNotifier};
            options.serverTimestamp = new Date();
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
