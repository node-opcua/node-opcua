// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAAuditHistoryUpdateEvent, UAAuditHistoryUpdateEvent_Base } from "./ua_audit_history_update_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditHistoryDeleteEventType ns=0;i=3012           |
 * |isAbstract      |true                                              |
 */
export interface UAAuditHistoryDeleteEvent_Base extends UAAuditHistoryUpdateEvent_Base {
    updatedNode: UAProperty<NodeId, /*z*/DataType.NodeId>;
}
export interface UAAuditHistoryDeleteEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryDeleteEvent_Base {
}