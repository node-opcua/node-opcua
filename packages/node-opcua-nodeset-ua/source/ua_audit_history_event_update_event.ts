import type { UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTEventFilter } from "./dt_event_filter";
import type { DTHistoryEventFieldList } from "./dt_history_event_field_list";
import type { EnumPerformUpdate } from "./enum_perform_update";
import type { UAAuditHistoryUpdateEvent, UAAuditHistoryUpdateEvent_Base } from "./ua_audit_history_update_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditHistoryEventUpdateEventType i=2999                     |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditHistoryEventUpdateEvent_Base extends UAAuditHistoryUpdateEvent_Base {
    updatedNode: UAProperty<NodeId, DataType.NodeId>;
    performInsertReplace: UAProperty<EnumPerformUpdate, DataType.Int32>;
    filter: UAProperty<DTEventFilter, DataType.ExtensionObject>;
    newValues: UAProperty<DTHistoryEventFieldList[], DataType.ExtensionObject>;
    oldValues: UAProperty<DTHistoryEventFieldList[], DataType.ExtensionObject>;
}
export interface UAAuditHistoryEventUpdateEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryEventUpdateEvent_Base {}