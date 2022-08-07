/* eslint-disable max-statements */
/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { VariantOptions } from "node-opcua-variant";
import { UAEventType } from "node-opcua-address-space-base";
import { NamespacePrivate } from "../namespace_private";
import { _install_TwoStateVariable_machinery } from "../state_machine/ua_two_state_variable";
import { UANonExclusiveLimitAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_non_exclusive_limit_alarm_ex";
import { ConditionInfo } from "../../source/interfaces/alarms_and_conditions/condition_info_i";
import { InstantiateLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import { ConditionInfoImpl } from "./condition_info_impl";
import { UALimitAlarmImpl } from "./ua_limit_alarm_impl";

export declare interface UANonExclusiveLimitAlarmImpl extends UANonExclusiveLimitAlarmEx, UALimitAlarmImpl {
    on(eventName: string, eventHandler: any): this;
}
export class UANonExclusiveLimitAlarmImpl extends UALimitAlarmImpl implements UANonExclusiveLimitAlarmEx {
    public static instantiate(
        namespace: NamespacePrivate,
        type: UAEventType | NodeId | string,
        options: InstantiateLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UANonExclusiveLimitAlarmImpl {
        const addressSpace = namespace.addressSpace;

        options.optionals = options.optionals || [];

        if (Object.prototype.hasOwnProperty.call(options, "lowLowLimit")) {
            options.optionals.push("LowLowLimit");
            options.optionals.push("LowLowState");
        }
        if (Object.prototype.hasOwnProperty.call(options, "lowLimit")) {
            options.optionals.push("LowLimit");
            options.optionals.push("LowState");
        }
        if (Object.prototype.hasOwnProperty.call(options, "highLimit")) {
            options.optionals.push("HighLimit");
            options.optionals.push("HighState");
        }
        if (Object.prototype.hasOwnProperty.call(options, "highHighLimit")) {
            options.optionals.push("HighHighLimit");
            options.optionals.push("HighHighState");
        }
        const nonExclusiveAlarmType = addressSpace.findEventType(type);

        /* istanbul ignore next */
        if (!nonExclusiveAlarmType) {
            throw new Error(" cannot find Alarm Condition Type for " + type);
        }

        const nonExclusiveLimitAlarmType = addressSpace.findEventType("NonExclusiveLimitAlarmType");
        /* istanbul ignore next */
        if (!nonExclusiveLimitAlarmType) {
            throw new Error("cannot find NonExclusiveLimitAlarmType");
        }
        // assert(type nonExclusiveLimitAlarmType.browseName.toString());

        const alarm = UALimitAlarmImpl.instantiate(namespace, type, options, data) as UANonExclusiveLimitAlarmImpl;
        Object.setPrototypeOf(alarm, UANonExclusiveLimitAlarmImpl.prototype);
        assert(alarm instanceof UALimitAlarmImpl);
        assert(alarm instanceof UANonExclusiveLimitAlarmImpl);

        // ---------------- install States
        if (alarm.lowLowState) {
            _install_TwoStateVariable_machinery(alarm.lowLowState, {
                falseState: "LowLow inactive",
                trueState: "LowLow active"
            });
            alarm.lowLowState.setValue(false);
            assert(Object.prototype.hasOwnProperty.call(alarm, "lowLowLimit"));
        }
        if (alarm.lowState) {
            _install_TwoStateVariable_machinery(alarm.lowState, {
                falseState: "Low inactive",
                trueState: "Low active"
            });
            alarm.lowState.setValue(false);
            assert(Object.prototype.hasOwnProperty.call(alarm, "lowLimit"));
        }
        if (alarm.highState) {
            _install_TwoStateVariable_machinery(alarm.highState, {
                falseState: "High inactive",
                trueState: "High active"
            });
            alarm.highState.setValue(false);
            assert(Object.prototype.hasOwnProperty.call(alarm, "highLimit"));
        }
        if (alarm.highHighState) {
            _install_TwoStateVariable_machinery(alarm.highHighState, {
                falseState: "HighHigh inactive",
                trueState: "HighHigh active"
            });
            alarm.highHighState.setValue(false);
            assert(Object.prototype.hasOwnProperty.call(alarm, "highHighLimit"));
        }

        alarm.activeState.setValue(false);

        alarm.updateState();

        return alarm;
    }

    public _calculateConditionInfo(
        states: string | null,
        isActive: boolean,
        value: string,
        oldConditionInfo: ConditionInfo
    ): ConditionInfo {
        if (!isActive) {
            return new ConditionInfoImpl({
                message: "Back to normal",
                quality: StatusCodes.Good,
                retain: true,
                severity: 0
            });
        } else {
            return new ConditionInfoImpl({
                message: "Condition value is " + value + " and state is " + states,
                quality: StatusCodes.Good,
                retain: true,
                severity: 150
            });
        }
    }

    public _signalNewCondition2(states: { [key: string]: string }, isActive: boolean, value: string): void {
        const alarm = this as any;

        if (typeof states === "string") {
            return;
        }

        function _install(name: string) {
            if (states[name] !== "unset") {
                alarm[name + "State"].setValue(states[name]);
            }
        }

        _install("highHigh");
        _install("high");
        _install("low");
        _install("lowLow");

        // build-up state string
        let state_str = Object.keys(states)
            .map((s: string) => (states[s] ? s : null))
            .filter((a) => a !== null)
            .join(";"); //

        state_str = JSON.stringify(states);

        UALimitAlarmImpl.prototype._signalNewCondition.call(this, state_str, isActive, value);
    }

    protected _setStateBasedOnInputValue(value: number): void {
        assert(isFinite(value), "expecting a valid value here");

        let isActive = false;

        const states: any = {
            highHigh: this.highHighState ? this.highHighState.getValue() : "unset",
            high: this.highState ? this.highState.getValue() : "unset",
            low: this.lowState ? this.lowState.getValue() : "unset",
            lowLow: this.lowLowState ? this.lowLowState.getValue() : "unset"
        };

        let count = 0;

        function ___p(stateName: string, func_value: () => boolean) {
            if (states[stateName] !== "unset") {
                const val = func_value();
                isActive = isActive || val;
                if (states[stateName] !== val) {
                    states[stateName] = val;
                    count += 1;
                }
            }
        }

        ___p("highHigh", () => {
            return this.getHighHighLimit() < value;
        });
        ___p("high", () => {
            return this.getHighLimit() < value;
        });
        ___p("low", () => {
            return this.getLowLimit() > value;
        });
        ___p("lowLow", () => {
            return this.getLowLowLimit() > value;
        });

        if (count > 0) {
            this._signalNewCondition2(states, isActive, value.toString());
        }
    }
}
