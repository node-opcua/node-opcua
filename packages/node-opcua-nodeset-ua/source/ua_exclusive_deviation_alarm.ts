import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAExclusiveLimitAlarm, UAExclusiveLimitAlarm_Base } from "./ua_exclusive_limit_alarm";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ExclusiveDeviationAlarmType i=9764                          |
 * |isAbstract      |false                                                       |
 */
export interface UAExclusiveDeviationAlarm_Base extends UAExclusiveLimitAlarm_Base {
    setpointNode: UAProperty<NodeId, DataType.NodeId>;
    baseSetpointNode?: UAProperty<NodeId, DataType.NodeId>;
}
export interface UAExclusiveDeviationAlarm extends UAExclusiveLimitAlarm, UAExclusiveDeviationAlarm_Base {}