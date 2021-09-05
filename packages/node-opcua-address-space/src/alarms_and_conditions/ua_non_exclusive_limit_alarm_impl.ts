/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { LocalizedText } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { UANonExclusiveLimitAlarm_Base, UATwoStateVariable } from "node-opcua-nodeset-ua";
import { StatusCodes } from "node-opcua-status-code";

import { UAEventType } from "../../source";
import { UATwoStateVariableEx } from "../../source/ua_two_state_variable_ex";
import { NamespacePrivate } from "../namespace_private";
import { _install_TwoStateVariable_machinery } from "../state_machine/ua_two_state_variable";
import { ConditionInfo } from "./condition_info";
import { UALimitAlarmEx, UALimitAlarmImpl } from "./ua_limit_alarm_impl";

export interface UANonExclusiveLimitAlarmEx
    extends UALimitAlarmEx,
        Omit<
            UANonExclusiveLimitAlarm_Base,
            | "ackedState"
            | "activeState"
            | "confirmedState"
            | "enabledState"
            | "latchedState"
            | "limitState"
            | "outOfServiceState"
            | "shelvingState"
            | "silenceState"
            | "suppressedState"
        > {
    activeState: UATwoStateVariableEx;
    highHighState?: UATwoStateVariableEx;
    highState?: UATwoStateVariableEx;
    lowState?: UATwoStateVariableEx;
    lowLowState?: UATwoStateVariableEx;
}

export declare interface UANonExclusiveLimitAlarmImpl extends UANonExclusiveLimitAlarmEx, UALimitAlarmImpl {
    on(eventName: string, eventHandler: any): this;
}
export class UANonExclusiveLimitAlarmImpl extends UALimitAlarmImpl implements UANonExclusiveLimitAlarmEx {
    public static instantiate(
        namespace: NamespacePrivate,
        type: UAEventType | NodeId | string,
        options: any,
        data: any
    ): UANonExclusiveLimitAlarmImpl {
        const addressSpace = namespace.addressSpace;

        options.optionals = options.optionals || [];

        if (options.hasOwnProperty("lowLowLimit")) {
            options.optionals.push("LowLowLimit");
            options.optionals.push("LowLowState");
        }
        if (options.hasOwnProperty("lowLimit")) {
            options.optionals.push("LowLimit");
            options.optionals.push("LowState");
        }
        if (options.hasOwnProperty("highLimit")) {
            options.optionals.push("HighLimit");
            options.optionals.push("HighState");
        }
        if (options.hasOwnProperty("highHighLimit")) {
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
            assert(alarm.hasOwnProperty("lowLowLimit"));
        }
        if (alarm.lowState) {
            _install_TwoStateVariable_machinery(alarm.lowState, {
                falseState: "Low inactive",
                trueState: "Low active"
            });
            alarm.lowState.setValue(false);
            assert(alarm.hasOwnProperty("lowLimit"));
        }
        if (alarm.highState) {
            _install_TwoStateVariable_machinery(alarm.highState, {
                falseState: "High inactive",
                trueState: "High active"
            });
            alarm.highState.setValue(false);
            assert(alarm.hasOwnProperty("highLimit"));
        }
        if (alarm.highHighState) {
            _install_TwoStateVariable_machinery(alarm.highHighState, {
                falseState: "HighHigh inactive",
                trueState: "HighHigh active"
            });
            alarm.highHighState.setValue(false);
            assert(alarm.hasOwnProperty("highHighLimit"));
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
            return new ConditionInfo({
                message: "Back to normal",
                quality: StatusCodes.Good,
                retain: true,
                severity: 0
            });
        } else {
            return new ConditionInfo({
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

        const alarm = this;

        let isActive = false;

        const states: any = {
            highHigh: alarm.highHighState ? alarm.highHighState.getValue() : "unset",
            high: alarm.highState ? alarm.highState.getValue() : "unset",
            low: alarm.lowState ? alarm.lowState.getValue() : "unset",
            lowLow: alarm.lowLowState ? alarm.lowLowState.getValue() : "unset"
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
            return alarm.getHighHighLimit() < value;
        });
        ___p("high", () => {
            return alarm.getHighLimit() < value;
        });
        ___p("low", () => {
            return alarm.getLowLimit() > value;
        });
        ___p("lowLow", () => {
            return alarm.getLowLowLimit() > value;
        });

        if (count > 0) {
            alarm._signalNewCondition2(states, isActive, value.toString());
        }
    }
}
