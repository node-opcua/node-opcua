import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UASystemOffNormalAlarm, UASystemOffNormalAlarm_Base } from "./ua_system_off_normal_alarm";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CertificateExpirationAlarmType i=13225                      |
 * |isAbstract      |false                                                       |
 */
export interface UACertificateExpirationAlarm_Base extends UASystemOffNormalAlarm_Base {
    expirationDate: UAProperty<Date, DataType.DateTime>;
    expirationLimit?: UAProperty<number, DataType.Double>;
    certificateType: UAProperty<NodeId, DataType.NodeId>;
    certificate: UAProperty<Buffer, DataType.ByteString>;
}
export interface UACertificateExpirationAlarm extends UASystemOffNormalAlarm, UACertificateExpirationAlarm_Base {}