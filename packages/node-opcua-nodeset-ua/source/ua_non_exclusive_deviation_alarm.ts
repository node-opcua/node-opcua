import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UANonExclusiveLimitAlarm, UANonExclusiveLimitAlarm_Base } from "./ua_non_exclusive_limit_alarm";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NonExclusiveDeviationAlarmType i=10368                      |
 * |isAbstract      |false                                                       |
 */
export interface UANonExclusiveDeviationAlarm_Base extends UANonExclusiveLimitAlarm_Base {
    setpointNode: UAProperty<NodeId, DataType.NodeId>;
    baseSetpointNode?: UAProperty<NodeId, DataType.NodeId>;
}
export interface UANonExclusiveDeviationAlarm extends UANonExclusiveLimitAlarm, UANonExclusiveDeviationAlarm_Base {}