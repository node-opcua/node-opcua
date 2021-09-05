// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UAStateMachine, UAStateMachine_Base } from "./ua_state_machine"
import { UAStateVariable } from "./ua_state_variable"
import { UATransitionVariable } from "./ua_transition_variable"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |FiniteStateMachineType ns=0;i=2771                |
 * |isAbstract      |true                                              |
 */
export interface UAFiniteStateMachine_Base extends UAStateMachine_Base {
    currentState: UAStateVariable<LocalizedText>;
    lastTransition?: UATransitionVariable<LocalizedText>;
    availableStates?: UABaseDataVariable<NodeId[], /*z*/DataType.NodeId>;
    availableTransitions?: UABaseDataVariable<NodeId[], /*z*/DataType.NodeId>;
}
export interface UAFiniteStateMachine extends Omit<UAStateMachine, "currentState"|"lastTransition">, UAFiniteStateMachine_Base {
}