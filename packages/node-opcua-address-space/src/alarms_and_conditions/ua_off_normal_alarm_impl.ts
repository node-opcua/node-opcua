/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { INamespace, UAVariable } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { UAOffNormalAlarm_Base } from "node-opcua-nodeset-ua";
import { StatusCodes } from "node-opcua-status-code";
import * as utils from "node-opcua-utils";
import { DataType, VariantOptions } from "node-opcua-variant";
import { InstantiateOffNormalAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_off_normal_alarm_options";
import { UADiscreteAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_discrete_alarm_ex";
import { AddressSpacePrivate } from "../address_space_private";
import {  UADiscreteAlarmImpl } from "./ua_discrete_alarm_impl";

function isEqual(value1: any, value2: any) {
    return value1 === value2;
}

export declare interface UAOffNormalAlarmEx
    extends Omit<
            UAOffNormalAlarm_Base,
            | "ackedState"
            | "activeState"
            | "confirmedState"
            | "enabledState"
            | "latchedState"
            | "outOfServiceState"
            | "shelvingState"
            | "silenceState"
            | "suppressedState"
        >,
        UADiscreteAlarmEx {
    getNormalStateNode(): UAVariable | null;

    getNormalStateValue(): any;

    setNormalStateValue(value: any): void;
}


export declare interface UAOffNormalAlarmImpl extends UAOffNormalAlarmEx, UADiscreteAlarmImpl {
    on(eventName: string, eventHandler: any): this;
}
/**
 * The OffNormalAlarmType is a specialization of the DiscreteAlarmType intended to represent a
 * discrete Condition that is considered to be not normal.
 * This sub type is usually used to indicate that a discrete value is in an Alarm state, it is active as
 * long as a non-normal value is present.
 */
export class UAOffNormalAlarmImpl extends UADiscreteAlarmImpl implements UAOffNormalAlarmEx {
    /**
     * When the value of inputNode doesn't match the normalState node value, then the alarm is raised.
     *
     */
    public static instantiate(
        namespace: INamespace,
        limitAlarmTypeId: string | NodeId,
        options: InstantiateOffNormalAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UAOffNormalAlarmImpl {
        const addressSpace = namespace.addressSpace as AddressSpacePrivate;

        const offNormalAlarmType = addressSpace.findEventType("OffNormalAlarmType");
        /* istanbul ignore next */
        if (!offNormalAlarmType) {
            throw new Error("cannot find offNormalAlarmType");
        }

        assert(Object.prototype.hasOwnProperty.call(options, "inputNode"), "must provide inputNode"); // must provide a inputNode
        assert(Object.prototype.hasOwnProperty.call(options, "normalState"), "must provide a normalState Node"); // must provide a inputNode
        options.optionals = options.optionals || [];

        assert(Object.prototype.hasOwnProperty.call(options, "inputNode"), "must provide inputNode"); // must provide a inputNode
        const alarmNode = UADiscreteAlarmImpl.instantiate(namespace, limitAlarmTypeId, options, data) as UAOffNormalAlarmImpl;
        Object.setPrototypeOf(alarmNode, UAOffNormalAlarmImpl.prototype);

        /**
         * The InputNode Property provides the NodeId of the Variable the Value of which is used as primary input in
         * the calculation of the Alarm state.
         *
         * If this Variable is not in the AddressSpace, a NULL NodeId shall be provided.
         *
         * In some systems, an Alarm may be calculated based on multiple Variables Values;
         * it is up to the system to determine which Variable’s NodeId is used.
         */
        const inputNode = addressSpace._coerceNode(options.inputNode) as UAVariable | null;
        // note: alarmNode.inputNode.readValue() already set by DiscreteAlarmImpl.instantiate

        if (inputNode) {
            // install inputNode Node monitoring for change
            alarmNode.installInputNodeMonitoring(options.inputNode);
        }

        /**
         * The NormalState Property is a Property that points to a Variable which has a value that corresponds to one
         * of the possible values of the Variable pointed to by the InputNode Property where the NormalState Property
         * Variable value is the value that is considered to be the normal state of the Variable pointed to by the InputNode
         * Property. When the value of the Variable referenced by the InputNode Property is not equal to the value of the
         * NormalState Property the Alarm is Active.
         *
         * If this Variable is not in the AddressSpace, a NULL NodeId shall be provided.
         *
         */
        const normalState = addressSpace._coerceNode(options.normalState) as UAVariable | null;
        const normalStateNodeId = normalState ? normalState.nodeId : new NodeId();
        alarmNode.normalState.setValueFromSource({ dataType: DataType.NodeId, value: normalStateNodeId });
        alarmNode.normalState.on("value_changed", (newDataValue: DataValue /*, oldDataValue: DataValue*/) => {
            // The node that contains the normalState value has changed.
            //   we must remove the listener on current normalState and replace
            //   normalState with the new one and set listener again
            //   to do:
        });

        if (normalState) {
            // install normalState monitoring for change
            normalState.on("value_changed", (newDataValue: DataValue /*, oldDataValue: DataValue*/) => {
                alarmNode._onNormalStateDataValueChange(newDataValue);
            });
        }

        alarmNode._mayBe_updateAlarmState();

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

    public getNormalStateNode(): UAVariable | null {
        const nodeId = this.normalState.readValue().value.value;
        const node = this.addressSpace.findNode(nodeId) as UAVariable;
        if (!node) {
            return null;
        }
        return node;
    }

    /**
     * @method getNormalStateValue
     */
    public getNormalStateValue(): any | null {
        const normalStateNode = this.getNormalStateNode();
        if (!normalStateNode) {
            return null;
        }
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

    public updateAlarmState(isActive: boolean, message: string) {
        if (isActive === this.activeState.getValue()) {
            // no change => ignore !
            return;
        }
        const stateName = isActive ? "Active" : "Inactive";
        // also raise the event
        this._signalNewCondition(stateName, isActive, message);
        if (!isActive) {
            this.currentBranch().setRetain(false);
        }
    }

    private _mayBe_updateAlarmState(normalStateValue?: any, inputValue?: any): void {
        if (utils.isNullOrUndefined(normalStateValue) || utils.isNullOrUndefined(inputValue)) {
            this.activeState.setValue(false);
            return;
        }
        const isActive = !isEqual(normalStateValue, inputValue);
        this.updateAlarmState(isActive, "automatique update");
    }

    protected _onInputDataValueChange(dataValue: DataValue): void {
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
        this._mayBe_updateAlarmState(normalStateValue, inputValue);
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
        this._mayBe_updateAlarmState(normalStateValue, inputValue);
    }
}
