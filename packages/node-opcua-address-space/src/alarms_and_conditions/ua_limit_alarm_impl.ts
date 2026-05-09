import type { UAEventType, UAVariable } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { make_warningLog } from "node-opcua-debug";
import type { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, type VariantOptions } from "node-opcua-variant";
import type { InstantiateLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import type { UALimitAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_limit_alarm_ex";
import type { NamespacePrivate } from "../namespace_private";
import { UAAlarmConditionImplBase } from "./ua_alarm_condition_impl";

const warningLog = make_warningLog("AlarmsAndConditions");

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

export class UALimitAlarmImplBase extends UAAlarmConditionImplBase {
    public static instantiate(
        namespace: NamespacePrivate,
        limitAlarmTypeId: UAEventType | NodeId | string,
        options: InstantiateLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UALimitAlarmImpl {
        const addressSpace = namespace.addressSpace;

        // must provide a inputNode
        // xx assert(Object.prototype.hasOwnProperty.call(options,"conditionOf")); // must provide a conditionOf
        assert(Object.hasOwn(options, "inputNode"), "UALimitAlarm.instantiate: options must provide the inputNode");

        options.optionals = options.optionals || [];
        let count = 0;
        if (Object.hasOwn(options, "highHighLimit")) {
            options.optionals.push("HighHighLimit");
            options.optionals.push("HighHighState");
            count++;
        }
        if (Object.hasOwn(options, "highLimit")) {
            options.optionals.push("HighLimit");
            options.optionals.push("HighState");
            count++;
        }
        if (Object.hasOwn(options, "lowLimit")) {
            options.optionals.push("LowLimit");
            options.optionals.push("LowState");
            count++;
        }
        if (Object.hasOwn(options, "lowLowLimit")) {
            options.optionals.push("LowLowLimit");
            options.optionals.push("LowLowState");
            count++;
        }

        // xx assert(options.optionals,"must provide an optionals");
        const alarmNode = UAAlarmConditionImplBase.instantiate(namespace, limitAlarmTypeId, options, data) as UALimitAlarmImpl;
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

        const dataType = addressSpace.findCorrespondingBasicDataType(inputNode.dataType);

        if (-1 === uaLimitAlarmInputSupportedDataType.indexOf(dataType)) {
            const message = `UALimitAlarm.instantiate: inputNode must be of type ${uaLimitAlarmInputSupportedDataType
                .map((a) => DataType[a])
                .join("|")}, got ${DataType[dataType]}`;
            warningLog(message);
            throw new Error(message);
        }

        if (Object.hasOwn(options, "highHighLimit") && options.highHighLimit !== undefined) {
            alarmNode.setHighHighLimit(options.highHighLimit);
        }
        if (Object.hasOwn(options, "highLimit")) {
            alarmNode.setHighLimit(options.highLimit);
        }
        if (Object.hasOwn(options, "lowLimit")) {
            alarmNode.setLowLimit(options.lowLimit);
        }
        if (Object.hasOwn(options, "lowLowLimit") && options.lowLowLimit !== undefined) {
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

    private get $8() {
        return this as unknown as UALimitAlarmEx;
    }

    public getHighHighLimit(): number {
        if (!this.$8.highHighLimit) {
            throw new Error("Alarm do not expose highHighLimit");
        }
        return this.$8.highHighLimit.readValue().value.value;
    }

    public getHighLimit(): number {
        if (!this.$8.highLimit) {
            throw new Error("Alarm do not expose highLimit");
        }
        return this.$8.highLimit.readValue().value.value;
    }

    public getLowLimit(): number {
        if (!this.$8.lowLimit) {
            throw new Error("Alarm do not expose lowLimit");
        }
        return this.$8.lowLimit.readValue().value.value;
    }

    public getLowLowLimit(): number {
        if (!this.$8.lowLowLimit) {
            throw new Error("Alarm do not expose lowLowLimit");
        }
        return this.$8.lowLowLimit.readValue().value.value;
    }

    public setHighHighLimit(value: number): void {
        if (!this.$8.highHighLimit) {
            throw new Error("LimitAlarm instance must expose the optional HighHighLimit property");
        }
        this.$8.highHighLimit.setValueFromSource({ dataType: DataType.Double, value });
    }

    public setHighLimit(value: number): void {
        if (!this.$8.highLimit) {
            throw new Error("LimitAlarm instance must expose the optional HighLimit property");
        }
        this.$8.highLimit.setValueFromSource({ dataType: DataType.Double, value });
    }

    public setLowLimit(value: number): void {
        if (!this.$8.lowLimit) {
            throw new Error("LimitAlarm instance must expose the optional LowLimit property");
        }
        this.$8.lowLimit.setValueFromSource({ dataType: DataType.Double, value });
    }
    public setLowLowLimit(value: number): void {
        if (!this.$8.lowLowLimit) {
            throw new Error("LimitAlarm instance must expose the optional LowLowLimit property");
        }
        this.$8.lowLowLimit.setValueFromSource({ dataType: DataType.Double, value });
    }

    protected _onInputDataValueChange(dataValue: DataValue): void {
        assert(dataValue instanceof DataValue);

        if (dataValue.statusCode.equals(StatusCodes.BadWaitingForInitialData)) {
            // we are not ready yet to use the input node value
            return;
        }
        if (dataValue.statusCode.isNotGood() && !dataValue.statusCode.equals(StatusCodes.UncertainInitialValue)) {
            // genuinely bad status (not the initial uncertain state) → no specific limit state, alarm inactive
            this._signalNewCondition(null, false, "Input node value is not good");
            return;
        }
        if (dataValue.value.dataType === DataType.Null) {
            // input not yet set → no specific limit state, alarm inactive
            this._signalNewCondition(null, false, "Input node value is null");
            return;
        }
        const value = dataValue.value.value;
        this._setStateBasedOnInputValue(value);
    }

    protected _setStateBasedOnInputValue(_value: number): void {
        throw new Error("_setStateBasedOnInputValue must be overriden");
    }

    protected _watchLimits(): void {
        /// ----------------------------------------------------------------------
        /// Installing Limits monitored
        const _updateState = () => this.updateState();

        if (this.$8.highHighLimit) {
            this.$8.highHighLimit.on("value_changed", _updateState);
        }
        if (this.$8.highLimit) {
            this.$8.highLimit.on("value_changed", _updateState);
        }
        if (this.$8.lowLimit) {
            this.$8.lowLimit.on("value_changed", _updateState);
        }
        if (this.$8.lowLowLimit) {
            this.$8.lowLowLimit.on("value_changed", _updateState);
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

export const UALimitAlarmImpl = UALimitAlarmImplBase as unknown as new () => UALimitAlarmImpl;
export type UALimitAlarmImpl = UALimitAlarmImplBase & UALimitAlarmEx;
