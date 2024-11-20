/**
 * @module node-opcua-address-space
 */
import { InstantiateObjectOptions, UAObject } from "node-opcua-address-space-base";
import { UAExclusiveLimitStateMachine, UAExclusiveLimitStateMachine_Base } from "node-opcua-nodeset-ua";

import { UAStateMachineEx, UAStateMachineHelper, UAStateMachineType } from "./ua_state_machine_type";

export interface UAExclusiveLimitStateMachineEx
    extends UAObject,
        Omit<UAExclusiveLimitStateMachine_Base, "currentState" | "lastTransition">,
        UAStateMachineHelper,
        UAStateMachineEx {
    /** empty interface */
}

export interface UAExclusiveLimitStateMachineType extends UAStateMachineType {
    isAbstract: false;
    instantiate(options: InstantiateObjectOptions): UAExclusiveLimitStateMachineEx;
}
