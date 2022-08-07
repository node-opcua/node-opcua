/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { NodeId } from "node-opcua-nodeid";
import { UAObject } from "node-opcua-address-space-base";
import { VariantOptions } from "node-opcua-variant";
import { UAEventType } from "node-opcua-address-space-base";
import { NamespacePrivate } from "../namespace_private";
import { promoteToStateMachine } from "../state_machine/finite_state_machine";
import { UAExclusiveLimitAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_exclusive_limit_alarm_ex";
import { InstantiateLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import {  UALimitAlarmImpl } from "./ua_limit_alarm_impl";

const validState = ["HighHigh", "High", "Low", "LowLow", null];

export declare interface UAExclusiveLimitAlarmImpl extends UAExclusiveLimitAlarmEx {}

export class UAExclusiveLimitAlarmImpl extends UALimitAlarmImpl implements UAExclusiveLimitAlarmEx {
    /***
     *
     * @method (static)instantiate
     * @param namespace {INamespace}
     * @param type
     * @param options
     * @param data
     * @return {UAExclusiveLimitAlarm}
     */
    public static instantiate(
        namespace: NamespacePrivate,
        type: UAEventType | string | NodeId,
        options: InstantiateLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UAExclusiveLimitAlarmImpl {
        const addressSpace = namespace.addressSpace;

        const exclusiveAlarmType = addressSpace.findEventType(type);

        /* istanbul ignore next */
        if (!exclusiveAlarmType) {
            throw new Error(" cannot find Alarm Condition Type for " + type);
        }

        const exclusiveLimitAlarmType = addressSpace.findEventType("ExclusiveLimitAlarmType");
        /* istanbul ignore next */
        if (!exclusiveLimitAlarmType) {
            throw new Error("cannot find ExclusiveLimitAlarmType");
        }

        const node = UALimitAlarmImpl.instantiate(namespace, type, options, data);
        Object.setPrototypeOf(node, UAExclusiveLimitAlarmImpl.prototype);
        const alarm = node as any as UAExclusiveLimitAlarmImpl;
        assert(alarm instanceof UAExclusiveLimitAlarmImpl);
        assert(alarm instanceof UALimitAlarmImpl);

        // ---------------- install LimitState StateMachine
        assert(alarm.limitState, "limitState is mandatory");
        promoteToStateMachine(alarm.limitState as unknown as UAObject);

        // start with a inactive state
        alarm.activeState.setValue(false);

        alarm.updateState();

        return alarm;
    }

    public _signalNewCondition(stateName: string | null, isActive: boolean, value: string): void {
        assert(stateName === null || typeof isActive === "boolean");
        assert(validState.indexOf(stateName) >= 0, "must have a valid state : " + stateName);

        const oldState = this.limitState.getCurrentState();
        const oldActive = this.activeState.getValue();

        if (stateName) {
            this.limitState.setState(stateName);
        } else {
            assert(stateName === null);
            this.limitState.setState(stateName);
        }
        super._signalNewCondition(stateName, isActive, value);
    }

    public _setStateBasedOnInputValue(value: number): void {
        assert(isFinite(value));
        let isActive = false;

        let state = null;

        const oldState = this.limitState.getCurrentState();

        if (this.highHighLimit && this.getHighHighLimit() < value) {
            state = "HighHigh";
            isActive = true;
        } else if (this.highLimit && this.getHighLimit() < value) {
            state = "High";
            isActive = true;
        } else if (this.lowLowLimit && this.getLowLowLimit() > value) {
            state = "LowLow";
            isActive = true;
        } else if (this.lowLimit && this.getLowLimit() > value) {
            state = "Low";
            isActive = true;
        }

        if (state !== oldState) {
            this._signalNewCondition(state, isActive, value.toString());
        }
    }
}
