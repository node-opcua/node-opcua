/**
 * @module opcua.address_space
 */
require("requirish")._(module);

const NodeClass = require("lib/datamodel/nodeclass").NodeClass;
const resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;


const DataValue = require("lib/datamodel/datavalue").DataValue;
const DataType = require("lib/datamodel/variant").DataType;
const StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
const read_service = require("lib/services/read_service");
const AttributeIds = read_service.AttributeIds;

const assert = require("better-assert");
const util = require("util");
const _ = require("underscore");
const ec = require("lib/misc/encode_decode");

const BaseNode = require("lib/address_space/base_node").BaseNode;


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

UAObject.prototype.readAttribute = function (attributeId) {
    const options = {};
    switch (attributeId) {
        case AttributeIds.EventNotifier:
            assert(ec.isValidByte(this.eventNotifier));
            options.value = {dataType: DataType.Byte, value: this.eventNotifier};
            options.serverTimestamp = new Date();
            options.statusCode = StatusCodes.Good;
            break;
        default:
            return BaseNode.prototype.readAttribute.call(this, attributeId);
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
