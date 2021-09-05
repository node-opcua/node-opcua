// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UASystemOffNormalAlarm, UASystemOffNormalAlarm_Base } from "./ua_system_off_normal_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |TrustListOutOfDateAlarmType ns=0;i=19297          |
 * |isAbstract      |false                                             |
 */
export interface UATrustListOutOfDateAlarm_Base extends UASystemOffNormalAlarm_Base {
    trustListId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    lastUpdateTime: UAProperty<Date, /*z*/DataType.DateTime>;
    updateFrequency: UAProperty<number, /*z*/DataType.Double>;
}
export interface UATrustListOutOfDateAlarm extends UASystemOffNormalAlarm, UATrustListOutOfDateAlarm_Base {
}