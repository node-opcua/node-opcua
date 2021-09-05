/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-empty-interface
import { InstantiateObjectOptions, UAMethod, UAObject, UAObjectType } from "node-opcua-address-space-base";
import { UAFiniteStateMachine, UAProgramStateMachine, UAProgramStateMachine_Base } from "node-opcua-nodeset-ua";
import { UAStateMachineEx, UAStateMachineType } from "./ua_state_machine_type";

export interface UAProgramStateMachineEx extends UAStateMachineEx {}

export interface UAProgramStateMachineType extends UAProgramStateMachine_Base, UAObjectType {
    instantiate(options: InstantiateObjectOptions): UAProgramStateMachineEx;
}
