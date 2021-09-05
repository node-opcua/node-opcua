// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAAuditUpdateStateEvent, UAAuditUpdateStateEvent_Base } from "./ua_audit_update_state_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditProgramTransitionEventType ns=0;i=11856      |
 * |isAbstract      |true                                              |
 */
export interface UAAuditProgramTransitionEvent_Base extends UAAuditUpdateStateEvent_Base {
    transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAuditProgramTransitionEvent extends UAAuditUpdateStateEvent, UAAuditProgramTransitionEvent_Base {
}