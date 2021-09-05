// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAuditSessionEvent, UAAuditSessionEvent_Base } from "./ua_audit_session_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditCreateSessionEventType ns=0;i=2071           |
 * |isAbstract      |true                                              |
 */
export interface UAAuditCreateSessionEvent_Base extends UAAuditSessionEvent_Base {
    secureChannelId: UAProperty<UAString, /*z*/DataType.String>;
    clientCertificate: UAProperty<Buffer, /*z*/DataType.ByteString>;
    clientCertificateThumbprint: UAProperty<UAString, /*z*/DataType.String>;
    revisedSessionTimeout: UAProperty<number, /*z*/DataType.Double>;
}
export interface UAAuditCreateSessionEvent extends UAAuditSessionEvent, UAAuditCreateSessionEvent_Base {
}