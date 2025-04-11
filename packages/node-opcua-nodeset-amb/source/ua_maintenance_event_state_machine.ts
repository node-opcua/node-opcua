// ----- this file has been automatically generated - do not edit
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
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