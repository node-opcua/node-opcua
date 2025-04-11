// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAPackMLMachineStateMachine } from "./ua_pack_ml_machine_state_machine"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PackML/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PackMLBaseStateMachineType i=3                              |
 * |isAbstract      |false                                                       |
 */
export interface UAPackMLBaseStateMachine_Base extends UAFiniteStateMachine_Base {
    abort?: UAMethod;
    aborted: UAState;
    abortedToCleared: UATransition;
    aborting: UAState;
    abortingToAborted: UATransition;
    availableStates: UABaseDataVariable<NodeId[], DataType.NodeId>;
    availableTransitions: UABaseDataVariable<NodeId[], DataType.NodeId>;
    clear?: UAMethod;
    cleared?: UAState;
    clearedToAborting: UATransition;
    machineState: UAPackMLMachineStateMachine;
}
export interface UAPackMLBaseStateMachine extends Omit<UAFiniteStateMachine, "availableStates"|"availableTransitions">, UAPackMLBaseStateMachine_Base {
}