// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAuditCreateSessionEvent, UAAuditCreateSessionEvent_Base } from "./ua_audit_create_session_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditUrlMismatchEventType ns=0;i=2748             |
 * |isAbstract      |true                                              |
 */
export interface UAAuditUrlMismatchEvent_Base extends UAAuditCreateSessionEvent_Base {
    endpointUrl: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAuditUrlMismatchEvent extends UAAuditCreateSessionEvent, UAAuditUrlMismatchEvent_Base {
}