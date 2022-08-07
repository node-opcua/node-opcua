/* eslint-disable max-statements */
/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { UAEventType, UAVariable } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { make_warningLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, VariantOptions } from "node-opcua-variant";
import { UAShelvedStateMachineEx } from "../../source";
import { InstantiateLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import { UALimitAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_limit_alarm_ex";
import { NamespacePrivate } from "../namespace_private";
import {
    UAAlarmConditionImpl
} from "./ua_alarm_condition_impl";

const warningLog = make_warningLog("AlarmsAndConditions");

export declare interface UALimitAlarmImpl extends UALimitAlarmEx, UAAlarmConditionImpl {
    on(eventName: string, eventHandler: any): this;
}

const uaLimitAlarmInputSupportedDataType: DataType[] = [
    DataType.Double,
    DataType.Float,
    DataType.Byte,
    DataType.SByte,
    DataType.Int16,
    DataType.Int32,
    DataType.UInt16,
    DataType.UInt32
];

export interface UALimitAlarmImpl extends UALimitAlarmEx  {
    shelvingState?: UAShelvedStateMachineEx;
}
export class UALimitAlarmImpl extends UAAlarmConditionImpl implements UALimitAlarmEx {
   /**
     * @method (static)UALimitAlarm.instantiate
     * @param namespace {INamespace}
     * @param limitAlarmTypeId
     * @param options
     * @param options.inputNode
     * @param options.optionals
     * @param options.highHighLimit {Double}
     * @param options.highLimit     {Double}
     * @param options.lowLimit      {Double}
     * @param options.lowLowLimit   {Double}
     * @param data
     * @return {UALimitAlarm}
     */
    public static instantiate(
        namespace: NamespacePrivate,
        limitAlarmTypeId: UAEventType | NodeId | string,
        options: InstantiateLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UALimitAlarmImpl {
        const addressSpace = namespace.addressSpace;

        // must provide a inputNode
        // xx assert(Object.prototype.hasOwnProperty.call(options,"conditionOf")); // must provide a conditionOf
        assert(
            Object.prototype.hasOwnProperty.call(options, "inputNode"),
            "UALimitAlarm.instantiate: options must provide the inputNode"
        );

        options.optionals = options.optionals || [];
        let count = 0;
        if (Object.prototype.hasOwnProperty.call(options, "highHighLimit")) {
            options.optionals.push("HighHighLimit");
            options.optionals.push("HighHighState");
            count++;
        }
        if (Object.prototype.hasOwnProperty.call(options, "highLimit")) {
            options.optionals.push("HighLimit");
            options.optionals.push("HighState");
            count++;
        }
        if (Object.prototype.hasOwnProperty.call(options, "lowLimit")) {
            options.optionals.push("LowLimit");
            options.optionals.push("LowState");
            count++;
        }
        if (Object.prototype.hasOwnProperty.call(options, "lowLowLimit")) {
            options.optionals.push("LowLowLimit");
            options.optionals.push("LowLowState");
            count++;
        }

        // xx assert(options.optionals,"must provide an optionals");
        const alarmNode = UAAlarmConditionImpl.instantiate(namespace, limitAlarmTypeId, options, data) as UALimitAlarmImpl;
        Object.setPrototypeOf(alarmNode, UALimitAlarmImpl.prototype);

        assert(alarmNode.conditionOfNode() !== null);

        const inputNode = addressSpace._coerceNode(options.inputNode) as UAVariable;
        if (!inputNode) {
            throw new Error("Expecting a valid input node");
        }
        assert(inputNode.nodeClass === NodeClass.Variable);

        // ----------------------- Install Limit Alarm specifics
        // from spec 1.03:
        // Four optional limits are defined that configure the states of the derived limit Alarm Types.
        // These Properties shall be set for any Alarm limits that are exposed by the derived limit Alarm
        // Types. These Properties are listed as optional but at least one is required. For cases where
        // an underlying system cannot provide the actual value of a limit, the limit Property shall still be
        // provided, but will have its AccessLevel set to not readable. It is assumed that the limits are
        // described using the same Engineering Unit that is assigned to the variable that is the source
        // of the alarm. For Rate of change limit alarms, it is assumed this rate is units per second
        // unless otherwise specified.
        if (count === 0) {
            throw new Error("at least one limit is required");
        }

        const dataType = addressSpace.findCorrespondingBasicDataType(options.inputNode.dataType);

        if (-1 === uaLimitAlarmInputSupportedDataType.indexOf(dataType)) {
            const message = `UALimitAlarm.instantiate: inputNode must be of type ${uaLimitAlarmInputSupportedDataType
                .map((a) => DataType[a])
                .join("|")}, got ${DataType[dataType]}`;
            warningLog(message);
            throw new Error(message);
        }

        if (Object.prototype.hasOwnProperty.call(options, "highHighLimit")) {
            alarmNode.setHighHighLimit(options.highHighLimit);
        }
        if (Object.prototype.hasOwnProperty.call(options, "highLimit")) {
            alarmNode.setHighLimit(options.highLimit);
        }
        if (Object.prototype.hasOwnProperty.call(options, "lowLimit")) {
            alarmNode.setLowLimit(options.lowLimit);
        }
        if (Object.prototype.hasOwnProperty.call(options, "lowLowLimit")) {
            alarmNode.setLowLowLimit(options.lowLowLimit);
        }

        /*
         * The InputNode Property provides the NodeId of the Variable the Value of which is used as
         * primary input in the calculation of the Alarm state. If this Variable is not in the AddressSpace,
         * a Null NodeId shall be provided. In some systems, an Alarm may be calculated based on
         * multiple Variables Values; it is up to the system to determine which Variable’s NodeId is used.
         */
        assert(alarmNode.inputNode.nodeClass === NodeClass.Variable);
        alarmNode.inputNode.setValueFromSource({ dataType: "NodeId", value: inputNode.nodeId });

        // install inputNode monitoring for change
        alarmNode.installInputNodeMonitoring(options.inputNode);
        alarmNode._watchLimits();

        return alarmNode;
    }

    /**
     * @method getHighHighLimit
     * @return {Number}
     */
    public getHighHighLimit(): number {
        if (!this.highHighLimit) {
            throw new Error("Alarm do not expose highHighLimit");
        }
        return this.highHighLimit.readValue().value.value;
    }

    /**
     * @method getHighLimit
     * @return {Number}
     */
    public getHighLimit(): number {
        if (!this.highLimit) {
            throw new Error("Alarm do not expose highLimit");
        }
        return this.highLimit.readValue().value.value;
    }

    /**
     * @method getLowLimit
     * @return {Float}
     */
    public getLowLimit(): number {
        if (!this.lowLimit) {
            throw new Error("Alarm do not expose lowLimit");
        }
        return this.lowLimit.readValue().value.value;
    }

    /**
     * @method getLowLowLimit
     * @return {Float}
     */
    public getLowLowLimit(): number {
        if (!this.lowLowLimit) {
            throw new Error("Alarm do not expose lowLowLimit");
        }
        return this.lowLowLimit.readValue().value.value;
    }

    /**
     * @method setHighHighLimit
     * @param value {Float}
     */
    public setHighHighLimit(value: number): void {
        if (!this.highHighLimit) {
            throw new Error("LimitAlarm instance must expose the optional HighHighLimit property");
        }
        this.highHighLimit.setValueFromSource({ dataType: DataType.Double, value });
    }

    /**
     * @method setHighLimit
     * @param value {Float}
     */
    public setHighLimit(value: number): void {
        if (!this.highLimit) {
            throw new Error("LimitAlarm instance must expose the optional HighLimit property");
        }
        this.highLimit.setValueFromSource({ dataType: DataType.Double, value });
    }

    /**
     * @method setLowLimit
     * @param value {Float}
     */
    public setLowLimit(value: number): void {
        if (!this.lowLimit) {
            throw new Error("LimitAlarm instance must expose the optional LowLimit property");
        }
        this.lowLimit.setValueFromSource({ dataType: DataType.Double, value });
    }

    /**
     * @method setLowLowLimit
     * @param value {Float}
     */
    public setLowLowLimit(value: number): void {
        if (!this.lowLowLimit) {
            throw new Error("LimitAlarm instance must expose the optional LowLowLimit property");
        }
        this.lowLowLimit.setValueFromSource({ dataType: DataType.Double, value });
    }

    protected _onInputDataValueChange(dataValue: DataValue): void {
        assert(dataValue instanceof DataValue);

        if (
            dataValue.statusCode === StatusCodes.BadWaitingForInitialData &&
            dataValue.statusCode === StatusCodes.UncertainInitialValue
        ) {
            // we are not ready yet to use the input node value
            return;
        }
        if (dataValue.statusCode !== StatusCodes.Good) {
            // what shall we do ?
            this._signalNewCondition(null);
            return;
        }
        if (dataValue.value.dataType === DataType.Null) {
            // what shall we do ?
            this._signalNewCondition(null);
            return;
        }
        const value = dataValue.value.value;
        this._setStateBasedOnInputValue(value);
    }

    protected _setStateBasedOnInputValue(value: number): void {
        throw new Error("_setStateBasedOnInputValue must be overriden");
    }

    protected _watchLimits(): void {
        /// ----------------------------------------------------------------------
        /// Installing Limits monitored
        const _updateState = () => this.updateState();

        if (this.highHighLimit) {
            this.highHighLimit.on("value_changed", _updateState);
        }
        if (this.highLimit) {
            this.highLimit.on("value_changed", _updateState);
        }
        if (this.lowLimit) {
            this.lowLimit.on("value_changed", _updateState);
        }
        if (this.lowLowLimit) {
            this.lowLowLimit.on("value_changed", _updateState);
        }
    }

    protected evaluateConditionsAfterEnabled(): void {
        assert(this.getEnabledState() === true);
        // simulate input value event
        const input = this.getInputNodeNode();
        if (!input) {
            return;
        }
        const dataValue = input.readValue();
        this._onInputDataValueChange(dataValue);
    }
}
