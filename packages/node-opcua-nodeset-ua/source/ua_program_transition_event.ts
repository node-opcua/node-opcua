import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UATransitionEvent, UATransitionEvent_Base } from "./ua_transition_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProgramTransitionEventType i=2378                           |
 * |isAbstract      |true                                                        |
 */
export interface UAProgramTransitionEvent_Base extends UATransitionEvent_Base {
    intermediateResult: UABaseDataVariable<any, any>;
}
export interface UAProgramTransitionEvent extends UATransitionEvent, UAProgramTransitionEvent_Base {}