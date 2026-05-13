import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UACertificateExpirationAlarm } from "./ua_certificate_expiration_alarm";
import type { UATrustList } from "./ua_trust_list";
import type { UATrustListOutOfDateAlarm } from "./ua_trust_list_out_of_date_alarm";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CertificateGroupType i=12555                                |
 * |isAbstract      |false                                                       |
 */
export interface UACertificateGroup_Base {
    trustList: UATrustList;
    certificateTypes: UAProperty<NodeId[], DataType.NodeId>;
    purpose?: UAProperty<NodeId, DataType.NodeId>;
    certificateExpired?: UACertificateExpirationAlarm;
    trustListOutOfDate?: UATrustListOutOfDateAlarm;
    getRejectedList?: UAMethod;
}
export interface UACertificateGroup extends UAObject, UACertificateGroup_Base {}