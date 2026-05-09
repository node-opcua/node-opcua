import type { UAObject, UAObjectType } from "node-opcua-address-space-base";
import type { QualifiedNameLike } from "node-opcua-data-model";
import type { UAState } from "node-opcua-nodeset-ua";

import type { UATransitionEx } from "./interfaces/state_machine/ua_transition_ex";
export interface INamespaceMachineState {
    addState(
        component: UAObject | UAObjectType,
        stateName: QualifiedNameLike,
        stateNumber: number,
        isInitialState?: boolean
    ): UAState;
    addTransition(
        component: UAObject | UAObjectType /* StateMachine | StateMachineType,*/,
        fromState: string,
        toState: string,
        transitionNumber: number,
        browseName?: QualifiedNameLike
    ): UATransitionEx;
}
