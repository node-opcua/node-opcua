// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
/**
 * State machine representing the state of a
 * machinery item
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/            |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |8:MachineryItemState_StateMachineType ns=8;i=1002 |
 * |isAbstract      |false                                             |
 */
export interface UAMachineryItemState_StateMachine_Base extends UAFiniteStateMachine_Base {
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    /**
     * executing
     * The machine is available & functional and is
     * actively performing an activity (pursues a
     * purpose)
     */
    executing: UAState;
    /**
     * fromExecutingToExecuting
     * Transition from state Executing to state Executing
     */
    fromExecutingToExecuting: UATransition;
    /**
     * fromExecutingToNotAvailable
     * Transition from state Executing to state
     * NotAvailable
     */
    fromExecutingToNotAvailable: UATransition;
    /**
     * fromExecutingToNotExecuting
     * Transition from state Executing to state
     * NotExecuting
     */
    fromExecutingToNotExecuting: UATransition;
    /**
     * fromExecutingToOutOfService
     * Transition from state Executing to state
     * OutOfService
     */
    fromExecutingToOutOfService: UATransition;
    /**
     * fromNotAvailableToExecuting
     * Transition from state NotAvailable to state
     * Executing
     */
    fromNotAvailableToExecuting: UATransition;
    /**
     * fromNotAvailableToNotAvailable
     * Transition from state NotAvailable to state
     * NotAvailable
     */
    fromNotAvailableToNotAvailable: UATransition;
    /**
     * fromNotAvailableToNotExecuting
     * Transition from state NotAvailable to state
     * NotExecuting
     */
    fromNotAvailableToNotExecuting: UATransition;
    /**
     * fromNotAvailableToOutOfService
     * Transition from state NotAvailable to state
     * OutOfService
     */
    fromNotAvailableToOutOfService: UATransition;
    /**
     * fromNotExecutingToExecuting
     * Transition from state NotExecuting to state
     * Executing
     */
    fromNotExecutingToExecuting: UATransition;
    /**
     * fromNotExecutingToNotAvailable
     * Transition from state NotExecuting to state
     * NotAvailable
     */
    fromNotExecutingToNotAvailable: UATransition;
    /**
     * fromNotExecutingToNotExecuting
     * Transition from state NotExecuting to state
     * NotExecuting
     */
    fromNotExecutingToNotExecuting: UATransition;
    /**
     * fromNotExecutingToOutOfService
     * Transition from state NotExecuting to state
     * OutOfService
     */
    fromNotExecutingToOutOfService: UATransition;
    /**
     * fromOutOfServiceToExecuting
     * Transition from state OutOfService to state
     * Executing
     */
    fromOutOfServiceToExecuting: UATransition;
    /**
     * fromOutOfServiceToNotAvailable
     * Transition from state OutOfService to state
     * NotAvailable
     */
    fromOutOfServiceToNotAvailable: UATransition;
    /**
     * fromOutOfServiceToNotExecuting
     * Transition from state OutOfService to state
     * NotExecuting
     */
    fromOutOfServiceToNotExecuting: UATransition;
    /**
     * fromOutOfServiceToOutOfService
     * Transition from state OutOfService to state
     * OutOfService
     */
    fromOutOfServiceToOutOfService: UATransition;
    /**
     * notAvailable
     * The machine is not available and does not perform
     * any activity (e.g., switched off, in energy
     * saving mode)
     */
    notAvailable: UAState;
    /**
     * notExecuting
     * The machine is available & functional and does
     * not perform any activity. It waits for an action
     * from outside to start or restart an activity
     */
    notExecuting: UAState;
    /**
     * outOfService
     * The machine is not functional and does not
     * perform any activity (e.g., error, blocked)
     */
    outOfService: UAState;
}
export interface UAMachineryItemState_StateMachine extends UAFiniteStateMachine, UAMachineryItemState_StateMachine_Base {
}