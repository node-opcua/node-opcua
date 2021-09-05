// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { DataValue } from "node-opcua-data-value"
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
    performInsertReplace: UAProperty<any, any>;
    newValues: UAProperty<DataValue[], /*z*/DataType.DataValue>;
    oldValues: UAProperty<DataValue[], /*z*/DataType.DataValue>;
}
export interface UAAuditHistoryAnnotationUpdateEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryAnnotationUpdateEvent_Base {
}