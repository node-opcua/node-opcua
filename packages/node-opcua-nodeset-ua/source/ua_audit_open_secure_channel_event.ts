import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumMessageSecurityMode } from "./enum_message_security_mode";
import type { EnumSecurityTokenRequest } from "./enum_security_token_request";
import type { UAAuditChannelEvent, UAAuditChannelEvent_Base } from "./ua_audit_channel_event";

// ----- this file has been automatically generated - do not edit

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
export interface UAAuditOpenSecureChannelEvent extends UAAuditChannelEvent, UAAuditOpenSecureChannelEvent_Base {}