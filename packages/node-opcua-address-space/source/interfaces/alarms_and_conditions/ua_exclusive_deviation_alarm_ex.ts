import { UAExclusiveDeviationAlarm_Base } from "node-opcua-nodeset-ua";
import { DeviationStuff } from "./deviation_stuff";
import { UAExclusiveLimitAlarmEx } from "./ua_exclusive_limit_alarm_ex";

export interface UAExclusiveDeviationAlarmEx
    extends Omit<
            UAExclusiveDeviationAlarm_Base,
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
        >,
        UAExclusiveLimitAlarmEx,
        DeviationStuff {}

        