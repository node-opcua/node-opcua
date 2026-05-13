import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAAlarmCondition, UAAlarmCondition_Base } from "./ua_alarm_condition";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DiscrepancyAlarmType i=17080                                |
 * |isAbstract      |false                                                       |
 */
export interface UADiscrepancyAlarm_Base extends UAAlarmCondition_Base {
    targetValueNode: UAProperty<NodeId, DataType.NodeId>;
    expectedTime: UAProperty<number, DataType.Double>;
    tolerance?: UAProperty<number, DataType.Double>;
}
export interface UADiscrepancyAlarm extends UAAlarmCondition, UADiscrepancyAlarm_Base {}