// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { EnumSecurityTokenRequest } from "./enum_security_token_request"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
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
    requestType: UAProperty<EnumSecurityTokenRequest, /*z*/DataType.Int32>;
    securityPolicyUri: UAProperty<UAString, /*z*/DataType.String>;
    securityMode: UAProperty<EnumMessageSecurityMode, /*z*/DataType.Int32>;
    requestedLifetime: UAProperty<number, /*z*/DataType.Double>;
    certificateErrorEventId?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAuditOpenSecureChannelEvent extends UAAuditChannelEvent, UAAuditOpenSecureChannelEvent_Base {
}