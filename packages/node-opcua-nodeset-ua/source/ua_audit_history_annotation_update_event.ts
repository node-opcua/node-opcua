// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DataValue } from "node-opcua-data-value"
import { EnumPerformUpdate } from "./enum_perform_update"
import { UAAuditHistoryUpdateEvent, UAAuditHistoryUpdateEvent_Base } from "./ua_audit_history_update_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditHistoryAnnotationUpdateEventType ns=0;i=19095|
 * |isAbstract      |true                                              |
 */
export interface UAAuditHistoryAnnotationUpdateEvent_Base extends UAAuditHistoryUpdateEvent_Base {
    performInsertReplace: UAProperty<EnumPerformUpdate, /*z*/DataType.Int32>;
    newValues: UAProperty<DataValue[], /*z*/DataType.DataValue>;
    oldValues: UAProperty<DataValue[], /*z*/DataType.DataValue>;
}
export interface UAAuditHistoryAnnotationUpdateEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryAnnotationUpdateEvent_Base {
}