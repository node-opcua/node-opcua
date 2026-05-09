/**
 * @module node-opcua-address-space
 */
import type { InstantiateObjectOptions, UAObject } from "node-opcua-address-space-base";
import type { UAExclusiveLimitStateMachine_Base } from "node-opcua-nodeset-ua";

import type { UAStateMachineEx, UAStateMachineHelper, UAStateMachineType } from "./ua_state_machine_type";

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
