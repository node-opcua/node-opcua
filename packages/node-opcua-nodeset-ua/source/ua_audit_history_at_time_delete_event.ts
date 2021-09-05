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
 * |typedDefinition |AuditHistoryAtTimeDeleteEventType ns=0;i=3019     |
 * |isAbstract      |true                                              |
 */
export interface UAAuditHistoryAtTimeDeleteEvent_Base extends UAAuditHistoryDeleteEvent_Base {
    reqTimes: UAProperty<Date[], /*z*/DataType.DateTime>;
    oldValues: UAProperty<DataValue[], /*z*/DataType.DataValue>;
}
export interface UAAuditHistoryAtTimeDeleteEvent extends UAAuditHistoryDeleteEvent, UAAuditHistoryAtTimeDeleteEvent_Base {
}