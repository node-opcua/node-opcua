import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-basic-types";
import type { UAShelvedStateMachine_Base, UAState } from "node-opcua-nodeset-ua";
import type { UAStateMachineEx } from "./ua_state_machine_type";

import type { UATransitionEx } from "./ua_transition_ex";

export interface UAShelvedStateMachineHelper {
    _timer: NodeJS.Timeout | null;
    _shelvedTime: Date;
    _unshelvedTime: Date;
    _duration: number;
}

export interface UAShelvedStateMachineEx
    extends Omit<UAShelvedStateMachine_Base, "currentState" | "lastTransition">,
        UAStateMachineEx,
        UAShelvedStateMachineHelper {
    unshelveTime: UAProperty<number, /*z*/ DataType.Double>;
    unshelved: UAState;
    timedShelved: UAState;
    oneShotShelved: UAState;
    unshelvedToTimedShelved: UATransitionEx;
    unshelvedToOneShotShelved: UATransitionEx;
    timedShelvedToUnshelved: UATransitionEx;
    timedShelvedToOneShotShelved: UATransitionEx;
    oneShotShelvedToUnshelved: UATransitionEx;
    oneShotShelvedToTimedShelved: UATransitionEx;
    timedShelve: UAMethod;
    timedShelve2?: UAMethod;
    unshelve: UAMethod;
    unshelve2?: UAMethod;
    oneShotShelve: UAMethod;
    oneShotShelve2?: UAMethod;
}
