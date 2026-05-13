import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTAnnotation } from "./dt_annotation";
import type { EnumPerformUpdate } from "./enum_perform_update";
import type { UAAuditHistoryUpdateEvent, UAAuditHistoryUpdateEvent_Base } from "./ua_audit_history_update_event";

// ----- this file has been automatically generated - do not edit

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
export interface UAAuditHistoryAnnotationUpdateEvent extends UAAuditHistoryUpdateEvent, UAAuditHistoryAnnotationUpdateEvent_Base {}