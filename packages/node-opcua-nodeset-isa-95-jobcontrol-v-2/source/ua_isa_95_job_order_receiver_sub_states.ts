// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt32 } from "node-opcua-basic-types"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAISA95JobOrderReceiverObject, UAISA95JobOrderReceiverObject_Base } from "./ua_isa_95_job_order_receiver_object"
import { UAISA95PrepareStateMachine } from "./ua_isa_95_prepare_state_machine"
import { UAISA95EndedStateMachine } from "./ua_isa_95_ended_state_machine"
import { UAISA95InterruptedStateMachine } from "./ua_isa_95_interrupted_state_machine"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISA95JobOrderReceiverSubStatesType i=1008                   |
 * |isAbstract      |false                                                       |
 */
export interface UAISA95JobOrderReceiverSubStates_Base extends UAISA95JobOrderReceiverObject_Base {
    /**
     * aborted
     * The job order is aborted.
     */
    aborted: UAState;
    /**
     * allowedToStart
     * The job order is stored and may be executed.
     */
    allowedToStart: UAState;
    /**
     * allowedToStartSubstates
     * Substates of AllowedToStart
     */
    allowedToStartSubstates?: UAISA95PrepareStateMachine;
    /**
     * ended
     * The job order has been completed and is no longer
     * in execution.
     */
    ended: UAState;
    /**
     * endedSubstates
     * Substates of Ended
     */
    endedSubstates?: UAISA95EndedStateMachine;
    /**
     * fromAllowedToStartToAborted
     * This transition is triggered when Abort Method is
     * called.
     */
    fromAllowedToStartToAborted: UATransition;
    /**
     * fromAllowedToStartToAllowedToStart
     * This transition is triggered when the Update
     * Method is called and the job order is modified.
     */
    fromAllowedToStartToAllowedToStart: UATransition;
    /**
     * fromAllowedToStartToNotAllowedToStart
     * This transition is triggered when the RevokeStart
     * Method is called.
     */
    fromAllowedToStartToNotAllowedToStart: UATransition;
    /**
     * fromAllowedToStartToRunning
     * This transition is triggered when a job order is
     * started to be executed.
     */
    fromAllowedToStartToRunning: UATransition;
    /**
     * fromInterruptedToAborted
     * This transition is triggered when Abort Method is
     * called.
     */
    fromInterruptedToAborted: UATransition;
    /**
     * fromInterruptedToEnded
     * This transition is triggered when Stop Method is
     * called.
     */
    fromInterruptedToEnded: UATransition;
    /**
     * fromInterruptedToRunning
     * This transition is triggered when Resume Method
     * is called.
     */
    fromInterruptedToRunning: UATransition;
    /**
     * fromNotAllowedToStartToAborted
     * This transition is triggered when Abort Method is
     * called.
     */
    fromNotAllowedToStartToAborted: UATransition;
    /**
     * fromNotAllowedToStartToAllowedToStart
     * This transition is triggered when the Start
     * Method is called.
     */
    fromNotAllowedToStartToAllowedToStart: UATransition;
    /**
     * fromNotAllowedToStartToNotAllowedToStart
     * This transition is triggered when the Update
     * Method is called and the job order is modified.
     */
    fromNotAllowedToStartToNotAllowedToStart: UATransition;
    /**
     * fromRunningToAborted
     * This transition is triggered when Abort Method is
     * called.
     */
    fromRunningToAborted: UATransition;
    /**
     * fromRunningToEnded
     * This transition is triggered when the execution
     * of a job order has finished, either internally or
     * by the Stop Method.
     */
    fromRunningToEnded: UATransition;
    /**
     * fromRunningToInterrupted
     * This transition is triggered when an executing
     * job order gets interrupted, either internally or
     * by the Pause Method.
     */
    fromRunningToInterrupted: UATransition;
    /**
     * interrupted
     * The job order has been temporarily stopped.
     */
    interrupted: UAState;
    /**
     * interruptedSubstates
     * Substates of Interrupted
     */
    interruptedSubstates?: UAISA95InterruptedStateMachine;
    /**
     * notAllowedToStart
     * The job order is stored but may not be executed.
     */
    notAllowedToStart: UAState;
    /**
     * notAllowedToStartSubstates
     * Substates of NotAllowedToStart
     */
    notAllowedToStartSubstates?: UAISA95PrepareStateMachine;
    /**
     * running
     * The job order is executing.
     */
    running: UAState;
}
export interface UAISA95JobOrderReceiverSubStates extends Omit<UAISA95JobOrderReceiverObject, "aborted"|"allowedToStart"|"ended"|"fromAllowedToStartToAborted"|"fromAllowedToStartToAllowedToStart"|"fromAllowedToStartToNotAllowedToStart"|"fromAllowedToStartToRunning"|"fromInterruptedToAborted"|"fromInterruptedToEnded"|"fromInterruptedToRunning"|"fromNotAllowedToStartToAborted"|"fromNotAllowedToStartToAllowedToStart"|"fromNotAllowedToStartToNotAllowedToStart"|"fromRunningToAborted"|"fromRunningToEnded"|"fromRunningToInterrupted"|"interrupted"|"notAllowedToStart"|"running">, UAISA95JobOrderReceiverSubStates_Base {
}