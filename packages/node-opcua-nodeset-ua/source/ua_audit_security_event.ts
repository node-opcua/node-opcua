// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { StatusCode } from "node-opcua-status-code"
import { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditSecurityEventType ns=0;i=2058                |
 * |isAbstract      |true                                              |
 */
export interface UAAuditSecurityEvent_Base extends UAAuditEvent_Base {
    statusCodeId?: UAProperty<StatusCode, /*z*/DataType.StatusCode>;
}
export interface UAAuditSecurityEvent extends UAAuditEvent, UAAuditSecurityEvent_Base {
}