import { UAVariable, UAVariableT } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { NodeId } from "node-opcua-nodeid";
import { UANonExclusiveDeviationAlarm_Base } from "node-opcua-nodeset-ua";
import { DeviationStuff } from "./deviation_stuff";
import { UANonExclusiveLimitAlarmEx } from "./ua_non_exclusive_limit_alarm_ex";

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
    setpointNode: UAVariableT<NodeId, DataType.NodeId>;
    setpointNodeNode: UAVariable;
}
