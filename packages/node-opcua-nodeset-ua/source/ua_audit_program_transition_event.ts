import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAuditUpdateStateEvent, UAAuditUpdateStateEvent_Base } from "./ua_audit_update_state_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditProgramTransitionEventType i=11856                     |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditProgramTransitionEvent_Base extends UAAuditUpdateStateEvent_Base {
    transitionNumber: UAProperty<UInt32, DataType.UInt32>;
}
export interface UAAuditProgramTransitionEvent extends UAAuditUpdateStateEvent, UAAuditProgramTransitionEvent_Base {}