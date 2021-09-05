// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAuditChannelEvent, UAAuditChannelEvent_Base } from "./ua_audit_channel_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditOpenSecureChannelEventType ns=0;i=2060       |
 * |isAbstract      |true                                              |
 */
export interface UAAuditOpenSecureChannelEvent_Base extends UAAuditChannelEvent_Base {
    clientCertificate: UAProperty<Buffer, /*z*/DataType.ByteString>;
    clientCertificateThumbprint: UAProperty<UAString, /*z*/DataType.String>;
    requestType: UAProperty<any, any>;
    securityPolicyUri: UAProperty<UAString, /*z*/DataType.String>;
    securityMode: UAProperty<any, any>;
    requestedLifetime: UAProperty<number, /*z*/DataType.Double>;
}
export interface UAAuditOpenSecureChannelEvent extends UAAuditChannelEvent, UAAuditOpenSecureChannelEvent_Base {
}