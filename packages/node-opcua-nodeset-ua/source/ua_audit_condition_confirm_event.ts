// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAAuditConditionEvent, UAAuditConditionEvent_Base } from "./ua_audit_condition_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditConditionConfirmEventType ns=0;i=8961        |
 * |isAbstract      |false                                             |
 */
export interface UAAuditConditionConfirmEvent_Base extends UAAuditConditionEvent_Base {
    conditionEventId: UAProperty<Buffer, /*z*/DataType.ByteString>;
    comment: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
}
export interface UAAuditConditionConfirmEvent extends UAAuditConditionEvent, UAAuditConditionConfirmEvent_Base {
}