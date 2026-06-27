import type { UAMethod } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UAStateVariable } from "node-opcua-nodeset-ua/dist/ua_state_variable";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";

// ----- this file has been automatically generated - do not edit

/**
 * The RunningStateMachineType is a sub-state
 * machine of the FunctionalStateMachine and
 * includes detailed substates.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RunningStateMachineType i=1036                              |
 * |isAbstract      |false                                                       |
 */
export interface UARunningStateMachine_Base extends UAFiniteStateMachine_Base {
    /**
     * complete
     * Complete indicates that the process associated
     * with the active protocol has come to its defined
     * end. The unit/device will wait in this state
     * until a Reset command is issued (in which case it
     * will transition to Resetting), or until the
     * unit/device is Stopped or Aborted.
     */
    complete: UAState;
    /**
     * completing
     * Completing: Once the process associated with the
     * current mode has reached a defined threshold
     * (e.g., the required number of samples for the
     * current job have been analysed or the
     * cultivation/fermentation process has reached is
     * final stage in terms of cell count, product
     * yield, cell viability, etc.), the unit/device
     * transitions from Execute to Completing. All steps
     * necessary to shut down the current process are
     * carried out in this state. The unit/device then
     * transitions automatically to the Complete state.
     */
    completing: UAState;
    /**
     * execute
     * In state Execute the unit/device is actively
     * carrying out the behaviour or activity defined by
     * the selected protocol and its associated
     * processing mode. Examples of a unit/device in
     * processing mode include when the unit/device is
     * performing an analytical run,
     * cultivation/fermentation in the case of a
     * bioreactor, or another defined unit of operation
     * provided by the instrument (e.g., separation in
     * the case of a centrifuge).
     */
    execute: UAState;
    /**
     * held
     * In state Held the unit/device is paused, waiting
     * for internal process conditions to clear. In this
     * state, the unit/device shall not continue
     * processing, although it may dry cycle if required
     * (e.g., maintaining process conditions critical
     * for the preservation of the samples or culture).
     * A transition to Unholding will occur once
     * internal unit/device conditions have cleared, or
     * if the Unhold command is initiated by an operator.
     */
    held: UAState;
    hold?: UAMethod;
    /**
     * holding
     * In state Holding the unit/device will transition
     * from Execute to Holding if conditions internal to
     * the unit/device require a pause in processing.
     * Examples of such conditions include low levels of
     * materials required for processing (e.g.,
     * consumables, reagents, buffers, etc.) or other
     * minor issues requiring operator service. After
     * all steps required to hold the unit/device have
     * been completed, the unit/device will transition
     * automatically to the Held state.
     */
    holding: UAState;
    /**
     * idle
     * In state Idle the unit/device is in an error-free
     * state, waiting to start. The unit/device
     * transitions automatically to Idle after all steps
     * necessary for Resetting have been completed. All
     * conditions achieved during Resetting are
     * maintained. A Start command will transition the
     * unit/device from Idle to Starting.
     */
    idle: UAState;
    reset?: UAMethod;
    /**
     * resetting
     * Resetting: In response to a Reset command, the
     * unit/device will transition to Resetting from
     * either Stopped or Complete. In this state the
     * unit/device attempts to clear any standing errors
     * or stop causes. If successful, the unit/device
     * transitions to Idle. No hazardous motion should
     * occur while in this state.
     */
    resetting: UAState;
    /**
     * starting
     * In state Starting the unit/device completes all
     * steps necessary to begin execution of the active
     * protocol. Typical steps during this state include
     * but are not limited to inspecting system setup
     * (checking sufficient supplies of resources and
     * consumables), priming of fluids, homing of
     * handling systems, or equilibration of process
     * conditions. A Start command will cause the
     * unit/device to transition from Idle to Starting.
     * The unit/device will transition automatically
     * from Starting to Execute once all required steps
     * have been completed.
     */
    starting: UAState;
    suspend?: UAMethod;
    /**
     * suspended
     * In state Suspended the unit/device is paused,
     * waiting for external process conditions to clear.
     * In this state, the unit/device shall not continue
     * processing, but may dry cycle if required (e.g.,
     * maintaining process conditions critical for the
     * preservation of the samples or culture, including
     * but not limited to temperature, oxygen or pH
     * levels, etc.). Once external conditions have
     * returned to normal, the unit/device will
     * transition to Unsuspending, with or without
     * operator intervention.
     */
    suspended: UAState;
    /**
     * suspending
     * The unit/device will transition from Execute to
     * Suspending if conditions external to the
     * unit/device require a pause in processing. Such
     * conditions include faults to upstream or
     * downstream equipment. The decision to Suspend may
     * be made by a human operator supervising the
     * process, an automated supervisory system
     * monitoring the conditions of the overall process
     * line/workflow, or by unit/device Sensors
     * detecting downstream blockages or upstream
     * scarcity of samples, etc.
     */
    suspending: UAState;
    toComplete?: UAMethod;
    unhold?: UAMethod;
    /**
     * unholding
     * Unholding: After all internal process conditions
     * that caused the unit/device to hold have cleared,
     * the unit/device completes all steps required to
     * resume execution of the active protocol. Once all
     * required actions to unhold the unit/device have
     * been completed, the unit/device will transition
     * automatically to the Execute state.
     */
    unholding: UAState;
    unsuspend?: UAMethod;
    /**
     * unsuspending
     * Unsuspending: After all external process
     * conditions that caused the unit/device to suspend
     * have cleared, the unit/device completes all steps
     * required to resume execution of the active
     * protocol.
     */
    unsuspending: UAState;
    idleToStarting: UATransition;
    startingToExecute: UATransition;
    executeToCompleting: UATransition;
    completingToComplete: UATransition;
    completeToResetting: UATransition;
    resettingToIdle: UATransition;
    executeToSuspending: UATransition;
    suspendingToSuspended: UATransition;
    suspendedToUnsuspending: UATransition;
    unsuspendingToExecute: UATransition;
    executeToHolding: UATransition;
    holdingToHeld: UATransition;
    heldToUnholding: UATransition;
    unholdingToExecute: UATransition;
    suspendingToHolding: UATransition;
    startingToHolding: UATransition;
    suspendedToHolding: UATransition;
    unsuspendingToHolding: UATransition;
    unholdingToHolding: UATransition;
    currentState: UAStateVariable<LocalizedText>;
}
export interface UARunningStateMachine extends Omit<UAFiniteStateMachine, "currentState">, UARunningStateMachine_Base {}