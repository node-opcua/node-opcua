/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { UAVariable } from "node-opcua-address-space-base";

import { AddressSpacePrivate } from "../address_space_private";
import { DeviationStuff } from "../../source/interfaces/alarms_and_conditions/deviation_stuff";
import { InstallSetPointOptions } from "../../source/interfaces/alarms_and_conditions/install_setpoint_options";



export function DeviationAlarmHelper_getSetpointNodeNode(this: DeviationStuff): UAVariable {
    assert(this.setpointNode.readValue().value.dataType === DataType.NodeId);
    const nodeId = this.setpointNode.readValue().value.value;
    const node = this.addressSpace.findNode(nodeId);
    assert(node === this.setpointNodeNode);
    return this.setpointNodeNode;
}
export function DeviationAlarmHelper_getSetpointValue(this: DeviationStuff): number | null {
    assert(Object.prototype.hasOwnProperty.call(this, "setpointNode"));
    assert(Object.prototype.hasOwnProperty.call(this, "setpointNodeNode"));
    const setpointDataValue = this.setpointNodeNode.readValue();
    if (setpointDataValue.statusCode !== StatusCodes.Good) {
        return null;
    }
    return this.getSetpointNodeNode().readValue().value.value;
}

export function DeviationAlarmHelper_onSetpointDataValueChange(this: DeviationStuff, dataValue: DataValue): void {
    this._setStateBasedOnInputValue(this.getInputNodeValue());
}

export function DeviationAlarmHelper_install_setpoint(this: DeviationStuff, options: InstallSetPointOptions): void {
    // must provide a set point property
    assert(Object.prototype.hasOwnProperty.call(options, "setpointNode"), "must provide a setpointNode");

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
