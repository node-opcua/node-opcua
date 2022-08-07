import { UANonExclusiveLimitAlarm_Base } from "node-opcua-nodeset-ua";
import { UATwoStateVariableEx } from "../../ua_two_state_variable_ex";
import { UALimitAlarmEx } from "./ua_limit_alarm_ex";

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
