/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-empty-interface
import { DateTime, UAString, UInt32 } from "node-opcua-basic-types";
import { LocalizedText, QualifiedName, QualifiedNameLike } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import {
    InstantiateObjectOptions,
    ModellingRuleType,
    Property,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariable,
    UAVariableT,
    UAVariableType,
    UAVariableTypeT,
    BaseNode
} from "../../address_space_ts";
import { _UAStateVariable } from "./ua_state_variable";

export type UtcTime = DateTime;

export type UABaseEventType = UAObjectType;

export interface NonHierarchicalReferences extends UAReferenceType {}

export interface StateVariableType extends UAVariableTypeT<LocalizedText, DataType.LocalizedText>, _UAStateVariable {
    // attributes
    isAbstract: false;
}

export interface StateVariable extends UAVariableT<LocalizedText, DataType.LocalizedText>, _UAStateVariable {
    //
}

/**
 * The TransitionVariableType is the base VariableType for Variables that store a Transition that
 * occurred within a StateMachine as a human readable name.
 *
 * The SourceTimestamp for the value specifies when the Transition occurred. This value may
 * also be exposed with the TransitionTime Property
 */
export interface TransitionVariableB {
    // attributes
    isAbstract: false;
    // readonly dataType: NodeId; // DataType.LocalizedText;
    // readonly valueRank: -1;

    // components
    /**
     * is a name which uniquely identifies a Transition within the StateMachineType.
     *
     * A subtype may restrict the DataType.
     */
    id: UAVariableT<UAString | NodeId | UInt32, DataType.String | DataType.NodeId | DataType.UInt32>;

    /**
     * Name is a QualifiedName which uniquely identifies a transition within the StateMachineType
     */
    name?: UAVariableT<QualifiedName, DataType.QualifiedName>;
    /**
     * Number is an integer which uniquely identifies a transition within the StateMachineType.
     */
    number?: UAVariableT<UInt32, DataType.UInt32>;

    /**
     * TransitionTime specifies when the transition occurred.
     */
    transitionTime?: UAVariableT<UtcTime, DataType.DateTime>;

    /**
     * Effective Transition time
     *
     * EffectiveTransitionTime specifies the time when the current state or one of its substates was
     * entered. If, for example, a StateA is active and – while active – switches several times between
     * its substates SubA and SubB, then the TransitionTime stays at the point in time where StateA
     * became active whereas the EffectiveTransitionTime changes with each change of a substate.
     */
    effectiveTransitionTime?: UAVariableT<UtcTime, DataType.DateTime>;
}

export interface TransitionVariable extends UAVariableT<LocalizedText, DataType.LocalizedText>, TransitionVariableB {
    //
}

// ----------------
export interface StateB {
    stateNumber: Property<UInt32, DataType.UInt32>;
}

export interface StateType extends StateB, UAObjectType {}

export interface State extends StateB, UAObject {}

// ----------------
export interface TransitionB {
    transitionNumber: Property<UInt32, DataType.UInt32>;
}

export interface TransitionType extends TransitionB, UAObjectType {}

export interface Transition extends TransitionB, UAObject {}

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
export interface InitialStateB extends StateB {}

export interface InitialStateType extends InitialStateB, StateType {}

export interface InitialState extends InitialStateB, State {}

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
export interface TransitionEventType extends UABaseEventType {
    /**
     *  Transition identifies the Transition that triggered the Event.
     */
    transition: TransitionVariable;
    /**
     * FromState identifies the State before the Transition.
     */
    fromState: StateVariable;
    /**
     * ToState identifies the State after the Transition.
     */
    toState: StateVariable;
}

/**
 * Transitions of a FiniteStateMachine are represented as Objects of the ObjectType
 * TransitionType formally defined in Table B.9.
 * Each valid Transition shall have exactly one FromState Reference and exactly one ToState
 * Reference, each pointing to an Object of the ObjectType StateType.
 * Each Transition can have one or more HasCause References pointing to the cause that triggers
 * the Transition.
 * Each Transition can have one or more HasEffect References pointing to the effects that occur
 * when the Transition was triggered.
 */
export interface TransitionB {
    transitionNumber: Property<UInt32, DataType.UInt32>;

    // nde-opcua specific:
    /**
     * direct access to the ToState node as defined in the ToState Reference
     * toStateNode is pointed by the ToStateReferenceType references
     */
    toStateNode: State | null;
    /**
     * direct access to the FromState node as defined in the ToState Reference
     * fromStateNode is pointed by the ToStateReferenceType references
     */
    fromStateNode: State | null;
}

export interface TransitionType extends TransitionB, UAObjectType {}

export interface Transition extends TransitionB, UAObject {}

export type TransitionSelector = (transitions: Transition[], fromState: State, toState: State) => Transition | null;

/**
 * State Machine type
 *
 * StateMachines produce Events which may include the current state of a StateMachine. In that
 * case Servers shall provide all the optional Properties of the StateVariableType in the Event,
 * even if they are not provided on the instances in the AddressSpace.
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
export interface StateMachineB {
    /**
     * Current state
     * CurrentState stores the current state of an instance of the StateMachineType. CurrentState
     * provides a human readable name for the current state which may not be suitable for use in
     * application control logic. Applications should use the Id Property of CurrentState if they need a
     * nique identifier for the state.
     */
    readonly currentState: StateVariable;
    /**
     * Last transition
     *
     * LastTransition stores the last transition which occurred in an instance of the StateMachineType.
     * LastTransition provides a human readable name.
     */
    readonly lastTransition?: TransitionVariable | null;

    // extra stuff
    readonly initialState: InitialState | null;
    readonly states: State[];
    readonly transitions: Transition[];

    /**
     * return all state nodes associated with this state machine
     */
    getStates(): State[];

    /**
     * return all state to state transition node associated with this state machine
     */
    getTransitions(): Transition[];

    /**
     * return the state Node by Name
     * @param name
     */
    getStateByName(name: string): State | null;

    /**
     * returns true if there is a valid transition from currentStateNode to toStateNode
     * @param toStateNode
     */
    isValidTransition(toStateNode: State | string, predicate?: TransitionSelector): boolean;

    /**
     * try to find the valid transition between fromState Node to toState Node
     * @param fromStateNode
     * @param toStateNode
     */
    findTransitionNode(fromStateNode: State, toStateNode: State, predicate?: TransitionSelector): Transition | null;

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
    setState(toStateNode: State | string | null, predicate?: TransitionSelector): void;
}

export interface StateMachineType extends UAObjectType, StateMachineB {
    readonly currentState: StateVariable;
    readonly lastTransition: TransitionVariable;
    instantiate(options: InstantiateObjectOptions): StateMachine;
}

export declare function promoteToStateMachine(node: UAObject): StateMachine;

export interface StateMachine extends UAObject, StateMachineB {
    readonly currentState: StateVariable;
    readonly lastTransition?: TransitionVariable | null;
    readonly initialState: InitialState | null;
    readonly states: State[];
    readonly transitions: Transition[];

    getStates(): State[];

    getTransitions(): Transition[];

    getStateByName(name: string): State | null;

    isValidTransition(toStateNode: State | string, predicate?: TransitionSelector): boolean;

    findTransitionNode(fromStateNode: State, toStateNode: State, predicate?: TransitionSelector): Transition | null;

    getCurrentState(): string | null;

    setState(toStateNode: State | string, predicate?: TransitionSelector): void;
}
