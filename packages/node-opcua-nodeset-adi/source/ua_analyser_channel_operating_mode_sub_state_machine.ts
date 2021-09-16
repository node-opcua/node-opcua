// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UAInitialState } from "node-opcua-nodeset-ua/source/ua_initial_state"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UAAnalyserChannel_OperatingModeExecuteSubStateMachine } from "./ua_analyser_channel_operating_mode_execute_sub_state_machine"
import { UAAnalyserChannelOperatingExecuteState } from "./ua_analyser_channel_operating_execute_state"
export interface UAAnalyserChannel_OperatingModeSubStateMachine_stoppedToResettingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_resettingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_resettingToIdleTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_idleToStartingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_startingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_startingToExecuteTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_executeToCompletingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_completingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_completingToCompleteTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_completeToStoppedTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_executeToHoldingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_holdingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_holdingToHeldTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_heldToUnholdingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unholdingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unholdingToHoldingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unholdingToExecuteTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_executeToSuspendingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_suspendingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_suspendingToSuspendedTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_suspendedToUnsuspendingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingToSuspendingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingToExecuteTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_stoppingToStoppedTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_abortingToAbortedTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_abortedToClearingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_clearingToStoppedTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_resettingToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_idleToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_startingToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_executeToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_completingToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_completeToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_suspendingToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_suspendedToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_holdingToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_heldToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unholdingToStoppingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_stoppedToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_resettingToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_idleToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_startingToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_executeToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_completingToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_completeToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_suspendingToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_suspendedToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_holdingToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_heldToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_unholdingToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine_stoppingToAbortingTransition extends Omit<UATransition, "transitionNumber"> { // Object
      transitionNumber: UAProperty<UInt32, /*z*/DataType.UInt32>;
}
/**
 * AnalyserChannel OperatingMode SubStateMachine
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:AnalyserChannel_OperatingModeSubStateMachineType ns=2;i=1008|
 * |isAbstract      |false                                             |
 */
export interface UAAnalyserChannel_OperatingModeSubStateMachine_Base extends UAFiniteStateMachine_Base {
    operatingExecuteSubStateMachine: UAAnalyserChannel_OperatingModeExecuteSubStateMachine;
    /**
     * stopped
     * This is the initial state after
     * AnalyserDeviceStateMachine state Powerup
     */
    stopped: UAInitialState;
    /**
     * resetting
     * This state is the result of a Reset or
     * SetConfiguration Method call from the Stopped
     * state.
     */
    resetting: UAState;
    /**
     * idle
     * The Resetting state is completed, all parameters
     * have been committed and ready to start acquisition
     */
    idle: UAState;
    /**
     * starting
     * The analyser has received the Start or
     * SingleAcquisitionStart Method call and it is
     * preparing to enter in Execute state.
     */
    starting: UAState;
    /**
     * execute
     * All repetitive acquisition cycles are done in
     * this state:
     */
    execute: UAAnalyserChannelOperatingExecuteState;
    /**
     * completing
     * This state is an automatic or commanded exit from
     * the Execute state.
     */
    completing: UAState;
    /**
     * complete
     * At this point, the Completing state is done and
     * it transitions automatically to Stopped state to
     * wait.
     */
    complete: UAState;
    /**
     * suspending
     * This state is a result of a change in monitored
     * conditions due to process conditions or factors.
     */
    suspending: UAState;
    /**
     * suspended
     * The analyser or channel may be running but no
     * results are being generated while the analyser or
     * channel is waiting for external process
     * conditions to return to normal.
     */
    suspended: UAState;
    /**
     * unsuspending
     * This state is a result of a device request from
     * Suspended state to transition back to the Execute
     * state by calling the Unsuspend Method.
     */
    unsuspending: UAState;
    /**
     * holding
     * Brings the analyser or channel to a controlled
     * stop or to a state which represents Held for the
     * particular unit control mode
     */
    holding: UAState;
    /**
     * held
     * The Held state holds the analyser or channel's
     * operation. At this state, no acquisition cycle is
     * performed.
     */
    held: UAState;
    /**
     * unholding
     * The Unholding state is a response to an operator
     * command to resume the Execute state.
     */
    unholding: UAState;
    /**
     * stopping
     * Initiated by a Stop Method call, this state:
     */
    stopping: UAState;
    /**
     * aborting
     * The Aborting state can be entered at any time in
     * response to the Abort command or on the
     * occurrence of a machine fault.
     */
    aborting: UAState;
    /**
     * aborted
     * This state maintains machine status information
     * relevant to the Abort condition.
     */
    aborted: UAState;
    /**
     * clearing
     * Clears faults that may have occurred when
     * Aborting and are present in the Aborted state
     * before proceeding to a Stopped state
     */
    clearing: UAState;
    stoppedToResettingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_stoppedToResettingTransition;
    resettingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_resettingTransition;
    resettingToIdleTransition: UAAnalyserChannel_OperatingModeSubStateMachine_resettingToIdleTransition;
    idleToStartingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_idleToStartingTransition;
    startingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_startingTransition;
    startingToExecuteTransition: UAAnalyserChannel_OperatingModeSubStateMachine_startingToExecuteTransition;
    executeToCompletingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_executeToCompletingTransition;
    completingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_completingTransition;
    completingToCompleteTransition: UAAnalyserChannel_OperatingModeSubStateMachine_completingToCompleteTransition;
    completeToStoppedTransition: UAAnalyserChannel_OperatingModeSubStateMachine_completeToStoppedTransition;
    executeToHoldingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_executeToHoldingTransition;
    holdingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_holdingTransition;
    holdingToHeldTransition: UAAnalyserChannel_OperatingModeSubStateMachine_holdingToHeldTransition;
    heldToUnholdingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_heldToUnholdingTransition;
    unholdingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unholdingTransition;
    unholdingToHoldingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unholdingToHoldingTransition;
    unholdingToExecuteTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unholdingToExecuteTransition;
    executeToSuspendingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_executeToSuspendingTransition;
    suspendingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_suspendingTransition;
    suspendingToSuspendedTransition: UAAnalyserChannel_OperatingModeSubStateMachine_suspendingToSuspendedTransition;
    suspendedToUnsuspendingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_suspendedToUnsuspendingTransition;
    unsuspendingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingTransition;
    unsuspendingToSuspendingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingToSuspendingTransition;
    unsuspendingToExecuteTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingToExecuteTransition;
    stoppingToStoppedTransition: UAAnalyserChannel_OperatingModeSubStateMachine_stoppingToStoppedTransition;
    abortingToAbortedTransition: UAAnalyserChannel_OperatingModeSubStateMachine_abortingToAbortedTransition;
    abortedToClearingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_abortedToClearingTransition;
    clearingToStoppedTransition: UAAnalyserChannel_OperatingModeSubStateMachine_clearingToStoppedTransition;
    resettingToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_resettingToStoppingTransition;
    idleToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_idleToStoppingTransition;
    startingToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_startingToStoppingTransition;
    executeToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_executeToStoppingTransition;
    completingToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_completingToStoppingTransition;
    completeToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_completeToStoppingTransition;
    suspendingToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_suspendingToStoppingTransition;
    suspendedToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_suspendedToStoppingTransition;
    unsuspendingToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingToStoppingTransition;
    holdingToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_holdingToStoppingTransition;
    heldToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_heldToStoppingTransition;
    unholdingToStoppingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unholdingToStoppingTransition;
    stoppedToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_stoppedToAbortingTransition;
    resettingToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_resettingToAbortingTransition;
    idleToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_idleToAbortingTransition;
    startingToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_startingToAbortingTransition;
    executeToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_executeToAbortingTransition;
    completingToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_completingToAbortingTransition;
    completeToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_completeToAbortingTransition;
    suspendingToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_suspendingToAbortingTransition;
    suspendedToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_suspendedToAbortingTransition;
    unsuspendingToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unsuspendingToAbortingTransition;
    holdingToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_holdingToAbortingTransition;
    heldToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_heldToAbortingTransition;
    unholdingToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_unholdingToAbortingTransition;
    stoppingToAbortingTransition: UAAnalyserChannel_OperatingModeSubStateMachine_stoppingToAbortingTransition;
}
export interface UAAnalyserChannel_OperatingModeSubStateMachine extends UAFiniteStateMachine, UAAnalyserChannel_OperatingModeSubStateMachine_Base {
}