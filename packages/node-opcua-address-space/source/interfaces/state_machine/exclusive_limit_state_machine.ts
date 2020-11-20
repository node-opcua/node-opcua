/**
 * @module node-opcua-address-space
 */
import { InstantiateObjectOptions } from "../../address_space_ts";
import { StateMachine, StateMachineType } from "./state_machine";

// tslint:disable-next-line:no-empty-interface
export interface ExclusiveLimitStateMachine extends StateMachine {}

export interface ExclusiveLimitStateMachineType extends StateMachineType {
    isAbstract: false;

    instantiate(options: InstantiateObjectOptions): ExclusiveLimitStateMachine;
}
