// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UABaseEvent, UABaseEvent_Base } from "./ua_base_event"
import { UATransitionVariable } from "./ua_transition_variable"
import { UAStateVariable } from "./ua_state_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TransitionEventType i=2311                                  |
 * |isAbstract      |true                                                        |
 */
export interface UATransitionEvent_Base extends UABaseEvent_Base {
    transition: UATransitionVariable<LocalizedText>;
    fromState: UAStateVariable<LocalizedText>;
    toState: UAStateVariable<LocalizedText>;
}
export interface UATransitionEvent extends UABaseEvent, UATransitionEvent_Base {
}