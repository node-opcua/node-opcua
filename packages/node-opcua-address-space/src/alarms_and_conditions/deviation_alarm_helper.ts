/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { DataType } from "node-opcua-variant";
import { UAVariableT } from "node-opcua-address-space-base";
import { NodeId } from "node-opcua-nodeid";

import { AddressSpacePrivate } from "../address_space_private";
import { DeviationStuff } from "../../source/interfaces/alarms_and_conditions/deviation_stuff";
import { InstallSetPointOptions } from "../../source/interfaces/alarms_and_conditions/install_setpoint_options";

export function DeviationAlarmHelper_getSetpointNodeNode(
    this: DeviationStuff
): UAVariableT<number, DataType.Double> | UAVariableT<number, DataType.Float> | undefined {
    assert(this.setpointNode.readValue().value.dataType === DataType.NodeId);

    const nodeId = this.setpointNode.readValue().value.value;
    const node = this.addressSpace.findNode(nodeId);
    assert(node === this.setpointNodeNode);
    if (!node) {
        return undefined;
    }
    return this.setpointNodeNode;
}

export function DeviationAlarmHelper_getSetpointValue(this: DeviationStuff): number | null {
    assert(Object.prototype.hasOwnProperty.call(this, "setpointNode"));
    assert(Object.prototype.hasOwnProperty.call(this, "setpointNodeNode"));
    if (! this.setpointNodeNode) {
        return null;
    }
    const setpointDataValue = this.setpointNodeNode.readValue();
    if (setpointDataValue.statusCode.isNotGood()) {
        return null;
    }
    const node = this.getSetpointNodeNode();
    if (!node) {
        return null;
    }
    return node.readValue().value.value;
}

export function DeviationAlarmHelper_onSetpointDataValueChange(this: DeviationStuff, dataValue: DataValue): void {
    this._setStateBasedOnInputValue(this.getInputNodeValue());
}

export function DeviationAlarmHelper_install_setpoint(this: DeviationStuff, options: InstallSetPointOptions): void {
   
    assert(this.setpointNode.browseName.toString() === "SetpointNode");

    const addressSpace = this.addressSpace as AddressSpacePrivate;

    if (options.setpointNode) {
        const setpointNodeNode = addressSpace._coerceNode(options.setpointNode);
        assert(setpointNodeNode, "Expecting a valid setpoint node");
        this.setpointNodeNode = addressSpace._coerceNode(options.setpointNode)! as UAVariableT<number, DataType.Double>;
        this.setpointNode.setValueFromSource({ dataType: "NodeId", value: this.setpointNodeNode.nodeId });
        // install inputNode monitoring for change
        this.setpointNodeNode.on("value_changed", (newDataValue: DataValue) => {
            this._onSetpointDataValueChange(newDataValue);
        });
    } else {
        this.setpointNodeNode = undefined;
        this.setpointNode.setValueFromSource({ dataType: "NodeId", value: NodeId.nullNodeId });
    }
}
