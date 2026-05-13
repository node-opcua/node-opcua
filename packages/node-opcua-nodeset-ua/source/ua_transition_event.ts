import type { LocalizedText } from "node-opcua-data-model";

import type { UABaseEvent, UABaseEvent_Base } from "./ua_base_event";
import type { UAStateVariable } from "./ua_state_variable";
import type { UATransitionVariable } from "./ua_transition_variable";

// ----- this file has been automatically generated - do not edit

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
export interface UATransitionEvent extends UABaseEvent, UATransitionEvent_Base {}