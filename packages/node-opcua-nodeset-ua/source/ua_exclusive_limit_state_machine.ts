import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "./ua_finite_state_machine";
import type { UAState } from "./ua_state";
import type { UATransition } from "./ua_transition";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ExclusiveLimitStateMachineType i=9318                       |
 * |isAbstract      |false                                                       |
 */
export interface UAExclusiveLimitStateMachine_Base extends UAFiniteStateMachine_Base {
    highHigh: UAState;
    high: UAState;
    low: UAState;
    lowLow: UAState;
    lowLowToLow: UATransition;
    lowToLowLow: UATransition;
    highHighToHigh: UATransition;
    highToHighHigh: UATransition;
}
export interface UAExclusiveLimitStateMachine extends UAFiniteStateMachine, UAExclusiveLimitStateMachine_Base {}