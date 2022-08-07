import { UAExclusiveLimitAlarm_Base } from "node-opcua-nodeset-ua";
import { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import { UAExclusiveLimitStateMachineEx } from "../state_machine/ua_exclusive_limit_state_machine_type_ex";
import { UAShelvedStateMachineEx } from "../state_machine/ua_shelved_state_machine_ex";
import { UALimitAlarmEx, UALimitAlarmHelper } from "./ua_limit_alarm_ex";

export interface UAExclusiveLimitAlarmHelper extends UALimitAlarmHelper {}
export interface UAExclusiveLimitAlarmEx
    extends Omit<UAExclusiveLimitAlarm_Base, "limitState">,
        UALimitAlarmEx,
        UAExclusiveLimitAlarmHelper {
    on(eventName: string, eventHandler: any): this;

    ackedState: UATwoStateVariableEx;
    activeState: UATwoStateVariableEx;
    confirmedState?: UATwoStateVariableEx;
    enabledState: UATwoStateVariableEx;
    latchedState?: UATwoStateVariableEx;
    outOfServiceState?: UATwoStateVariableEx;
    silenceState?: UATwoStateVariableEx;
    suppressedState?: UATwoStateVariableEx;
    //
    limitState: UAExclusiveLimitStateMachineEx;
    shelvingState?: UAShelvedStateMachineEx;
}
