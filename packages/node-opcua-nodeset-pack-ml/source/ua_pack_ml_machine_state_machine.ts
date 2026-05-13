import type { UAMethod } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";
import type { DataType } from "node-opcua-variant";

import type { UAPackMLExecuteStateMachine } from "./ua_pack_ml_execute_state_machine";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PackML/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PackMLMachineStateMachineType i=2                           |
 * |isAbstract      |false                                                       |
 */
export interface UAPackMLMachineStateMachine_Base extends UAFiniteStateMachine_Base {
    availableStates: UABaseDataVariable<NodeId[], DataType.NodeId>;
    availableTransitions: UABaseDataVariable<NodeId[], DataType.NodeId>;
    /**
     * clearing
     * Initiated by a state command to clear faults that
     * may have occurred when ABORTING, and are present
     * in the ABORTED state.
     */
    clearing: UAState;
    clearingToStopped: UATransition;
    /**
     * executeState
     * StateMachine that provides additional sube
     */
    executeState: UAPackMLExecuteStateMachine;
    reset?: UAMethod;
    running: UAState;
    runningToStopping: UATransition;
    stop?: UAMethod;
    /**
     * stopped
     * The machine is powered and stationary after
     * completing the STOPPING state. All communications
     * with other systems are functioning (if
     * applicable).
     */
    stopped: UAState;
    stoppedToRunning: UATransition;
    /**
     * stopping
     * This state executes the logic which brings the
     * machine to a controlled stop as reflected by the
     * STOPPED state.
     */
    stopping: UAState;
    stoppingToStopped: UATransition;
}
export interface UAPackMLMachineStateMachine extends Omit<UAFiniteStateMachine, "availableStates"|"availableTransitions">, UAPackMLMachineStateMachine_Base {}