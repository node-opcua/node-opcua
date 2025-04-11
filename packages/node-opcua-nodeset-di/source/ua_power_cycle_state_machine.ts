// ----- this file has been automatically generated - do not edit
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
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
export interface UAPowerCycleStateMachine extends UAFiniteStateMachine, UAPowerCycleStateMachine_Base {
}