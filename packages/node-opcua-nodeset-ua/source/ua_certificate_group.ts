// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UATrustList } from "./ua_trust_list"
import { UACertificateExpirationAlarm } from "./ua_certificate_expiration_alarm"
import { UATrustListOutOfDateAlarm } from "./ua_trust_list_out_of_date_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |CertificateGroupType ns=0;i=12555                 |
 * |isAbstract      |false                                             |
 */
export interface UACertificateGroup_Base {
    trustList: UATrustList;
    certificateTypes: UAProperty<NodeId[], /*z*/DataType.NodeId>;
    getRejectedList?: UAMethod;
    certificateExpired?: UACertificateExpirationAlarm;
    trustListOutOfDate?: UATrustListOutOfDateAlarm;
}
export interface UACertificateGroup extends UAObject, UACertificateGroup_Base {
}