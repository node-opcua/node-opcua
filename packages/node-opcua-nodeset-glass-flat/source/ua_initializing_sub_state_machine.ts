// ----- this file has been automatically generated - do not edit
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |InitializingSubStateMachineType i=1024                      |
 * |isAbstract      |false                                                       |
 */
export interface UAInitializingSubStateMachine_Base extends UAFiniteStateMachine_Base {
    idle: UAInitialState;
    idleToQueued: UATransition;
    queued: UAState;
    queuedToIdle: UATransition;
    queuedToReleased: UATransition;
    released: UAState;
    releasedToQueued: UATransition;
}
export interface UAInitializingSubStateMachine extends UAFiniteStateMachine, UAInitializingSubStateMachine_Base {
}