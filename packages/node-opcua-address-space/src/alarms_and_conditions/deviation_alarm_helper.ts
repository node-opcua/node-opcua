/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { BaseNode, UAVariable, UAVariableT } from "../../source";
import { AddressSpacePrivate } from "../address_space_private";

export interface DeviationStuff extends BaseNode {
    setpointNode: UAVariableT<NodeId>;
    setpointNodeNode: UAVariable;
    _onSetpointDataValueChange(dataValue: DataValue): void;
    _setStateBasedOnInputValue(value: any): void;
    getSetpointNodeNode(): UAVariable;
    getInputNodeValue(): any;
}

export function DeviationAlarmHelper_getSetpointNodeNode(this: DeviationStuff) {

    assert(this.setpointNode.readValue().value.dataType === DataType.NodeId);
    const nodeId = this.setpointNode.readValue().value.value;
    const node = this.addressSpace.findNode(nodeId);
    assert(node === this.setpointNodeNode);
    return this.setpointNodeNode;
}
export function DeviationAlarmHelper_getSetpointValue(this: DeviationStuff): number | null {
    assert(this.hasOwnProperty("setpointNode"));
    assert(this.hasOwnProperty("setpointNodeNode"));
    const setpointDataValue = this.setpointNodeNode.readValue();
    if (setpointDataValue.statusCode !== StatusCodes.Good) {
        return null;
    }
    return this.getSetpointNodeNode().readValue().value.value;
}

export function DeviationAlarmHelper_onSetpointDataValueChange(
      this: DeviationStuff,
      dataValue: DataValue
) {
   this._setStateBasedOnInputValue(this.getInputNodeValue());
}

export function DeviationAlarmHelper_install_setpoint(
  this: DeviationStuff,
  options: any
)  {

    // must provide a set point property
    assert(options.hasOwnProperty("setpointNode"), "must provide a setpointNode");

    const addressSpace = this.addressSpace as AddressSpacePrivate;
    const setpointNodeNode = addressSpace._coerceNode(options.setpointNode);
    assert(setpointNodeNode, "Expecting a valid setpoint node");

    assert(this.setpointNode.browseName.toString() === "SetpointNode");

    this.setpointNodeNode = addressSpace._coerceNode(options.setpointNode)! as UAVariable;
    this.setpointNode.setValueFromSource({ dataType: "NodeId", value: this.setpointNodeNode.nodeId });

// install inputNode monitoring for change
    this.setpointNodeNode.on("value_changed", (newDataValue: DataValue) => {
        this._onSetpointDataValueChange(newDataValue);
    });
}
