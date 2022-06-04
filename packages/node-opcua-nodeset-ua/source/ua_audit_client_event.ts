// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditClientEventType ns=0;i=23606                 |
 * |isAbstract      |true                                              |
 */
export interface UAAuditClientEvent_Base extends UAAuditEvent_Base {
    serverUri: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAuditClientEvent extends UAAuditEvent, UAAuditClientEvent_Base {
}