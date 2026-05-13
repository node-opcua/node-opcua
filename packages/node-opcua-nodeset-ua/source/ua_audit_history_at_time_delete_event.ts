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
 * |typedDefinition |AuditHistoryAtTimeDeleteEventType i=3019                    |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditHistoryAtTimeDeleteEvent_Base extends UAAuditHistoryDeleteEvent_Base {
    reqTimes: UAProperty<Date[], DataType.DateTime>;
    oldValues: UAProperty<DataValue[], DataType.DataValue>;
}
export interface UAAuditHistoryAtTimeDeleteEvent extends UAAuditHistoryDeleteEvent, UAAuditHistoryAtTimeDeleteEvent_Base {}