import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UAStateVariable } from "node-opcua-nodeset-ua/dist/ua_state_variable";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";
import type { UATransitionVariable } from "node-opcua-nodeset-ua/dist/ua_transition_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

export interface UAProductionStateMachine_currentState<T extends LocalizedText> extends Omit<UAStateVariable<T>, "id"|"number"> { // Variable
      id: UAProperty<NodeId, DataType.NodeId>;
      number: UAProperty<UInt32, DataType.UInt32>;
}
export interface UAProductionStateMachine_lastTransition<T extends LocalizedText> extends Omit<UATransitionVariable<T>, "id"|"number"> { // Variable
      id: UAProperty<NodeId, DataType.NodeId>;
      number: UAProperty<UInt32, DataType.UInt32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionStateMachineType i=24                             |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionStateMachine_Base extends UAFiniteStateMachine_Base {
    aborted: UAState;
    abortedToInitializing: UATransition;
    currentState: UAProductionStateMachine_currentState<LocalizedText>;
    ended: UAState;
    endedToInitializing: UATransition;
    initializing: UAInitialState;
    initializingToAborted: UATransition;
    initializingToRunning: UATransition;
    interrupted: UAState;
    interruptedToAborted: UATransition;
    interruptedToRunning: UATransition;
    lastTransition?: UAProductionStateMachine_lastTransition<LocalizedText>;
    running: UAState;
    runningToAborted: UATransition;
    runningToEnded: UATransition;
    runningToInterrupted: UATransition;
    runningToRunning: UATransition;
}
export interface UAProductionStateMachine extends Omit<UAFiniteStateMachine, "currentState"|"lastTransition">, UAProductionStateMachine_Base {}