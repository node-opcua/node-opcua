import type { UAVariableT } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-basic-types";
import type { UANonExclusiveDeviationAlarm_Base } from "node-opcua-nodeset-ua";
import type { DeviationStuff } from "./deviation_stuff";
import type { UANonExclusiveLimitAlarmEx } from "./ua_non_exclusive_limit_alarm_ex";

export interface UANonExclusiveDeviationAlarmEx
    extends Omit<
            UANonExclusiveDeviationAlarm_Base,
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
            //
            | "highHighState"
            | "highState"
            | "lowState"
            | "lowLowState"
        >,
        UANonExclusiveLimitAlarmEx,
        DeviationStuff {
    setpointNodeNode: UAVariableT<number, DataType.Double> | UAVariableT<number, DataType.Float>;
}
