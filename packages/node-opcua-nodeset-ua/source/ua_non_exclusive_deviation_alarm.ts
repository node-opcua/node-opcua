// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UANonExclusiveLimitAlarm, UANonExclusiveLimitAlarm_Base } from "./ua_non_exclusive_limit_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |NonExclusiveDeviationAlarmType ns=0;i=10368       |
 * |isAbstract      |false                                             |
 */
export interface UANonExclusiveDeviationAlarm_Base extends UANonExclusiveLimitAlarm_Base {
    setpointNode: UAProperty<NodeId, /*z*/DataType.NodeId>;
    baseSetpointNode?: UAProperty<NodeId, /*z*/DataType.NodeId>;
}
export interface UANonExclusiveDeviationAlarm extends UANonExclusiveLimitAlarm, UANonExclusiveDeviationAlarm_Base {
}