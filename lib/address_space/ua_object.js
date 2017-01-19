/**
 * @module opcua.address_space
 */
require("requirish")._(module);

import {NodeClass} from "lib/datamodel/nodeclass";
import {resolveNodeId} from "lib/datamodel/nodeid";
import {DataValue} from "lib/datamodel/datavalue";
import {DataType} from "lib/datamodel/variant";
import {StatusCodes} from "lib/datamodel/opcua_status_code";
import read_service from "lib/services/read_service";
const AttributeIds = read_service.AttributeIds;

import assert from "better-assert";
import util from "util";
import _ from "underscore";
import ec from "lib/misc/encode_decode";
import {BaseNode} from "lib/address_space/base_node";


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
      options.value = { dataType: DataType.Byte, value: this.eventNotifier };
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

export {UAObject};
require("./ua_object_raiseEvent").install(UAObject);
