/**
 * @module node-opcua-address-space
 */
import { LocalizedText } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";

import { InstantiateObjectOptions, UAVariableT } from "../address_space_ts";
import {
    State,
    StateMachine,
    StateMachineB,
    StateMachineType,
    StateVariableB,
    TransitionVariableB
} from "./state_machine";

/**
 * Finite State Machine
 *
 * The FiniteStateMachineType is the base ObjectType for StateMachines that explicitly define
 * the possible States and Transitions. Once the States are defined subtypes shall not add new
 * States (see B.4.18).
 * The States of the machine are represented with instances of the StateType ObjectType.
 *
 * EachState shall have a BrowseName which is unique within the StateMachine and shall have a
 * StateNumber which shall also be unique across all States defined in the StateMachine.
 *
 * Be aware that States in a SubStateMachine may have the same StateNumber or BrowseName as
 * States in the parent machine. A concrete subtype of FiniteStateMachineType shall define at
 * least one State.
 *
 * A StateMachine may define one State which is an instance of the InitialStateType. This State
 * is the State that the machine goes into when it is activated.
 *
 * The Transitions that may occur are represented with instances of the TransitionType.
 *
 * Each Transition shall have a BrowseName which is unique within the StateMachine and may have a
 * TransitionNumber which shall also be unique across all Transitions defined in the StateMachine.
 *
 * The initial State for a Transition is a StateType Object which is the target of a FromState
 * Reference. The final State for a Transition is a StateType Object which is the target of a ToState
 * Reference. The FromState and ToState References shall always be specified.
 * A Transition may produce an Event. The Event is indicated by a HasEffect Reference to a
 * subtype of BaseEventType. The StateMachineType shall have GeneratesEvent References to
 * the targets of a HasEffect Reference for each of its Transitions.
 * A FiniteStateMachineType may define Methods that cause a transition to occur. These Methods
 * are targets of HasCause References for each of the Transitions that may be triggered by the
 * Method. The Executable Attribute for a Method is used to indicate whether the current State of
 * the machine allows the Method to be called.
 *
 * A FiniteStateMachineType may have sub-state-machines which are represented as instances
 * of StateMachineType ObjectTypes. Each State shall have a HasSubStateMachine Reference
 * to the StateMachineType Object which represents the child States. The SubStateMachine is
 * not active if the parent State is not active. In this case the CurrentState and LastTransition
 * Variables of the SubStateMachine shall have a status equal to BadStateNotActive (see Table
 * B.17).
 */
export interface FiniteStateMachineB extends StateMachineB {
    currentState: FiniteStateVariable;
    lastTransition?: FiniteTransitionVariable;

    // node-opcua stuff :
    currentStateNode: State;
}

export interface FiniteStateVariableB extends StateVariableB {
    /**
     * Id is inherited from the TransitionVariableType and overridden to reflect
     * the required DataType.
     * This value shall be the NodeId of one of the Transition Objects of the FiniteStateMachineType.
     */
    id: UAVariableT<NodeId, DataType.NodeId>;
}

export interface FiniteStateVariable extends FiniteStateVariableB, UAVariableT<LocalizedText, DataType.LocalizedText> {
}

export interface FiniteTransitionVariableB extends TransitionVariableB {
    /**
     * Id is inherited from the TransitionVariableType and overridden to reflect
     * the required DataType.
     * This value shall be the NodeId of one of the Transition Objects of the FiniteStateMachineType.
     */
    id: UAVariableT<NodeId, DataType.NodeId>;
    /*
    The Name Property is inherited from the TransitionVariableType. Its Value shall be the
    BrowseName of one of the Transition Objects of the FiniteStateMachineType.
    The Number Property is inherited from the TransitionVariableType. Its Value shall be the
    TransitionNumber for one of the Transition Objects of the FiniteStateMachineType.
     */
}

export interface FiniteTransitionVariable extends FiniteTransitionVariableB, UAVariableT<LocalizedText, DataType.LocalizedText> {
}

// tslint:disable-next-line:no-empty-interface
export interface FiniteStateMachine extends StateMachine {

}

export interface FiniteStateMachineType extends StateMachineType {
    instantiate(options: InstantiateObjectOptions): StateMachine;
}
