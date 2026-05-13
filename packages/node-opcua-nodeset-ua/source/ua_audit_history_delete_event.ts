import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAAuditHistoryUpdateEvent, UAAuditHistoryUpdateEvent_Base } from "./ua_audit_history_update_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditHistoryDeleteEventType i=3012                          |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditHistoryDeleteEvent_Base extends UAAuditHistoryUpdateEvent_Base {
    updatedNode: UAProperty<NodeId, DataType.NodeId>;
}
export interface UAAuditHistoryDeleteEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryDeleteEvent_Base {}