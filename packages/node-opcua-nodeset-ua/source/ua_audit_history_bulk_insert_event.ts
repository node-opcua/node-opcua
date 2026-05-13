import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditHistoryBulkInsertEventType i=32803                     |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditHistoryBulkInsertEvent_Base extends UAAuditEvent_Base {
    updatedNode: UAProperty<NodeId, DataType.NodeId>;
    startTime: UAProperty<Date, DataType.DateTime>;
    endTime: UAProperty<Date, DataType.DateTime>;
}
export interface UAAuditHistoryBulkInsertEvent extends UAAuditEvent, UAAuditHistoryBulkInsertEvent_Base {}