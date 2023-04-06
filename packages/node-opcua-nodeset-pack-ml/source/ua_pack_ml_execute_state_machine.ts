// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PackML/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |15:PackMLExecuteStateMachineType ns=15;i=1        |
 * |isAbstract      |false                                             |
 */
export interface UAPackMLExecuteStateMachine_Base extends UAFiniteStateMachine_Base {
    availableStates: UABaseDataVariable<NodeId[], DataType.NodeId>;
    availableTransitions: UABaseDataVariable<NodeId[], DataType.NodeId>;
    /**
     * complete
     * The machine has finished the COMPLETING state and
     * is now waiting for a Reset command before
     * transitioning to the RESETTING state
     */
    complete: UAState;
    completeToResetting: UATransition;
    /**
     * completing
     * Normal operation has run to completion (i.e.,
     * processing of material at the infeed will stop).
     */
    completing: UAState;
    completingToComplete: UATransition;
    /**
     * execute
     * Once the machine is processing materials it is
     * deemed to be executing or in the EXECUTE state.
     */
    execute: UAState;
    executeToCompleting: UATransition;
    executeToHolding: UATransition;
    executeToSuspending: UATransition;
    /**
     * held
     * The HELD state holds the machine's operation
     * while material blockages are cleared, or to stop
     * throughput while a downstream problem is
     * resolved, or enable the safe correction of an
     * equipment fault before the production may be
     * resumed.
     */
    held: UAState;
    heldToUnholding: UATransition;
    hold?: UAMethod;
    /**
     * holding
     * Issuing the Unhold command will retrieve the
     * saved set-points and return the status conditions
     * to prepare the machine to re-enter the normal
     * EXECUTE state
     */
    holding: UAState;
    holdingToHeld: UATransition;
    /**
     * idle
     * This is a state which indicates that RESETTING is
     * complete. This state maintains the machine
     * conditions which were achieved during the
     * RESETTING state, and performs operations required
     * when the machine is in IDLE.
     */
    idle: UAState;
    idleToStarting: UATransition;
    reset?: UAMethod;
    /**
     * resetting
     * will typically cause a machine to sound a horn
     * and place the machine in a state where components
     * are energized awaiting a START command
     */
    resetting: UAState;
    resettingToIdle: UATransition;
    start?: UAMethod;
    /**
     * starting
     * This state provides the steps needed to start the
     * machine and is a result of a starting type
     * command (local or remote). Following this
     * command, the machine will begin to Execute
     */
    starting: UAState;
    startingToExecute: UATransition;
    startingToHolding: UATransition;
    suspend?: UAMethod;
    /**
     * suspended
     * The machine may be running at a relevant set
     * point speed, but there is no product being
     * produced while the machine is waiting for
     * external process conditions to return to normal.
     */
    suspended: UAState;
    suspendedToHolding: UATransition;
    suspendedToUnsuspending: UATransition;
    /**
     * suspending
     * This state is a result of a change in monitored
     * conditions due to process conditions or factors.
     * The trigger event will cause a temporary
     * suspension of the EXECUTE state. SUSPENDING is
     * typically the result of starvation of upstream
     * material in-feeds (i.e., container feed, beverage
     * feed, crown feed, lubricant feed, etc.) that is
     * outside the dynamic speed control range or a
     * downstream out-feed blockage that prevents the
     * machine from EXECUTING continued steady production
     */
    suspending: UAState;
    suspendingToHolding: UATransition;
    suspendingToSuspended: UATransition;
    toComplete?: UAMethod;
    unhold?: UAMethod;
    /**
     * unholding
     * The UNHOLDING state is a response to an operator
     * command to resume the EXECUTE state. Issuing the
     * Unhold command will retrieve the saved set-points
     * and return the status conditions to prepare the
     * machine to re-enter the normal EXECUTE state
     */
    unholding: UAState;
    unholdingToExecute: UATransition;
    unholdingToHolding: UATransition;
    unsuspend?: UAMethod;
    /**
     * unsuspending
     * This state is a result of a machine generated
     * request from SUSPENDED state to go back to the
     * EXECUTE state. The actions of this state may
     * include ramping up speeds, turning on vacuums,
     * and the re-engagement of clutches.
     */
    unsuspending: UAState;
    unsuspendingToExecute: UATransition;
    unsuspendingToHolding: UATransition;
}
export interface UAPackMLExecuteStateMachine extends Omit<UAFiniteStateMachine, "availableStates"|"availableTransitions">, UAPackMLExecuteStateMachine_Base {
}