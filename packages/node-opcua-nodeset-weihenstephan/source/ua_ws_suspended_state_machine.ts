import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Weihenstephan/                  |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WSSuspendedStateMachineType i=1007                          |
 * |isAbstract      |false                                                       |
 */
export interface UAWSSuspendedStateMachine_Base extends UAFiniteStateMachine_Base {
    lack: UAState;
    lackBranchLine: UAState;
    prepared: UAState;
    tailback: UAState;
    tailbackBranchLine: UAState;
}
export interface UAWSSuspendedStateMachine extends UAFiniteStateMachine, UAWSSuspendedStateMachine_Base {}