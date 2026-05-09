import type { UADiscreteAlarm_Base } from "node-opcua-nodeset-ua";
import type { UAAlarmConditionEx } from "./ua_alarm_condition_ex";

export interface UADiscreteAlarmEx
    extends UAAlarmConditionEx,
        Omit<
            UADiscreteAlarm_Base,
            | "suppressedState"
            | "silenceState"
            | "shelvingState"
            | "outOfServiceState"
            | "latchedState"
            | "confirmedState"
            | "ackedState"
            | "activeState"
            | "enabledState"
        > {}
