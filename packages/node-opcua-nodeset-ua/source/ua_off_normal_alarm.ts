// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UADiscreteAlarm, UADiscreteAlarm_Base } from "./ua_discrete_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |OffNormalAlarmType ns=0;i=10637                   |
 * |isAbstract      |false                                             |
 */
export interface UAOffNormalAlarm_Base extends UADiscreteAlarm_Base {
    normalState: UAProperty<NodeId, /*z*/DataType.NodeId>;
}
export interface UAOffNormalAlarm extends UADiscreteAlarm, UAOffNormalAlarm_Base {
}