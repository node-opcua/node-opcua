/**
 * @module opcua.address_space
 * @class AddressSpace
 */

import assert from "better-assert";
import _ from "underscore";
import UAVariable from "lib/address_space/UAVariable";
import { Variant, DataType } from "lib/datamodel/variant";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { NodeId } from "lib/datamodel/nodeid";
import { UAMethod } from "lib/address_space/ua_method";
import { lowerFirstLetter } from "lib/misc/utils";


import { BaseNode } from "lib/address_space/base_node";
import { constructBrowsePathFromQualifiedName } from "lib/tools/tools_browse_path";

import { SimpleAttributeOperand } from "lib/services/subscription_service";

import { AttributeIds } from "lib/services/read_service";
import { DataValue } from "lib/datamodel/datavalue";

const doDebug = false;

/**
 * @class EventData
 * @param eventTypeNode {BaseNode}
 * @constructor
 */
class EventData {
  constructor(eventTypeNode) {
    this.__nodes = {};
    this.$eventDataSource = eventTypeNode;
    assert(eventTypeNode instanceof BaseNode);
  }

  /**
   * @method resolveSelectClause
   * @param selectClause {SimpleAttributeOperand}
   * @returns {NodeId|null}
   */
  resolveSelectClause(selectClause) {
    const self = this;
    assert(selectClause instanceof SimpleAttributeOperand);
    const addressSpace = self.$eventDataSource.addressSpace;

      // navigate to the innerNode specified by the browsePath [ QualifiedName]
    const browsePath = constructBrowsePathFromQualifiedName(
      self.$eventDataSource, selectClause.browsePath
    );
    const browsePathResult = addressSpace.browsePath(browsePath);
      // xx console.log(
      //  " br",
      //  self.$eventDataSource.nodeId.toString(),
      //  selectClause.browsePath.toString(),
      //  browsePathResult.targets[0]
      //    ? browsePathResult.targets[0].targetId.toString()
      //    : "!!!NOT FOUNF!!!".cyan
      // )
    if (browsePathResult.statusCode !== StatusCodes.Good) {
      return null;
    }
      // istanbul ignore next
    if (browsePathResult.targets.length !== 1) {
          // xx console.log("selectClause ",selectClause.toString());
          // xx console.log("browsePathResult ",browsePathResult.toString());
          // xx throw new Error(
          //  "browsePathResult.targets.length !== 1" + browsePathResult.targets.length
          // );
    }
    return browsePathResult.targets[0].targetId;
  }

  setValue(lowerName, node, variant) {
    const eventData = this;
    eventData[lowerName] = Variant.coerce(variant);// / _coerceVariant(variant);
    eventData.__nodes[node.nodeId.toString()] = eventData[lowerName];
  }

  /**
   * @method readValue
   * @param nodeId {NodeId}
   * @param selectClause {SimpleAttributeOperand}
   * @returns {Variant}
   */
  readValue(nodeId, selectClause) {
    assert(nodeId instanceof NodeId);
    assert(selectClause instanceof SimpleAttributeOperand);
    const self = this;
    assert(nodeId instanceof NodeId);
    const addressSpace = this.$eventDataSource.addressSpace;

    const node = addressSpace.findNode(nodeId);

    const key = node.nodeId.toString();

      // if the value exists in cache ... we read it from cache...
    const cached_value = self.__nodes[key];
    if (cached_value) {
      return cached_value;
    }

    if (node instanceof UAVariable && selectClause.attributeId === AttributeIds.Value) {
      return prepare(node.readValue(selectClause.indexRange));
    }
    return prepare(node.readAttribute(selectClause.attributeId));
  }
}

function prepare(dataValue) {
  assert(dataValue instanceof DataValue);
  if (dataValue.statusCode === StatusCodes.Good) {
    return dataValue.value;
  }
  return new Variant({ dataType: DataType.StatusCode, value: dataValue.statusCode });
}

export default EventData;
