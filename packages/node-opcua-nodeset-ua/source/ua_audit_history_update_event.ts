// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAAuditUpdateEvent, UAAuditUpdateEvent_Base } from "./ua_audit_update_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditHistoryUpdateEventType ns=0;i=2104           |
 * |isAbstract      |true                                              |
 */
export interface UAAuditHistoryUpdateEvent_Base extends UAAuditUpdateEvent_Base {
    parameterDataTypeId: UAProperty<NodeId, /*z*/DataType.NodeId>;
}
export interface UAAuditHistoryUpdateEvent extends UAAuditUpdateEvent, UAAuditHistoryUpdateEvent_Base {
}