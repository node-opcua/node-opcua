// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAuditSecurityEvent, UAAuditSecurityEvent_Base } from "./ua_audit_security_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditChannelEventType ns=0;i=2059                 |
 * |isAbstract      |true                                              |
 */
export interface UAAuditChannelEvent_Base extends UAAuditSecurityEvent_Base {
    secureChannelId: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAuditChannelEvent extends UAAuditSecurityEvent, UAAuditChannelEvent_Base {
}