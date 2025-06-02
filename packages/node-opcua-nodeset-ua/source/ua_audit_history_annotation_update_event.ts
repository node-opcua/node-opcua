// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EnumPerformUpdate } from "./enum_perform_update"
import { DTAnnotation } from "./dt_annotation"
import { UAAuditHistoryUpdateEvent, UAAuditHistoryUpdateEvent_Base } from "./ua_audit_history_update_event"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditHistoryAnnotationUpdateEventType i=19095               |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditHistoryAnnotationUpdateEvent_Base extends UAAuditHistoryUpdateEvent_Base {
    performInsertReplace: UAProperty<EnumPerformUpdate, DataType.Int32>;
    newValues: UAProperty<DTAnnotation[], DataType.ExtensionObject>;
    oldValues: UAProperty<DTAnnotation[], DataType.ExtensionObject>;
}
export interface UAAuditHistoryAnnotationUpdateEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryAnnotationUpdateEvent_Base {
}