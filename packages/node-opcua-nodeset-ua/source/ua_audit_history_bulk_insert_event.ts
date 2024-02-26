// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAAuditEvent, UAAuditEvent_Base } from "./ua_audit_event"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditHistoryBulkInsertEventType i=32803                     |
 * |isAbstract      |false                                                       |
 */
export interface UAAuditHistoryBulkInsertEvent_Base extends UAAuditEvent_Base {
    updatedNode: UAProperty<NodeId, DataType.NodeId>;
    startTime: UAProperty<Date, DataType.DateTime>;
    endTime: UAProperty<Date, DataType.DateTime>;
}
export interface UAAuditHistoryBulkInsertEvent extends UAAuditEvent, UAAuditHistoryBulkInsertEvent_Base {
}