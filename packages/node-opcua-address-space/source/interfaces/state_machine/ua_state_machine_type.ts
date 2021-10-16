/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-empty-interface
import { DateTime, UInt32 } from "node-opcua-basic-types";
import { LocalizedText } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";
import {
    UAProperty,
    InstantiateObjectOptions,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariableTypeT
} from "node-opcua-address-space-base";
import {
    UAInitialState,
    UAInitialState_Base,
    UAState,
    UAState_Base,
    UAStateMachine_Base,
    UATransition_Base,
    UATransitionEvent_Base
} from "node-opcua-nodeset-ua";

import { UATransitionEx } from "./ua_transition_ex";

export type UtcTime = DateTime;

export interface NonHierarchicalReferences extends UAReferenceType {}

export interface UAStateVariableType extends UAVariableTypeT<LocalizedText, DataType.LocalizedText> {
    // attributes
    isAbstract: false;
}
// ----------------
export interface StateB {
    stateNumber: UAProperty<UInt32, DataType.UInt32>;
}

export interface UAStateType extends UAState_Base, UAObjectType {}

export interface UATransitionType extends UATransition_Base, UAObjectType {}

/**
 * Initial State Type
 *
 * The InitialStateType is a subtype of the StateType and is formally defined in Table B.8.
 * An Object of the InitialStateType represents the State that a FiniteStateMachine enters
 * when it is activated.
 *
 * Each FiniteStateMachine can have at most one State of type InitialStateType, but
 * a FiniteStateMachine does not have to have a State of this type.
 *
 * A SubStateMachine goes into its initial state whenever the parent state is entered. However, a
 * state machine may define a transition that goes directly to a state of the SubStateMachine. In
 * this case the SubStateMachine goes into that State instead of the initial State. The two
 * scenarios are illustrated in Figure B.4. The transition from State5 to State6 causes the
 * SubStateMachine to go into the initial State (State7), however, the transition from State4 to
 * State8 causes the parent machine to go to State6 and the SubStateMachine will go to State8.
 *
 * If no initial state for a SubStateMachine exists and the State having the SubStateMachine is
 * entered directly, then the State of the SubStateMachine is server-specific.
 */

export interface UAInitialStateType extends UAInitialState_Base, UAStateType {}

// export interface UAInitialState extends InitialStateB, UAState {}

/**
 * ToState Reference Type
 *
 * The ToState ReferenceType is a concrete ReferenceType and can be used directly. It is a
 * subtype of NonHierarchicalReferences.
 *
 * The semantic of this ReferenceType is to point form a Transition to the ending State the
 * Transition connects.
 *
 * The SourceNode of this ReferenceType shall be an Object of the ObjectType TransitionType or
 * one of its subtypes. The TargetNode of this ReferenceType shall be an Object of the ObjectType
 * StateType or one of its subtypes.
 *
 * References of this ReferenceType may be only exposed uni-directional. Sometimes this is
 * required, for example, if a Transition points to a State of a sub-machine.
 */
export interface ToStateReferenceType extends NonHierarchicalReferences {}

/**
 *
 * FromState Reference Type
 *
 * The FromState ReferenceType is a concrete ReferenceType and can be used directly. It is a
 * subtype of NonHierarchicalReferences.
 *
 * The semantic of this ReferenceType is to point form a Transition to the starting State the
 * Transition connects.
 *
 * The SourceNode of this ReferenceType shall be an Object of the ObjectType TransitionType or
 * one of its subtypes. The TargetNode of this ReferenceType shall be an Object of the ObjectType
 * StateType or one of its subtypes.
 */
export interface FromStateReferenceType extends NonHierarchicalReferences {}

/**
 * HasCause
 * The HasCause ReferenceType is a concrete ReferenceType and can be used directly. It is a
 * subtype of NonHierarchicalReferences.
 *
 * The semantic of this ReferenceType is to point form a Transition to something that causes the
 * Transition. In this annex we only define Methods as Causes. However, the ReferenceType is
 * not restricted to point to Methods. The referenced Methods can, but do not have to point to a
 * Method of the StateMachineType. For example, it is allowed to point to a server-wide restart
 * Method leading the state machine to go into its initial state.
 *
 * The SourceNode of this ReferenceType shall be an Object of the ObjectType TransitionType or
 * one of its subtypes. The TargetNode can be of any NodeClass
 */
export interface HasCauseReferenceType extends NonHierarchicalReferences {
    // inverseName: LocalizedTextT<"MayBeCausedBy">;
}

/**
 * HasEffect ReferenceType
 *
 * The HasEffect ReferenceType is a concrete ReferenceType and can be used directly. It is a
 * subtype of NonHierarchicalReferences.
 * The semantic of this ReferenceType is to point form a Transition to something that will be
 * effected when the Transition is triggered. In this annex we only define EventTypes as Effects.
 *
 * However, the ReferenceType is not restricted to point to EventTypes.
 *
 * The SourceNode of this ReferenceType shall be an Object of the ObjectType TransitionType or
 * one of its subtypes. The TargetNode can be of any NodeClass.
 */
export interface HasEffectReferenceType extends NonHierarchicalReferences {}

/**
 * The HasSubStateMachine ReferenceType is a concrete ReferenceType and can be used
 * directly. It is a subtype of NonHierarchicalReferences.
 *
 * The semantic of this ReferenceType is to point from a State to an instance of
 * StateMachineType which represents the sub-states for the State.
 *
 * The SourceNode of this ReferenceType shall be an Object of the ObjectType StateType.
 *
 * The TargetNode shall be an Object of the ObjectType StateMachineType or one of its subtypes.
 *
 * Each Object can be the TargetNode of at most one HasSubStateMachine Reference.
 *
 * The SourceNode (the state) and the TargetNode (the SubStateMachine) shall belong to the
 * same StateMachine, that is, both shall be referenced from the same Object of type
 * StateMachineType using a HasComponent Reference or a subtype of HasComponent.
 */
export interface HasSubStateMachine extends NonHierarchicalReferences {}

/**
 * The TransitionEventType is a subtype of the BaseEventType. It can be used to generate an
 * Event identifying that a Transition of a StateMachine was triggered.
 *
 * The TransitionEventType inherits the Properties of the BaseEventType.
 *
 * The inherited Property SourceNode shall be filled with the NodeId of the StateMachine instance
 * where the Transition occurs. If the Transition occurs in a SubStateMachine, then the NodeId of
 * the SubStateMachine has to be used. If the Transition occurs between a StateMachine and a
 * SubStateMachine, then the NodeId of the StateMachine has to be used, independent of the
 * direction of the Transition.
 */
export interface UATransitionEventType extends UATransitionEvent_Base, UAObjectType {}

export type TransitionSelector = (transitions: UATransitionEx[], fromState: UAState, toState: UAState) => UATransitionEx | null;

/**
 * State Machine type
 *
 * StateMachines produce Events which may include the current state of a StateMachine. In that
 * case Servers shall provide all the optional Properties of the StateVariableType in the Event,
 * even if they are not provided on the instances in the address space.
 */

/**
 * StateMachineType
 *
 * The StateMachineType is the base ObjectType for all StateMachineTypes. It defines a single
 * Variable which represents the current state of the machine.
 * An instance of this ObjectType shall generate an Event whenever a significant state change occurs.
 * The Server decides which state changes are significant. Servers shall use the GeneratesEvent
 * ReferenceType to indicate which Event(s) could be produced by the StateMachine.
 *
 * Subtypes may add Methods which affect the state of the machine. The Executable Attribute is
 * used to indicate whether the Method is valid given the current state of the machine. The
 * generation of AuditEvents for Methods is defined in Part 4. A StateMachine may not be active.
 *
 * In this case, the CurrentState and LastTransition Variables shall have a status equal to
 * BadStateNotActive (see Table B.17).
 *
 * Subtypes may add components which are instances of StateMachineTypes. These components
 * are considered to be sub-states of the StateMachine. SubStateMachines are only active when
 * the parent machine is in an appropriate state.
 * Events produced by SubStateMachines may be suppressed by the parent machine. In some
 * cases, the parent machine will produce a single Event that reflects changes in multiple
 * SubStateMachines
 */
export interface UAStateMachineHelper {
    // extra stuff
    readonly initialState: UAInitialState | null;
    readonly states: UAState[];
    readonly transitions: UATransitionEx[];
    currentStateNode: UAState | null;

    /**
     * return all state nodes associated with this state machine
     */
    getStates(): UAState[];

    /**
     * return all state to state transition node associated with this state machine
     */
    getTransitions(): UATransitionEx[];

    /**
     * return the state Node by Name
     * @param name
     */
    getStateByName(name: string): UAState | null;

    /**
     * returns true if there is a valid transition from currentStateNode to toStateNode
     * @param toStateNode
     */
    isValidTransition(toStateNode: UAState | string, predicate?: TransitionSelector): boolean;

    /**
     * try to find the valid transition between fromState Node to toState Node
     * @param fromStateNode
     * @param toStateNode
     */
    findTransitionNode(fromStateNode: UAState, toStateNode: UAState, predicate?: TransitionSelector): UATransitionEx | null;

    /**
     * return the current state as string
     */
    getCurrentState(): string | null;

    /**
     * change the current state
     *
     * note:
     *  - a transition from currentState to toState node must exists
     * - a TransitionEventType event will be raised
     * @param toStateNode
     */
    setState(toStateNode: UAState | string | null, predicate?: TransitionSelector): void;
}

export interface UAStateMachineEx extends UAObject, UAStateMachineHelper, UAStateMachine_Base {}

export interface UAStateMachineType extends UAObjectType, UAStateMachineHelper, UAStateMachine_Base {
    instantiate(options: InstantiateObjectOptions): UAStateMachineEx;
}

export declare function promoteToStateMachine(node: UAObject): UAStateMachineEx;
