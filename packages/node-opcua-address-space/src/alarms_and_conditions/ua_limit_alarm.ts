/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import { UAEventType } from "../../source";
import { NamespacePrivate } from "../namespace_private";
import { UATwoStateVariable } from "../ua_two_state_variable";
import { UAVariable } from "../ua_variable";
import { UAAlarmConditionBase } from "./ua_alarm_condition_base";

export interface UALimitAlarm  extends UAAlarmConditionBase {
    highHighLimit?: UAVariable;
    highLimit?: UAVariable;
    lowLimit?: UAVariable;
    lowLowLimit?: UAVariable;
    activeState: UATwoStateVariable;
}
export class UALimitAlarm extends UAAlarmConditionBase {

    /**
     * @method (static)UALimitAlarm.instantiate
     * @param namespace {Namespace}
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
      options: any,
      data: any
    ): UALimitAlarm {

        const addressSpace = namespace.addressSpace;

        /* eslint max-instructions: off */
        // must provide a inputNode
        // xx assert(options.hasOwnProperty("conditionOf")); // must provide a conditionOf
        assert(options.hasOwnProperty("inputNode"), "UALimitAlarm.instantiate: options must provide the inputNode");

        options.optionals = options.optionals || [];
        let count = 0;
        if (options.hasOwnProperty("highHighLimit")) {
            options.optionals.push("HighHighLimit");
            options.optionals.push("HighHighState");
            count++;
        }
        if (options.hasOwnProperty("highLimit")) {
            options.optionals.push("HighLimit");
            options.optionals.push("HighState");
            count++;
        }
        if (options.hasOwnProperty("lowLimit")) {
            options.optionals.push("LowLimit");
            options.optionals.push("LowState");
            count++;
        }
        if (options.hasOwnProperty("lowLowLimit")) {
            options.optionals.push("LowLowLimit");
            options.optionals.push("LowLowState");
            count++;
        }

        // xx assert(options.optionals,"must provide an optionals");
        const alarmNode = UAAlarmConditionBase.instantiate(
          namespace, limitAlarmTypeId, options, data) as UALimitAlarm;
        Object.setPrototypeOf(alarmNode, UALimitAlarm.prototype);

        assert(alarmNode.conditionOfNode() !== null);

        const inputNode = addressSpace._coerceNode(options.inputNode);
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

        alarmNode._dataType = dataType;

        if (options.hasOwnProperty("highHighLimit")) {
            alarmNode.setHighHighLimit(options.highHighLimit);
        }
        if (options.hasOwnProperty("highLimit")) {
            alarmNode.setHighLimit(options.highLimit);
        }
        if (options.hasOwnProperty("lowLimit")) {
            alarmNode.setLowLimit(options.lowLimit);
        }
        if (options.hasOwnProperty("lowLowLimit")) {
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
        alarmNode._installInputNodeMonitoring(options.inputNode);
        alarmNode._watchLimits();

        return alarmNode;
    }

    public _dataType: any;

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
        this.highHighLimit.setValueFromSource({ dataType: this._dataType, value });

    }

    /**
     * @method setHighLimit
     * @param value {Float}
     */
    public setHighLimit(value: number): void {
        if (!this.highLimit) {
            throw new Error("LimitAlarm instance must expose the optional HighLimit property");
        }
        this.highLimit.setValueFromSource({ dataType: this._dataType, value });
    }

    /**
     * @method setLowLimit
     * @param value {Float}
     */
    public setLowLimit(value: number): void {
        if (!this.lowLimit) {
            throw new Error("LimitAlarm instance must expose the optional LowLimit property");
        }
        this.lowLimit.setValueFromSource({ dataType: this._dataType, value });
    }

    /**
     * @method setLowLowLimit
     * @param value {Float}
     */
    public setLowLowLimit(value: number): void {
        if (!this.lowLowLimit) {
            throw new Error("LimitAlarm instance must expose the optional LowLowLimit property");
        }
        this.lowLowLimit.setValueFromSource({ dataType: this._dataType, value });
    }

    public _onInputDataValueChange(dataValue: DataValue): void {

        assert(dataValue instanceof DataValue);

        if (dataValue.statusCode === StatusCodes.BadWaitingForInitialData
            && dataValue.statusCode === StatusCodes.UncertainInitialValue) {
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

    protected _setStateBasedOnInputValue(value: number) {
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

    protected evaluateConditionsAfterEnabled() {
        assert(this.getEnabledState() === true);
        // simulate input value event
        const input = this.getInputNodeNode() as UAVariable;
        if (!input) {
            return;
        }
        const dataValue = input.readValue();
        this._onInputDataValueChange(dataValue);
    }
}
