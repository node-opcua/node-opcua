/* eslint-disable max-statements */
/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import type { BaseNode, UAEventType, UAVariable } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import type { VariantOptions } from "node-opcua-variant";
import type { ConditionInfo } from "../../source/interfaces/alarms_and_conditions/condition_info_i";
import type { InstantiateLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import type { UANonExclusiveLimitAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_non_exclusive_limit_alarm_ex";
import type { NamespacePrivate } from "../namespace_private";
import { _install_TwoStateVariable_machinery } from "../state_machine/ua_two_state_variable";
import { ConditionInfoImpl } from "./condition_info_impl";
import { UALimitAlarmImpl, UALimitAlarmImplBase } from "./ua_limit_alarm_impl";

interface IState {
    highHigh: boolean | "unset";
    high: boolean | "unset";
    low: boolean | "unset";
    lowLow: boolean | "unset";
}

export class UANonExclusiveLimitAlarmImplBase extends UALimitAlarmImpl implements UANonExclusiveLimitAlarmEx {
    public static instantiate(
        namespace: NamespacePrivate,
        type: UAEventType | NodeId | string,
        options: InstantiateLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UANonExclusiveLimitAlarmImpl {
        const addressSpace = namespace.addressSpace;

        options.optionals = options.optionals || [];

        if (Object.hasOwn(options, "lowLowLimit")) {
            options.optionals.push("LowLowLimit");
            options.optionals.push("LowLowState");
        }
        if (Object.hasOwn(options, "lowLimit")) {
            options.optionals.push("LowLimit");
            options.optionals.push("LowState");
        }
        if (Object.hasOwn(options, "highLimit")) {
            options.optionals.push("HighLimit");
            options.optionals.push("HighState");
        }
        if (Object.hasOwn(options, "highHighLimit")) {
            options.optionals.push("HighHighLimit");
            options.optionals.push("HighHighState");
        }
        const nonExclusiveAlarmType = addressSpace.findEventType(type);

        /* c8 ignore next */
        if (!nonExclusiveAlarmType) {
            throw new Error(` cannot find Alarm Condition Type for ${type}`);
        }

        const nonExclusiveLimitAlarmType = addressSpace.findEventType("NonExclusiveLimitAlarmType");
        /* c8 ignore next */
        if (!nonExclusiveLimitAlarmType) {
            throw new Error("cannot find NonExclusiveLimitAlarmType");
        }
        // assert(type nonExclusiveLimitAlarmType.browseName.toString());

        const alarm = UALimitAlarmImplBase.instantiate(namespace, type, options, data) as UANonExclusiveLimitAlarmImpl;
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
            assert(Object.hasOwn(alarm, "lowLowLimit"));
        }
        if (alarm.lowState) {
            _install_TwoStateVariable_machinery(alarm.lowState, {
                falseState: "Low inactive",
                trueState: "Low active"
            });
            alarm.lowState.setValue(false);
            assert(Object.hasOwn(alarm, "lowLimit"));
        }
        if (alarm.highState) {
            _install_TwoStateVariable_machinery(alarm.highState, {
                falseState: "High inactive",
                trueState: "High active"
            });
            alarm.highState.setValue(false);
            assert(Object.hasOwn(alarm, "highLimit"));
        }
        if (alarm.highHighState) {
            _install_TwoStateVariable_machinery(alarm.highHighState, {
                falseState: "HighHigh inactive",
                trueState: "HighHigh active"
            });
            alarm.highHighState.setValue(false);
            assert(Object.hasOwn(alarm, "highHighLimit"));
        }

        alarm.activeState.setValue(false);

        alarm.updateState();

        return alarm;
    }

    public _calculateConditionInfo(
        state: string | null,
        isActive: boolean,
        value: string,
        _oldConditionInfo: ConditionInfo
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
                message: `Condition is ${value} and state is ${state}`,
                quality: StatusCodes.Good,
                retain: true,
                severity: 150
            });
        }
    }

    public _signalNewCondition2(states: IState, isActive: boolean, value: string): void {
        const alarm = this as BaseNode;

        if (typeof states === "string") {
            return;
        }

        function _install(name: keyof IState) {
            if (states[name] !== "unset") {
                // browseName is PascalCase (e.g. HighHighState) while the IState key is camelCase
                const browseName = `${name[0].toUpperCase()}${name.slice(1)}State`;
                const state = alarm.getChildByName(browseName) as
                    | (UAVariable & {
                          setValue(value: boolean): void;
                      })
                    | null;
                if (!state || state.nodeClass !== NodeClass.Variable || !state.setValue) {
                    throw new Error(`expecting a ${browseName} component`);
                }
                state.setValue(states[name]);
            }
        }

        _install("highHigh");
        _install("high");
        _install("low");
        _install("lowLow");

        // build-up state string
        let state_str = Object.keys(states)
            .map((s) => (states[s as keyof IState] ? s : null))
            .filter((a) => a !== null)
            .join(";"); //

        state_str = JSON.stringify(states);

        UALimitAlarmImpl.prototype._signalNewCondition.call(this, state_str, isActive, value);
    }

    private get $12() {
        return this as unknown as UANonExclusiveLimitAlarmEx;
    }
    protected _setStateBasedOnInputValue(value: number): void {
        assert(Number.isFinite(value), "expecting a valid value here");

        let isActive = false;

        const states: IState = {
            highHigh: this.$12.highHighState ? this.$12.highHighState.getValue() : "unset",
            high: this.$12.highState ? this.$12.highState.getValue() : "unset",
            low: this.$12.lowState ? this.$12.lowState.getValue() : "unset",
            lowLow: this.$12.lowLowState ? this.$12.lowLowState.getValue() : "unset"
        };

        let count = 0;

        function ___p(stateName: keyof typeof states, func_value: () => boolean) {
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
            this._signalNewCondition2(states, isActive, value.toFixed(3));
        }
    }
}

export type UANonExclusiveLimitAlarmImpl = UANonExclusiveLimitAlarmImplBase & UANonExclusiveLimitAlarmEx;
export const UANonExclusiveLimitAlarmImpl = UANonExclusiveLimitAlarmImplBase as unknown as new () => UANonExclusiveLimitAlarmImpl;
