import { UAObject, UAObjectType } from "node-opcua-address-space-base";
import { UAState } from "node-opcua-nodeset-ua";
import { QualifiedNameLike } from "node-opcua-data-model";

import { UATransitionEx } from "./interfaces/state_machine/ua_transition_ex";
export interface INamespaceMachineState {
    addState(component: UAObject | UAObjectType, stateName: QualifiedNameLike, stateNumber: number, isInitialState?: boolean): UAState;
    addTransition(
        component: UAObject | UAObjectType /* StateMachine | StateMachineType,*/,
        fromState: string,
        toState: string,
        transitionNumber: number,
        browseName?: QualifiedNameLike
    ): UATransitionEx;
}
