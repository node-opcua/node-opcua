import type { UAPackMLExecuteStateMachine, UAPackMLExecuteStateMachine_Base } from "node-opcua-nodeset-pack-ml/dist/ua_pack_ml_execute_state_machine";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";

import type { UAWSHeldStateMachine } from "./ua_ws_held_state_machine";
import type { UAWSSuspendedStateMachine } from "./ua_ws_suspended_state_machine";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Weihenstephan/                  |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WSExecuteStateMachineType i=1005                            |
 * |isAbstract      |false                                                       |
 */
export interface UAWSExecuteStateMachine_Base extends UAPackMLExecuteStateMachine_Base {
    heldState: UAWSHeldStateMachine;
    suspendedState: UAWSSuspendedStateMachine;
    held: UAState;
    suspended: UAState;
}
export interface UAWSExecuteStateMachine extends Omit<UAPackMLExecuteStateMachine, "held"|"suspended">, UAWSExecuteStateMachine_Base {}