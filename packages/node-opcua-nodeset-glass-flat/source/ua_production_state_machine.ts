import type { LocalizedText } from "node-opcua-data-model";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UAStateVariable } from "node-opcua-nodeset-ua/dist/ua_state_variable";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";

import type { UAInitializingSubStateMachine } from "./ua_initializing_sub_state_machine";

// ----- this file has been automatically generated - do not edit

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
    currentState: UAStateVariable<LocalizedText>;
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
export interface UAProductionStateMachine extends Omit<UAFiniteStateMachine, "currentState">, UAProductionStateMachine_Base {}