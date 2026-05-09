import type { UANonExclusiveLimitAlarm_Base } from "node-opcua-nodeset-ua";
import type { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import type { UALimitAlarmEx } from "./ua_limit_alarm_ex";

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
