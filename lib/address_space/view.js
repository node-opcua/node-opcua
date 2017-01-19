/**
 * @module opcua.address_space
 */
require("requirish")._(module);

import {NodeClass} from "lib/datamodel/nodeclass";
import {NodeId} from "lib/datamodel/nodeid";
import {makeNodeId} from "lib/datamodel/nodeid";
import {resolveNodeId} from "lib/datamodel/nodeid";
import {DataValue} from "lib/datamodel/datavalue";
import {DataType} from "lib/datamodel/variant";
import {StatusCodes} from "lib/datamodel/opcua_status_code";
import read_service from "lib/services/read_service";
const AttributeIds = read_service.AttributeIds;


import translate_service from "lib/services/translate_browse_paths_to_node_ids_service";
const BrowsePathResult = translate_service.BrowsePathResult;
const BrowsePath = translate_service.BrowsePath;

import assert from "better-assert";
import util from "util";
import _ from "underscore";
import {dumpIf} from "lib/misc/utils";
import {BaseNode} from "lib/address_space/base_node";

/**
 * @class View
 * @extends  BaseNode
 * @param options
 * @constructor
 */
function View(options) {
  BaseNode.apply(this, arguments);
  this.containsNoLoops = !!options.containsNoLoops;
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
  const options = {};

  switch (attributeId) {
    case AttributeIds.EventNotifier:
      options.value = { dataType: DataType.UInt32, value: this.eventNotifier };
      options.statusCode = StatusCodes.Good;
      break;
    case AttributeIds.ContainsNoLoops:
      options.value = { dataType: DataType.Boolean, value: this.containsNoLoops };
      options.statusCode = StatusCodes.Good;
      break;
    default:
      return BaseNode.prototype.readAttribute.call(this, attributeId);
  }
  return new DataValue(options);
};
export {View};

