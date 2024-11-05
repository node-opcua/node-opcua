// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAInitialState } from "node-opcua-nodeset-ua/source/ua_initial_state"
/**
 * Information, whether a maintenance activity is
 * planned, currently in execution, or has been
 * executed
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AMB/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MaintenanceEventStateMachineType i=1013                     |
 * |isAbstract      |false                                                       |
 */
export interface UAMaintenanceEventStateMachine_Base extends UAFiniteStateMachine_Base {
    executing: UAState;
    finished: UAState;
    fromExecutingToFinished: UATransition;
    fromFinishedToPlanned: UATransition;
    fromPlannedToExecuting: UATransition;
    planned: UAInitialState;
}
export interface UAMaintenanceEventStateMachine extends UAFiniteStateMachine, UAMaintenanceEventStateMachine_Base {
}