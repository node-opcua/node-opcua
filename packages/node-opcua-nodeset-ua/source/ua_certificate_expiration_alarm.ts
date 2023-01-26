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
 * |typedDefinition |CertificateExpirationAlarmType ns=0;i=13225       |
 * |isAbstract      |false                                             |
 */
export interface UACertificateExpirationAlarm_Base extends UASystemOffNormalAlarm_Base {
    expirationDate: UAProperty<Date, DataType.DateTime>;
    expirationLimit?: UAProperty<number, DataType.Double>;
    certificateType: UAProperty<NodeId, DataType.NodeId>;
    certificate: UAProperty<Buffer, DataType.ByteString>;
}
export interface UACertificateExpirationAlarm extends UASystemOffNormalAlarm, UACertificateExpirationAlarm_Base {
}