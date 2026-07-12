import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Weihenstephan/                  |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WSHeldStateMachineType i=1006                               |
 * |isAbstract      |false                                                       |
 */
export interface UAWSHeldStateMachine_Base extends UAFiniteStateMachine_Base {
    equipmentFailure: UAState;
    externalFailure: UAState;
}
export interface UAWSHeldStateMachine extends UAFiniteStateMachine, UAWSHeldStateMachine_Base {}