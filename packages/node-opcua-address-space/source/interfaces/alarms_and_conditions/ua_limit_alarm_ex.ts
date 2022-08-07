import { UALimitAlarm_Base } from "node-opcua-nodeset-ua";
import { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import { UAShelvedStateMachineEx } from "../state_machine/ua_shelved_state_machine_ex";
import { UAAlarmConditionHelper, UAAlarmConditionEx } from "./ua_alarm_condition_ex";

export interface UALimitAlarmHelper extends UAAlarmConditionHelper {
    setLowLowLimit(value: number): void;
    setLowLimit(value: number): void;
    setHighLimit(value: number): void;
    setHighHighLimit(value: number): void;
    getHighHighLimit(): number;
    getHighLimit(): number;
    getLowLimit(): number;
    getLowLowLimit(): number;
}
export interface UALimitAlarmEx extends UALimitAlarm_Base, UAAlarmConditionEx, UALimitAlarmHelper {
    on(eventName: string, eventHandler: any): this;

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
