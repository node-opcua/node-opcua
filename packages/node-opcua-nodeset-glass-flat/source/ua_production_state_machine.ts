// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UAFiniteStateVariable } from "node-opcua-nodeset-ua/dist/ua_finite_state_variable"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
import { UAInitializingSubStateMachine } from "./ua_initializing_sub_state_machine"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionStateMachineType i=1005                           |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionStateMachine_Base extends UAFiniteStateMachine_Base {
    aborted: UAState;
    abortedToInitializing: UATransition;
    currentState: UAFiniteStateVariable<LocalizedText>;
    ended: UAState;
    endedToInitializing: UATransition;
    initializing: UAInitialState;
    initializingState: UAInitializingSubStateMachine;
    initializingToAborted: UATransition;
    initializingToRunning: UATransition;
    interrupted: UAState;
    interruptedToAborted: UATransition;
    interruptedToRunning: UATransition;
    running: UAState;
    runningToAborted: UATransition;
    runningToEnded: UATransition;
    runningToInterrupted: UATransition;
    runningToRunning: UATransition;
}
export interface UAProductionStateMachine extends Omit<UAFiniteStateMachine, "currentState">, UAProductionStateMachine_Base {
}