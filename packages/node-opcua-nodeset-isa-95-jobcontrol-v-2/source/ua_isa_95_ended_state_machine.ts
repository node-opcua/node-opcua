// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISA95EndedStateMachineType i=1005                           |
 * |isAbstract      |false                                                       |
 */
export interface UAISA95EndedStateMachine_Base extends UAFiniteStateMachine_Base {
    /**
     * closed
     * The job order has been completed and no further
     * post processing is performed.
     */
    closed: UAState;
    /**
     * completed
     * The job order has been completed and is no longer
     * in execution.
     */
    completed: UAState;
    /**
     * fromCompletedToClosed
     * This transition is triggered when the system has
     * finalized post processing of a ended job order.
     */
    fromCompletedToClosed: UATransition;
}
export interface UAISA95EndedStateMachine extends UAFiniteStateMachine, UAISA95EndedStateMachine_Base {
}