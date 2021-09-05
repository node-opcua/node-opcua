// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAExclusiveLimitAlarm, UAExclusiveLimitAlarm_Base } from "./ua_exclusive_limit_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ExclusiveDeviationAlarmType ns=0;i=9764           |
 * |isAbstract      |false                                             |
 */
export interface UAExclusiveDeviationAlarm_Base extends UAExclusiveLimitAlarm_Base {
    setpointNode: UAProperty<NodeId, /*z*/DataType.NodeId>;
    baseSetpointNode?: UAProperty<NodeId, /*z*/DataType.NodeId>;
}
export interface UAExclusiveDeviationAlarm extends UAExclusiveLimitAlarm, UAExclusiveDeviationAlarm_Base {
}