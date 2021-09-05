// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAAuditConditionEvent, UAAuditConditionEvent_Base } from "./ua_audit_condition_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditConditionRespondEventType ns=0;i=8927        |
 * |isAbstract      |false                                             |
 */
export interface UAAuditConditionRespondEvent_Base extends UAAuditConditionEvent_Base {
    selectedResponse: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAuditConditionRespondEvent extends UAAuditConditionEvent, UAAuditConditionRespondEvent_Base {
}