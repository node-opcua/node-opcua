import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { UAAuditConditionEvent, UAAuditConditionEvent_Base } from "./ua_audit_condition_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditConditionShelvingEventType i=11093                     |
 * |isAbstract      |false                                                       |
 */
export interface UAAuditConditionShelvingEvent_Base extends UAAuditConditionEvent_Base {
    shelvingTime?: UAProperty<number, DataType.Double>;
}
export interface UAAuditConditionShelvingEvent extends UAAuditConditionEvent, UAAuditConditionShelvingEvent_Base {}