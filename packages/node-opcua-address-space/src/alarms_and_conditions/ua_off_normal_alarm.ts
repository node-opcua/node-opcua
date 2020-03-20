/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import * as utils from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import { Namespace, UAVariable } from "../../source";
import { NamespacePrivate } from "../namespace_private";
import { UADiscreteAlarm } from "./ua_discrete_alarm";

function isEqual(value1: any, value2: any) {
    return value1 === value2;
}

export interface UAOffNormalAlarm extends UADiscreteAlarm {
    normalState: UAVariable;
}
/**
 * The OffNormalAlarmType is a specialization of the DiscreteAlarmType intended to represent a
 * discrete Condition that is considered to be not normal.
 * This sub type is usually used to indicate that a discrete value is in an Alarm state, it is active as
 * long as a non-normal value is present.
 *
 * @class UAOffNormalAlarm
 * @extends UADiscreteAlarm
 * @constructor
 *
 *
 */
export class UAOffNormalAlarm extends UADiscreteAlarm {

    /**
     * @method (static)UAOffNormalAlarm.instantiate
     * @param namespace {Namespace}
     * @param limitAlarmTypeId
     * @param options
     * @param options.inputNode   {NodeId|UAVariable} the input node
     * @param options.normalState {NodeId|UAVariable} the normalStateNode node
     * @param data
     *
     * When the value of inputNode doesn't match the normalState node value, then the alarm is raised.
     *
     */
    public static instantiate(
        namespace: Namespace,
        limitAlarmTypeId: string | NodeId,
        options: any,
        data: any
    ): UAOffNormalAlarm {
        const addressSpace = (namespace as NamespacePrivate).addressSpace;

        const offNormalAlarmType = addressSpace.findEventType("OffNormalAlarmType");
        /* istanbul ignore next */
        if (!offNormalAlarmType) {
            throw new Error("cannot find offNormalAlarmType");
        }

        assert(options.hasOwnProperty("inputNode"), "must provide inputNode");          // must provide a inputNode
        assert(options.hasOwnProperty("normalState"), "must provide a normalState Node"); // must provide a inputNode
        options.optionals = options.optionals || [];

        assert(options.hasOwnProperty("inputNode"), "must provide inputNode"); // must provide a inputNode
        const alarmNode = UADiscreteAlarm.instantiate(
            namespace, limitAlarmTypeId, options, data) as UAOffNormalAlarm;
        Object.setPrototypeOf(alarmNode, UAOffNormalAlarm.prototype);

        const inputNode = addressSpace._coerceNode(options.inputNode);
        //       assert(inputNode, "Expecting a valid input node");

        const normalState = addressSpace._coerceNode(options.normalState)! as UAVariable;
        //       assert(normalState, "Expecting a valid normalState node");

        const normalStateNodeId = normalState ? normalState.nodeId : NodeId.nullNodeId;
        alarmNode.normalState.setValueFromSource({ dataType: DataType.NodeId, value: normalStateNodeId });

        if (inputNode) {
            // install inputNode Node monitoring for change
            alarmNode._installInputNodeMonitoring(options.inputNode);
        }

        alarmNode.normalState.on("value_changed", (newDataValue: DataValue/*, oldDataValue: DataValue*/) => {
            // The node that contains the normalState value has changed.
            //   we must remove the listener on current normalState and replace

            //   normalState with the new one and set listener again
            //   to do:
        });

        if (normalState) {
            // install normalState monitoring for change
            normalState.on("value_changed", (newDataValue: DataValue/*, oldDataValue: DataValue*/) => {
                alarmNode._onNormalStateDataValueChange(newDataValue);
            });
        }
        alarmNode._updateAlarmState();

        return alarmNode;
    }

    // HasProperty Variable NormalState NodeId PropertyType Mandatory
    // The NormalState Property is a Property that points to a Variable which has a value that
    // corresponds to one of the possible values of the Variable pointed to by the InputNode
    // Property where the NormalState Property Variable value is the value that is considered to be
    // the normal state of the Variable pointed to by the InputNode Property. When the value of the
    // Variable referenced by the InputNode Property is not equal to the value of the NormalState
    // Property the Alarm is Active. If this Variable is not in the AddressSpace, a Null NodeId shall
    // be provided.

    public getNormalStateNode(): UAVariable {
        const nodeId = this.normalState.readValue().value.value;
        const node = this.addressSpace.findNode(nodeId) as UAVariable;
        assert(node, "getNormalStateNode ");
        return node;
    }

    /**
     * @method getNormalStateValue
     */
    public getNormalStateValue(): any {
        const normalStateNode = this.getNormalStateNode();
        return normalStateNode.readValue().value.value;
    }

    /**
     * @method setNormalStateValue
     * @param value
     */
    public setNormalStateValue(value: any): void {
        const normalStateNode = this.getNormalStateNode();
        throw new Error("Not Implemented yet");
    }

    public _updateAlarmState(normalStateValue?: any, inputValue?: any) {

        const alarm = this;

        if (utils.isNullOrUndefined(normalStateValue) || utils.isNullOrUndefined(inputValue)) {
            this.activeState.setValue(false);
            return;
        }
        const isActive = !isEqual(normalStateValue, inputValue);

        if (isActive === alarm.activeState.getValue()) {
            // no change => ignore !
            return;
        }

        const stateName = isActive ? "Active" : "Inactive";
        // also raise the event
        alarm._signalNewCondition(stateName, isActive, "");

    }

    public _onInputDataValueChange(dataValue: DataValue): void {

        if (dataValue.statusCode !== StatusCodes.Good) {
            // what shall we do ?
            return;
        }
        if (dataValue.value.dataType === DataType.Null) {
            // what shall we do ?
            return;
        }
        const inputValue = dataValue.value.value;
        const normalStateValue = this.getNormalStateValue();
        this._updateAlarmState(normalStateValue, inputValue);

    }

    protected _onNormalStateDataValueChange(dataValue: DataValue): void {

        if (dataValue.statusCode !== StatusCodes.Good) {
            // what shall we do ?
            return;
        }
        if (dataValue.value.dataType === DataType.Null) {
            // what shall we do ?
            return;
        }
        const normalStateValue = dataValue.value.value;
        const inputValue = this.getInputNodeValue();
        this._updateAlarmState(normalStateValue, inputValue);
    }

}
