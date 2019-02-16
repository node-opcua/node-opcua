/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import * as _ from "underscore";

import { NodeId } from "node-opcua-nodeid";
import { Namespace, UAEventType } from "../../source";
import { AddressSpace } from "../address_space";
import { NamespacePrivate } from "../namespace_private";
import { promoteToStateMachine, StateMachine } from "../state_machine/finite_state_machine";
import { UALimitAlarm } from "./ua_limit_alarm";

const validState = ["HighHigh", "High", "Low", "LowLow", null];

export interface UAExclusiveLimitAlarm extends UALimitAlarm {
    limitState: StateMachine;
}
export class UAExclusiveLimitAlarm extends UALimitAlarm {

    /***
     *
     * @method (static)instantiate
     * @param namespace {Namespace}
     * @param type
     * @param options
     * @param data
     * @return {UAExclusiveLimitAlarm}
     */
    public static instantiate(
      namespace: NamespacePrivate,
      type: UAEventType |  string | NodeId,
      options: any,
      data: any
    ): UAExclusiveLimitAlarm {

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

        const node = UALimitAlarm.instantiate(namespace, type, options, data);
        Object.setPrototypeOf(node, UAExclusiveLimitAlarm.prototype);
        const alarm = node as any as UAExclusiveLimitAlarm;
        assert(alarm instanceof UAExclusiveLimitAlarm);
        assert(alarm instanceof UALimitAlarm);

        // ---------------- install LimitState StateMachine
        assert(alarm.limitState, "limitState is mandatory");
        promoteToStateMachine(alarm.limitState);

        // start with a inactive state
        alarm.activeState.setValue(false);

        alarm.updateState();

        return alarm;
    }

    public _signalNewCondition(
      stateName: string | null,
      isActive: boolean,
      value: any): void {
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

    public _setStateBasedOnInputValue(value: number) {

        assert(_.isFinite(value));
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
            this._signalNewCondition(state, isActive, value);
        }
    }
}
