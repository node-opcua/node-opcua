import { UAProperty, UAMethod, UAObject } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { UAShelvedStateMachine, UAShelvedStateMachine_Base, UAState, UAStateMachine, UATransition } from "node-opcua-nodeset-ua";
import { UAStateMachineEx } from "./ua_state_machine_type";

import { UATransitionEx } from "./ua_transition_ex";

export interface UAShelvedStateMachineHelper {
    _timer: NodeJS.Timer | null;
    _sheveldTime: Date;
    _unshelvedTime: Date;
    _duration: number;
}

export interface UAShelvedStateMachineEx extends UAShelvedStateMachine_Base, UAStateMachineEx, UAShelvedStateMachineHelper {
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
