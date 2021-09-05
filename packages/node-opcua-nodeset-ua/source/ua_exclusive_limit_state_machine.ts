// ----- this file has been automatically generated - do not edit
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "./ua_finite_state_machine"
import { UAState } from "./ua_state"
import { UATransition } from "./ua_transition"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ExclusiveLimitStateMachineType ns=0;i=9318        |
 * |isAbstract      |false                                             |
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
export interface UAExclusiveLimitStateMachine extends UAFiniteStateMachine, UAExclusiveLimitStateMachine_Base {
}