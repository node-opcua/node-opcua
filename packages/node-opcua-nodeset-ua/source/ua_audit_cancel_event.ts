// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAAuditSessionEvent, UAAuditSessionEvent_Base } from "./ua_audit_session_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditCancelEventType ns=0;i=2078                  |
 * |isAbstract      |true                                              |
 */
export interface UAAuditCancelEvent_Base extends UAAuditSessionEvent_Base {
    requestHandle: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAuditCancelEvent extends UAAuditSessionEvent, UAAuditCancelEvent_Base {
}