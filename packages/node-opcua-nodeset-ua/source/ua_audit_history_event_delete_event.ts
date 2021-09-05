// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTHistoryEventFieldList } from "./dt_history_event_field_list"
import { UAAuditHistoryDeleteEvent, UAAuditHistoryDeleteEvent_Base } from "./ua_audit_history_delete_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditHistoryEventDeleteEventType ns=0;i=3022      |
 * |isAbstract      |true                                              |
 */
export interface UAAuditHistoryEventDeleteEvent_Base extends UAAuditHistoryDeleteEvent_Base {
    eventIds: UAProperty<Buffer[], /*z*/DataType.ByteString>;
    oldValues: UAProperty<DTHistoryEventFieldList, /*z*/DataType.ExtensionObject>;
}
export interface UAAuditHistoryEventDeleteEvent extends UAAuditHistoryDeleteEvent, UAAuditHistoryEventDeleteEvent_Base {
}