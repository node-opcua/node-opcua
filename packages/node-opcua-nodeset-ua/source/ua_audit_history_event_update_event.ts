// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { EnumPerformUpdate } from "./enum_perform_update"
import { DTEventFilter } from "./dt_event_filter"
import { DTHistoryEventFieldList } from "./dt_history_event_field_list"
import { UAAuditHistoryUpdateEvent, UAAuditHistoryUpdateEvent_Base } from "./ua_audit_history_update_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditHistoryEventUpdateEventType ns=0;i=2999      |
 * |isAbstract      |true                                              |
 */
export interface UAAuditHistoryEventUpdateEvent_Base extends UAAuditHistoryUpdateEvent_Base {
    updatedNode: UAProperty<NodeId, /*z*/DataType.NodeId>;
    performInsertReplace: UAProperty<EnumPerformUpdate, /*z*/DataType.Int32>;
    filter: UAProperty<DTEventFilter, /*z*/DataType.ExtensionObject>;
    newValues: UAProperty<DTHistoryEventFieldList[], /*z*/DataType.ExtensionObject>;
    oldValues: UAProperty<DTHistoryEventFieldList[], /*z*/DataType.ExtensionObject>;
}
export interface UAAuditHistoryEventUpdateEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryEventUpdateEvent_Base {
}