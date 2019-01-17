import { InstantiateObjectOptions } from "../address_space_ts";
import { StateMachine, StateMachineType } from "./state_machine";

export interface ExclusiveLimitStateMachine extends StateMachine {

}

export interface ExclusiveLimitStateMachineType extends StateMachineType {
    isAbstract: false;

    instantiate(options: InstantiateObjectOptions): ExclusiveLimitStateMachine;
}
