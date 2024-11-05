// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISA95InterruptedStateMachineType i=1007                     |
 * |isAbstract      |false                                                       |
 */
export interface UAISA95InterruptedStateMachine_Base extends UAFiniteStateMachine_Base {
    /**
     * fromHeldToSuspended
     * This transition is triggered when the system has
     * switched the job order from internally held to
     * externally suspended, for example by a call of
     * the Pause Method.
     */
    fromHeldToSuspended: UATransition;
    /**
     * fromSuspendedToHeld
     * This transition is triggered when the system has
     * switched the job order from externally suspended
     * to an internal held, for example by a call of the
     * Resume Method.
     */
    fromSuspendedToHeld: UATransition;
    /**
     * held
     * The job order has been temporarily stopped due to
     * a constraint of some form.
     */
    held: UAState;
    /**
     * suspended
     * The job order has been temporarily stopped due to
     * a deliberate decision within the execution system.
     */
    suspended: UAState;
}
export interface UAISA95InterruptedStateMachine extends UAFiniteStateMachine, UAISA95InterruptedStateMachine_Base {
}