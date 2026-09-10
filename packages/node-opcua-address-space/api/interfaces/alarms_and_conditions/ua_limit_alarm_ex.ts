import type { UALimitAlarm_Base } from "node-opcua-nodeset-ua";
import type { UATwoStateVariableEx } from "../../ua_two_state_variable_ex.js";
import type { UAShelvedStateMachineEx } from "../state_machine/ua_shelved_state_machine_ex.js";
import type { UAAlarmConditionEx, UAAlarmConditionHelper } from "./ua_alarm_condition_ex.js";

export interface UALimitAlarmHelper extends UAAlarmConditionHelper {
    setLowLowLimit(value: number): void;
    setLowLimit(value: number): void;
    setHighLimit(value: number): void;
    setHighHighLimit(value: number): void;
    getHighHighLimit(): number;
    getHighLimit(): number;
    getLowLimit(): number;
    getLowLowLimit(): number;

    /**
     * How the alarm turns the value of its input node into limit states. Assign to it to give
     * a limit alarm a rule of its own:
     *
     * ```ts
     * alarm.setStateBasedOnInputValue = (value) => {
     *     const isActive = value > alarm.getHighLimit();
     *     alarm.signalNewCondition(isActive ? "High" : null, isActive, value.toFixed(3));
     * };
     * ```
     *
     * Every concrete limit alarm type already defines this, so assigning to one replaces the
     * rule it came with; the base LimitAlarmType has no limit states of its own and throws.
     *
     * The old name `_setStateBasedOnInputValue` still works and is deprecated.
     */
    setStateBasedOnInputValue(value: number): void;
}
export interface UALimitAlarmEx extends UALimitAlarm_Base, UAAlarmConditionEx, UALimitAlarmHelper {
    enabledState: UATwoStateVariableEx;
    ackedState: UATwoStateVariableEx;
    confirmedState?: UATwoStateVariableEx;
    activeState: UATwoStateVariableEx;
    latchedState?: UATwoStateVariableEx;
    outOfServiceState?: UATwoStateVariableEx;
    silenceState?: UATwoStateVariableEx;
    shelvingState?: UAShelvedStateMachineEx;
    suppressedState?: UATwoStateVariableEx;
}
