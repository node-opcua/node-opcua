// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DataValue } from "node-opcua-data-value"
import { UAAuditHistoryDeleteEvent, UAAuditHistoryDeleteEvent_Base } from "./ua_audit_history_delete_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditHistoryRawModifyDeleteEventType ns=0;i=3014  |
 * |isAbstract      |true                                              |
 */
export interface UAAuditHistoryRawModifyDeleteEvent_Base extends UAAuditHistoryDeleteEvent_Base {
    isDeleteModified: UAProperty<boolean, /*z*/DataType.Boolean>;
    startTime: UAProperty<Date, /*z*/DataType.DateTime>;
    endTime: UAProperty<Date, /*z*/DataType.DateTime>;
    oldValues: UAProperty<DataValue[], /*z*/DataType.DataValue>;
}
export interface UAAuditHistoryRawModifyDeleteEvent extends UAAuditHistoryDeleteEvent, UAAuditHistoryRawModifyDeleteEvent_Base {
}