import type { UAMethod } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { NodeId } from "node-opcua-nodeid";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UAStateVariable } from "node-opcua-nodeset-ua/dist/ua_state_variable";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";
import type { DataType } from "node-opcua-variant";

import type { UARunningStateMachine } from "./ua_running_state_machine";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FunctionalStateMachineType i=1038                           |
 * |isAbstract      |true                                                        |
 */
export interface UAFunctionalStateMachine_Base extends UAFiniteStateMachine_Base {
    abort?: UAMethod;
    /**
     * aborted
     * Aborted maintains unit/device status information
     * relevant to the Abort condition. The unit/device
     * can only exit the Aborted state after an explicit
     * Clear command subsequent to intervention to
     * correct and reset the detected unit/device faults.
     */
    aborted: UAState;
    abortedToClearing: UATransition;
    /**
     * aborting
     * The Aborting state can be entered at any time in
     * response to the Abort command or in the event of
     * a unit/device fault. The aborting logic will
     * bring the unit/device to a rapid safe stop.
     */
    aborting: UAState;
    abortingToAborted: UATransition;
    /**
     * availableStates
     * Set of states supported by the implementation.
     */
    availableStates: UABaseDataVariable<NodeId[], DataType.NodeId>;
    /**
     * availableTransitions
     * Set of transitions supported by the
     * implementation.
     */
    availableTransitions: UABaseDataVariable<NodeId[], DataType.NodeId>;
    clear?: UAMethod;
    /**
     * clearing
     * Clearing is initiated by a state command to clear
     * faults that may have occurred when Aborting that
     * are present in the Aborted state.
     */
    clearing: UAState;
    /**
     * stopped
     * Stopped is the initial state for an
     * ActiveProgram, FunctionalUnit or Function. It is
     * an Idle state which means that the Function,
     * FunctionalUnit or ActiveProgram is stopped and
     * ready for activation.
     */
    stopped: UAInitialState;
    /**
     * running
     * Running is the state when the Function or
     * FunctionalUnit is currently running/executing.
     */
    running: UAState;
    /**
     * stopping
     * Stopping indicates that the ActiveProgram,
     * FunctionalUnit, or Function is in the process of
     * stopping. This state usually occurs when the
     * program execution is finished or stopped, either
     * because it has ended or has been triggered by the
     * Stop Method.
     */
    stopping: UAState;
    stoppingToStopped: UATransition;
    stoppedToRunning: UATransition;
    runningToAborting: UATransition;
    clearingToStopped: UATransition;
    runningToStopping: UATransition;
    stop?: UAMethod;
    /**
     * runningStateMachine
     * The RunningStateMachineType is a sub-state
     * machine of the FunctionalStateMachine and
     * includes detailed substates.
     */
    runningStateMachine?: UARunningStateMachine;
    currentState: UAStateVariable<LocalizedText>;
}
export interface UAFunctionalStateMachine extends Omit<UAFiniteStateMachine, "availableStates"|"availableTransitions"|"currentState">, UAFunctionalStateMachine_Base {}