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

var assert  = require("better-assert");
var util = require("util");
var _ = require("underscore");
var ec = require("lib/misc/encode_decode");

var BaseNode = require("lib/address_space/basenode").BaseNode;


/**
 * @class BaseObject
 * @param options
 * @constructor
 */
function BaseObject(options) {
    BaseNode.apply(this, arguments);
    this.eventNotifier = options.eventNotifier || 0;
    assert(_.isNumber(this.eventNotifier) && ec.isValidByte(this.eventNotifier));
    this.symbolicName =  options.symbolicName || null;
}

util.inherits(BaseObject, BaseNode);
BaseObject.prototype.nodeClass = NodeClass.Object;
BaseObject.typeDefinition = resolveNodeId("BaseObjectType");

BaseObject.prototype.readAttribute = function (attributeId) {
    var options = {};
    switch (attributeId) {
        case AttributeIds.EventNotifier:
            assert(ec.isValidByte(this.eventNotifier));
            options.value = { dataType: DataType.Byte, value: this.eventNotifier };
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this,attributeId);
    }
    return new DataValue(options);
};


exports.BaseObject = BaseObject;