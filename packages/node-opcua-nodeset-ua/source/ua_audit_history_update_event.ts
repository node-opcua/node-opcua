import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAAuditUpdateEvent, UAAuditUpdateEvent_Base } from "./ua_audit_update_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditHistoryUpdateEventType i=2104                          |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditHistoryUpdateEvent_Base extends UAAuditUpdateEvent_Base {
    parameterDataTypeId: UAProperty<NodeId, DataType.NodeId>;
}
export interface UAAuditHistoryUpdateEvent extends UAAuditUpdateEvent, UAAuditHistoryUpdateEvent_Base {}