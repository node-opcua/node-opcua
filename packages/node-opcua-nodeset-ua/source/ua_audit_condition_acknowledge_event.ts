import type { UAProperty } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UAAuditConditionEvent, UAAuditConditionEvent_Base } from "./ua_audit_condition_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditConditionAcknowledgeEventType i=8944                   |
 * |isAbstract      |false                                                       |
 */
export interface UAAuditConditionAcknowledgeEvent_Base extends UAAuditConditionEvent_Base {
    conditionEventId: UAProperty<Buffer, DataType.ByteString>;
    comment: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAAuditConditionAcknowledgeEvent extends UAAuditConditionEvent, UAAuditConditionAcknowledgeEvent_Base {}