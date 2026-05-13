import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UAStateMachine, UAStateMachine_Base } from "./ua_state_machine";
import type { UAStateVariable } from "./ua_state_variable";
import type { UATransitionVariable } from "./ua_transition_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FiniteStateMachineType i=2771                               |
 * |isAbstract      |true                                                        |
 */
export interface UAFiniteStateMachine_Base extends UAStateMachine_Base {
    currentState: UAStateVariable<LocalizedText>;
    lastTransition?: UATransitionVariable<LocalizedText>;
    availableStates?: UABaseDataVariable<NodeId[], DataType.NodeId>;
    availableTransitions?: UABaseDataVariable<NodeId[], DataType.NodeId>;
}
export interface UAFiniteStateMachine extends Omit<UAStateMachine, "currentState"|"lastTransition">, UAFiniteStateMachine_Base {}