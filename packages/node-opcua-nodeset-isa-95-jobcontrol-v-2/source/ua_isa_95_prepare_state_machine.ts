// ----- this file has been automatically generated - do not edit
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISA95PrepareStateMachineType i=1001                         |
 * |isAbstract      |false                                                       |
 */
export interface UAISA95PrepareStateMachine_Base extends UAFiniteStateMachine_Base {
    /**
     * fromLoadedToReady
     * This transition is triggered when the program or
     * configuration to execute the job order is
     * unloaded.
     */
    fromLoadedToReady: UATransition;
    /**
     * fromLoadedToWaiting
     * This transition is triggered when the system is
     * not ready to start the execution of the job order
     * anymore.
     */
    fromLoadedToWaiting: UATransition;
    /**
     * fromReadyToLoaded
     * This transition is triggered when the program or
     * configuration to execute the job order is loaded.
     */
    fromReadyToLoaded: UATransition;
    /**
     * fromReadyToWaiting
     * This transition is triggered when the system is
     * not ready to start the execution of the job order
     * anymore.
     */
    fromReadyToWaiting: UATransition;
    /**
     * fromWaitingToReady
     * This transition is triggered when the system is
     * ready to start the execution of the job order.
     */
    fromWaitingToReady: UATransition;
    /**
     * loaded
     * In situations where only one job may be in active
     * memory and is able to be run, then the job is
     * loaded in active memory, the necessary
     * pre-conditions have been met, and the job order
     * is ready to run, awaiting a Start command.
     */
    loaded: UAState;
    /**
     * ready
     * The necessary pre-conditions have been met and
     * the job order is ready to run, awaiting a Start
     * command.
     */
    ready: UAState;
    /**
     * waiting
     * The necessary pre-conditions have not been met
     * and the job order is not ready to run.
     */
    waiting: UAState;
}
export interface UAISA95PrepareStateMachine extends UAFiniteStateMachine, UAISA95PrepareStateMachine_Base {
}