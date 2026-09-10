import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine.js";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MaintenanceModeStateMachineType i=1004                      |
 * |isAbstract      |false                                                       |
 */
export interface UAMaintenanceModeStateMachine_Base extends UAFiniteStateMachine_Base {
    inspection: UAState;
    other: UAState;
    repair: UAState;
    service: UAState;
    upgrade: UAState;
}
export interface UAMaintenanceModeStateMachine extends UAFiniteStateMachine, UAMaintenanceModeStateMachine_Base {}