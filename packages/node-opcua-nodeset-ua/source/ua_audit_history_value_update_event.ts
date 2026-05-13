import type { UAProperty } from "node-opcua-address-space-base";
import type { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { EnumPerformUpdate } from "./enum_perform_update";
import type { UAAuditHistoryUpdateEvent, UAAuditHistoryUpdateEvent_Base } from "./ua_audit_history_update_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditHistoryValueUpdateEventType i=3006                     |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditHistoryValueUpdateEvent_Base extends UAAuditHistoryUpdateEvent_Base {
    updatedNode: UAProperty<NodeId, DataType.NodeId>;
    performInsertReplace: UAProperty<EnumPerformUpdate, DataType.Int32>;
    newValues: UAProperty<DataValue[], DataType.DataValue>;
    oldValues: UAProperty<DataValue[], DataType.DataValue>;
}
export interface UAAuditHistoryValueUpdateEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryValueUpdateEvent_Base {}