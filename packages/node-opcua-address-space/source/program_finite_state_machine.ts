// tslint:disable:no-empty-interface
import { UAMethod, UAObject, UAObjectType } from "./address_space_ts";
import { FiniteStateMachineB, State, StateMachine, StateMachineB, StateMachineType, Transition } from "./state_machine";

/**
 * Program Finite State Machine
 *
 *
 * as per part 10 : Program Specification
 *
 * A standard set of base states is defined for Programs as part of the Program Finite State
 * Machine. These states represent the stages in which a Program can exist at an instance in
 * time as viewed by a Client. This state is the Program’s current state. All Programs shall
 * support this base set. A Program may or may not require a Client action to cause the state to
 * change. The states are formally defined in Table 2.
 *
 *
 * Table 2 – Program states
 *  | State     | Description
 *  |-----------|-------------------------------------------------------------------------------------|
 *  | Ready     | The Program is properly initialized and may be started.                             |
 *  | Running   | The Program is executing making progress towards completion.                        |
 *  | Suspended | The Program has been stopped prior to reaching a terminal state but may be resumed. |
 *  | Halted    | The Program is in a terminal or failed state, and it cannot be started or resumed without being reset|
 *
 *  The set of states defined to describe a Program can be expanded. Program sub states can be
 *  defined for the base states to provide more resolution of a process and to describe the cause
 *  and effect(s) of additional stimuli and transitions.
 *  Standards bodies and industry groups may extend the base Program Finite State Model to conform to
 *  various industry models. For example, the Halted state can include the sub states “Aborted” and “Completed”
 *  to indicate if the function achieved a successful conclusion prior to the transition to Halted. Transitiona
 */
export interface ProgramFiniteStateMachineB extends FiniteStateMachineB {

    // -- States
    readonly halted: State;
    readonly ready: State;
    readonly running: State;
    readonly suspended: State;

    // -- transitions
    readonly haltedToReady: Transition;
    readonly readyToRunning: Transition;

    readonly runningToHalted: Transition;
    readonly runningToReady: Transition;
    readonly runningToSuspended: Transition;

    readonly suspendedToRunning: Transition;
    readonly suspendedToHalted: Transition;
    readonly suspendedToReady: Transition;
    readonly readyToHalted: Transition;

    // methods
    /**
     * Start Causes the Program to transition from the Ready state to the Running state.
     */
    readonly start: UAMethod;
    /**
     * Suspend Causes the Program to transition from the Running state to the Suspended state.
     */
    readonly suspend: UAMethod;
    /**
     * Resume Causes the Program to transition from the Suspended state to the Running state.
     */
    readonly resume: UAMethod;
    /**
     * Halt Causes the Program to transition from the Ready, Running or Suspended state to the Halted state.
     */
    readonly halt: UAMethod;
    /**
     * Reset Causes the Program to transition from the Halted state to the Ready state
     */
    reset: UAMethod;
}

export interface ProgramFiniteStateMachineType extends ProgramFiniteStateMachineB, UAObjectType {

}

export interface ProgramFiniteStateMachine extends ProgramFiniteStateMachineB, UAObject {

}
