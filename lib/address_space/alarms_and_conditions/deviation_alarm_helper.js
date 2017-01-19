/**
 * @module opcua.address_space.AlarmsAndConditions
 */
import assert from "assert";
import {StatusCodes} from "lib/datamodel/opcua_status_code";
import {DataType} from "lib/datamodel/variant";

const DeviationAlarmHelper = {};
DeviationAlarmHelper.getSetpointNodeNode = function () {
  assert(this.setpointNode.readValue().value.dataType === DataType.NodeId);
  const nodeId = this.setpointNode.readValue().value.value;
  const node = this.addressSpace.findNode(nodeId);
  assert(node === this.setpointNodeNode);
  return this.setpointNodeNode;
};
DeviationAlarmHelper.getSetpointValue = function () {
  assert(this.hasOwnProperty("setpointNode"));
  assert(this.hasOwnProperty("setpointNodeNode"));
  const setpointDataValue = this.setpointNodeNode.readValue();
  if (setpointDataValue.statusCode !== StatusCodes.Good) {
    return null;
  }
  return this.getSetpointNodeNode().readValue().value.value;
};
DeviationAlarmHelper._onSetpointDataValueChange = function (dataValue) {
  this._setStateBasedOnInputValue(this.getInputNodeValue());
};

DeviationAlarmHelper._install_setpoint = (alarm, options) => {
    // must provide a set point property
  assert(options.hasOwnProperty("setpointNode"),"must provide a setpointNode");

  const addressSpace = alarm.addressSpace;
  const setpointNodeNode = addressSpace._coerceNode(options.setpointNode);
  assert(setpointNodeNode, "Expecting a valid setpoint node");

  assert(alarm.setpointNode.browseName.toString() === "SetpointNode");

  alarm.setpointNodeNode = addressSpace._coerceNode(options.setpointNode);
  alarm.setpointNode.setValueFromSource({ dataType: "NodeId", value: alarm.setpointNodeNode.nodeId });

// install inputNode monitoring for change
  alarm.setpointNodeNode.on("value_changed", (newDataValue, oldDataValue) => {
    alarm._onSetpointDataValueChange(newDataValue);
  });
};

export {DeviationAlarmHelper};
