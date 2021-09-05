// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAuditConditionEvent, UAAuditConditionEvent_Base } from "./ua_audit_condition_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditConditionShelvingEventType ns=0;i=11093      |
 * |isAbstract      |false                                             |
 */
export interface UAAuditConditionShelvingEvent_Base extends UAAuditConditionEvent_Base {
    shelvingTime?: UAProperty<number, /*z*/DataType.Double>;
}
export interface UAAuditConditionShelvingEvent extends UAAuditConditionEvent, UAAuditConditionShelvingEvent_Base {
}