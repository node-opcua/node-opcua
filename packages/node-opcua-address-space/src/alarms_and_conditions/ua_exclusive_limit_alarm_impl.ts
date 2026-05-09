import type { UAEventType, UAObject } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { NodeId } from "node-opcua-nodeid";
import type { VariantOptions } from "node-opcua-variant";
import type { InstantiateLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import type { UAExclusiveLimitAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_exclusive_limit_alarm_ex";
import type { NamespacePrivate } from "../namespace_private";
import { promoteToStateMachine } from "../state_machine/finite_state_machine";
import { UALimitAlarmImpl, UALimitAlarmImplBase } from "./ua_limit_alarm_impl";

const validState = ["HighHigh", "High", "Low", "LowLow", null];

export class UAExclusiveLimitAlarmImplBase extends UALimitAlarmImpl {
    /***
     *
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

        /* c8 ignore next */
        if (!exclusiveAlarmType) {
            throw new Error(` cannot find Alarm Condition Type for ${type}`);
        }

        const exclusiveLimitAlarmType = addressSpace.findEventType("ExclusiveLimitAlarmType");
        /* c8 ignore next */
        if (!exclusiveLimitAlarmType) {
            throw new Error("cannot find ExclusiveLimitAlarmType");
        }

        const node = UALimitAlarmImplBase.instantiate(namespace, type, options, data);
        Object.setPrototypeOf(node, UAExclusiveLimitAlarmImplBase.prototype);
        const alarm = node as unknown as UAExclusiveLimitAlarmImplBase;
        assert(alarm instanceof UAExclusiveLimitAlarmImpl);
        assert(alarm instanceof UALimitAlarmImpl);

        // ---------------- install LimitState StateMachine
        assert(alarm.$10.limitState, "limitState is mandatory");
        promoteToStateMachine(alarm.$10.limitState as unknown as UAObject);

        // start with a inactive state
        alarm.activeState.setValue(false);

        alarm.updateState();

        return alarm as UAExclusiveLimitAlarmImpl;
    }

    private get $10() {
        return this as unknown as UAExclusiveLimitAlarmEx;
    }
    public _signalNewCondition(stateName: string | null, isActive: boolean, value: string): void {
        assert(stateName === null || typeof isActive === "boolean");
        assert(validState.indexOf(stateName) >= 0, `must have a valid state : ${stateName}`);

        const _oldState = this.$10.limitState.getCurrentState();
        const _oldActive = this.activeState.getValue();

        if (stateName) {
            this.$10.limitState.setState(stateName);
        } else {
            assert(stateName === null);
            this.$10.limitState.setState(stateName);
        }
        super._signalNewCondition(stateName, isActive, value);
    }

    public _setStateBasedOnInputValue(value: number): void {
        assert(Number.isFinite(value));
        let isActive = false;

        let state = null;

        const oldState = this.$10.limitState.getCurrentState();

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
            this._signalNewCondition(state, isActive, value.toFixed(3));
        }
    }
}

export type UAExclusiveLimitAlarmImpl = UAExclusiveLimitAlarmImplBase & UAExclusiveLimitAlarmEx;
export const UAExclusiveLimitAlarmImpl = UAExclusiveLimitAlarmImplBase as unknown as new () => UAExclusiveLimitAlarmImpl;
