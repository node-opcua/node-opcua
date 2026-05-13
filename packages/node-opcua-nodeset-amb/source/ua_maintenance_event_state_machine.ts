import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";

// ----- this file has been automatically generated - do not edit

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
export interface UAMaintenanceEventStateMachine extends UAFiniteStateMachine, UAMaintenanceEventStateMachine_Base {}