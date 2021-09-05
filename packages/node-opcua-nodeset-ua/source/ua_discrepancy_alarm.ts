// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAAlarmCondition, UAAlarmCondition_Base } from "./ua_alarm_condition"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |DiscrepancyAlarmType ns=0;i=17080                 |
 * |isAbstract      |false                                             |
 */
export interface UADiscrepancyAlarm_Base extends UAAlarmCondition_Base {
    targetValueNode: UAProperty<NodeId, /*z*/DataType.NodeId>;
    expectedTime: UAProperty<number, /*z*/DataType.Double>;
    tolerance?: UAProperty<number, /*z*/DataType.Double>;
}
export interface UADiscrepancyAlarm extends UAAlarmCondition, UADiscrepancyAlarm_Base {
}