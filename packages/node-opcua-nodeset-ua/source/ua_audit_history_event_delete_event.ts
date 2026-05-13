import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTHistoryEventFieldList } from "./dt_history_event_field_list";
import type { UAAuditHistoryDeleteEvent, UAAuditHistoryDeleteEvent_Base } from "./ua_audit_history_delete_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditHistoryEventDeleteEventType i=3022                     |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditHistoryEventDeleteEvent_Base extends UAAuditHistoryDeleteEvent_Base {
    eventIds: UAProperty<Buffer[], DataType.ByteString>;
    oldValues: UAProperty<DTHistoryEventFieldList, DataType.ExtensionObject>;
}
export interface UAAuditHistoryEventDeleteEvent extends UAAuditHistoryDeleteEvent, UAAuditHistoryEventDeleteEvent_Base {}