// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { DataValue } from "node-opcua-data-value"
import { EnumPerformUpdate } from "./enum_perform_update"
import { UAAuditHistoryUpdateEvent, UAAuditHistoryUpdateEvent_Base } from "./ua_audit_history_update_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditHistoryValueUpdateEventType ns=0;i=3006      |
 * |isAbstract      |true                                              |
 */
export interface UAAuditHistoryValueUpdateEvent_Base extends UAAuditHistoryUpdateEvent_Base {
    updatedNode: UAProperty<NodeId, /*z*/DataType.NodeId>;
    performInsertReplace: UAProperty<EnumPerformUpdate, /*z*/DataType.Int32>;
    newValues: UAProperty<DataValue[], /*z*/DataType.DataValue>;
    oldValues: UAProperty<DataValue[], /*z*/DataType.DataValue>;
}
export interface UAAuditHistoryValueUpdateEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryValueUpdateEvent_Base {
}