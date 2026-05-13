import type { UAProperty } from "node-opcua-address-space-base";
import type { DataValue } from "node-opcua-data-value";
import type { DataType } from "node-opcua-variant";

import type { UAAuditHistoryDeleteEvent, UAAuditHistoryDeleteEvent_Base } from "./ua_audit_history_delete_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditHistoryRawModifyDeleteEventType i=3014                 |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditHistoryRawModifyDeleteEvent_Base extends UAAuditHistoryDeleteEvent_Base {
    isDeleteModified: UAProperty<boolean, DataType.Boolean>;
    startTime: UAProperty<Date, DataType.DateTime>;
    endTime: UAProperty<Date, DataType.DateTime>;
    oldValues: UAProperty<DataValue[], DataType.DataValue>;
}
export interface UAAuditHistoryRawModifyDeleteEvent extends UAAuditHistoryDeleteEvent, UAAuditHistoryRawModifyDeleteEvent_Base {}