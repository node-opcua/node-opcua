/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-empty-interface
import type { InstantiateObjectOptions, UAObjectType } from "node-opcua-address-space-base";
import type { UAProgramStateMachine_Base } from "node-opcua-nodeset-ua";
import type { UAStateMachineEx } from "./ua_state_machine_type";

export interface UAProgramStateMachineEx extends UAStateMachineEx {
    /** empty interface */
}

export interface UAProgramStateMachineType extends UAProgramStateMachine_Base, UAObjectType {
    instantiate(options: InstantiateObjectOptions): UAProgramStateMachineEx;
}
