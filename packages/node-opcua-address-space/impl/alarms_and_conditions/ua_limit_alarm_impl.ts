import type { UAEventType, UAProperty, UAVariable } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { UInt16 } from "node-opcua-basic-types";
import { NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { make_warningLog } from "node-opcua-debug";
import type { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, type VariantOptions } from "node-opcua-variant";
import type { InstantiateLimitAlarmOptions } from "../../api/interfaces/alarms_and_conditions/instantiate_limit_alarm_options.js";
import type { UALimitAlarmEx } from "../../api/interfaces/alarms_and_conditions/ua_limit_alarm_ex.js";
import type { NamespacePrivate } from "../namespace_private.js";
import { UAAlarmConditionImplBase } from "./ua_alarm_condition_impl.js";

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

/** @internal */
export class UALimitAlarmImplBase extends UAAlarmConditionImplBase implements UALimitAlarmEx {
    /**
     * The limits, all optional: which ones exist depends on the alarm type instantiated.
     * Installed as child nodes by the address space, not assigned here - hence `declare`.
     */
    declare public readonly highHighLimit?: UAProperty<number, DataType.Double>;
    declare public readonly highLimit?: UAProperty<number, DataType.Double>;
    declare public readonly lowLimit?: UAProperty<number, DataType.Double>;
    declare public readonly lowLowLimit?: UAProperty<number, DataType.Double>;
    declare public readonly baseHighHighLimit?: UAProperty<number, DataType.Double>;
    declare public readonly baseHighLimit?: UAProperty<number, DataType.Double>;
    declare public readonly baseLowLimit?: UAProperty<number, DataType.Double>;
    declare public readonly baseLowLowLimit?: UAProperty<number, DataType.Double>;
    declare public readonly severityHighHigh?: UAProperty<UInt16, DataType.UInt16>;
    declare public readonly severityHigh?: UAProperty<UInt16, DataType.UInt16>;
    declare public readonly severityLow?: UAProperty<UInt16, DataType.UInt16>;
    declare public readonly severityLowLow?: UAProperty<UInt16, DataType.UInt16>;
    declare public readonly highHighDeadband?: UAProperty<number, DataType.Double>;
    declare public readonly highDeadband?: UAProperty<number, DataType.Double>;
    declare public readonly lowDeadband?: UAProperty<number, DataType.Double>;
    declare public readonly lowLowDeadband?: UAProperty<number, DataType.Double>;

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

    public getHighHighLimit(): number {
        if (!this.highHighLimit) {
            throw new Error("Alarm do not expose highHighLimit");
        }
        return this.highHighLimit.readValue().value.value;
    }

    public getHighLimit(): number {
        if (!this.highLimit) {
            throw new Error("Alarm do not expose highLimit");
        }
        return this.highLimit.readValue().value.value;
    }

    public getLowLimit(): number {
        if (!this.lowLimit) {
            throw new Error("Alarm do not expose lowLimit");
        }
        return this.lowLimit.readValue().value.value;
    }

    public getLowLowLimit(): number {
        if (!this.lowLowLimit) {
            throw new Error("Alarm do not expose lowLowLimit");
        }
        return this.lowLowLimit.readValue().value.value;
    }

    public setHighHighLimit(value: number): void {
        if (!this.highHighLimit) {
            throw new Error("LimitAlarm instance must expose the optional HighHighLimit property");
        }
        this.highHighLimit.setValueFromSource({ dataType: DataType.Double, value });
    }

    public setHighLimit(value: number): void {
        if (!this.highLimit) {
            throw new Error("LimitAlarm instance must expose the optional HighLimit property");
        }
        this.highLimit.setValueFromSource({ dataType: DataType.Double, value });
    }

    public setLowLimit(value: number): void {
        if (!this.lowLimit) {
            throw new Error("LimitAlarm instance must expose the optional LowLimit property");
        }
        this.lowLimit.setValueFromSource({ dataType: DataType.Double, value });
    }
    public setLowLowLimit(value: number): void {
        if (!this.lowLowLimit) {
            throw new Error("LimitAlarm instance must expose the optional LowLowLimit property");
        }
        this.lowLowLimit.setValueFromSource({ dataType: DataType.Double, value });
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

/** @internal */
export const UALimitAlarmImpl = UALimitAlarmImplBase;
/** @internal */
export type UALimitAlarmImpl = UALimitAlarmImplBase;
