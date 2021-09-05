// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAAuditSecurityEvent, UAAuditSecurityEvent_Base } from "./ua_audit_security_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditSessionEventType ns=0;i=2069                 |
 * |isAbstract      |true                                              |
 */
export interface UAAuditSessionEvent_Base extends UAAuditSecurityEvent_Base {
    sessionId: UAProperty<NodeId, /*z*/DataType.NodeId>;
}
export interface UAAuditSessionEvent extends UAAuditSecurityEvent, UAAuditSessionEvent_Base {
}