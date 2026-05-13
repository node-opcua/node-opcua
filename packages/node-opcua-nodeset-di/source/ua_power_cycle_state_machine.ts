import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PowerCycleStateMachineType i=285                            |
 * |isAbstract      |false                                                       |
 */
export interface UAPowerCycleStateMachine_Base extends UAFiniteStateMachine_Base {
    notWaitingForPowerCycle: UAInitialState;
    waitingForPowerCycle: UAState;
    notWaitingForPowerCycleToWaitingForPowerCycle: UATransition;
    waitingForPowerCycleToNotWaitingForPowerCycle: UATransition;
}
export interface UAPowerCycleStateMachine extends UAFiniteStateMachine, UAPowerCycleStateMachine_Base {}