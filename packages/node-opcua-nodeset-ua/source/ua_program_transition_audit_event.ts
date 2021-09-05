// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UAAuditUpdateStateEvent, UAAuditUpdateStateEvent_Base } from "./ua_audit_update_state_event"
import { UAFiniteTransitionVariable } from "./ua_finite_transition_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ProgramTransitionAuditEventType ns=0;i=3806       |
 * |isAbstract      |false                                             |
 */
export interface UAProgramTransitionAuditEvent_Base extends UAAuditUpdateStateEvent_Base {
    transition: UAFiniteTransitionVariable<LocalizedText>;
}
export interface UAProgramTransitionAuditEvent extends UAAuditUpdateStateEvent, UAProgramTransitionAuditEvent_Base {
}