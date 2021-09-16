// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { UAStateVariable } from "node-opcua-nodeset-ua/source/ua_state_variable"
import { UATransitionVariable } from "node-opcua-nodeset-ua/source/ua_transition_variable"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAInitialState } from "node-opcua-nodeset-ua/source/ua_initial_state"
export interface UAProductionStateMachine_currentState<T extends LocalizedText/*j*/> extends Omit<UAStateVariable<T>, "id"|"number"> { // Variable
      id: UAProperty<NodeId, /*z*/DataType.NodeId>;
      number: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAProductionStateMachine_lastTransition<T extends LocalizedText/*j*/> extends Omit<UATransitionVariable<T>, "id"|"number"> { // Variable
      id: UAProperty<NodeId, /*z*/DataType.NodeId>;
      number: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionStateMachineType ns=10;i=24          |
 * |isAbstract      |false                                             |
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
export interface UAProductionStateMachine extends Omit<UAFiniteStateMachine, "currentState"|"lastTransition">, UAProductionStateMachine_Base {
}