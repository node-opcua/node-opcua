// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditUpdateMethodEventType ns=0;i=2127            |
 * |isAbstract      |true                                              |
 */
export interface UAAuditUpdateMethodEvent_Base extends UAAuditEvent_Base {
    methodId: UAProperty<NodeId, /*z*/DataType.NodeId>;
    inputArguments: UAProperty<any, any>;
}
export interface UAAuditUpdateMethodEvent extends UAAuditEvent, UAAuditUpdateMethodEvent_Base {
}