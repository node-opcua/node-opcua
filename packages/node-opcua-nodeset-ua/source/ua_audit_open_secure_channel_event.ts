// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { EnumSecurityTokenRequest } from "./enum_security_token_request"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
import { UAAuditChannelEvent, UAAuditChannelEvent_Base } from "./ua_audit_channel_event"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditOpenSecureChannelEventType i=2060                      |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditOpenSecureChannelEvent_Base extends UAAuditChannelEvent_Base {
    clientCertificate: UAProperty<Buffer, DataType.ByteString>;
    clientCertificateThumbprint: UAProperty<UAString, DataType.String>;
    requestType: UAProperty<EnumSecurityTokenRequest, DataType.Int32>;
    securityPolicyUri: UAProperty<UAString, DataType.String>;
    securityMode: UAProperty<EnumMessageSecurityMode, DataType.Int32>;
    requestedLifetime: UAProperty<number, DataType.Double>;
    certificateErrorEventId?: UAProperty<Buffer, DataType.ByteString>;
}
export interface UAAuditOpenSecureChannelEvent extends UAAuditChannelEvent, UAAuditOpenSecureChannelEvent_Base {
}