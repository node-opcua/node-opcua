import type { UAExclusiveLimitAlarm_Base } from "node-opcua-nodeset-ua";
import type { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import type { UAExclusiveLimitStateMachineEx } from "../state_machine/ua_exclusive_limit_state_machine_type_ex";
import type { UAShelvedStateMachineEx } from "../state_machine/ua_shelved_state_machine_ex";
import type { UALimitAlarmEx, UALimitAlarmHelper } from "./ua_limit_alarm_ex";

/** @deprecated kept for backward compatibility — alias of UALimitAlarmHelper. */
export type UAExclusiveLimitAlarmHelper = UALimitAlarmHelper;

export interface UAExclusiveLimitAlarmEx extends Omit<UAExclusiveLimitAlarm_Base, "limitState">, UALimitAlarmEx {
    ackedState: UATwoStateVariableEx;
    activeState: UATwoStateVariableEx;
    confirmedState?: UATwoStateVariableEx;
    enabledState: UATwoStateVariableEx;
    latchedState?: UATwoStateVariableEx;
    outOfServiceState?: UATwoStateVariableEx;
    silenceState?: UATwoStateVariableEx;
    suppressedState?: UATwoStateVariableEx;
    limitState: UAExclusiveLimitStateMachineEx;
    shelvingState?: UAShelvedStateMachineEx;
}
