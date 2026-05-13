import type { UAMethod } from "node-opcua-address-space-base";
import type { Int16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";
import type { UATransitionVariable } from "node-opcua-nodeset-ua/dist/ua_transition_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ReadySubstateMachineType i=1012                             |
 * |isAbstract      |false                                                       |
 */
export interface UAReadySubstateMachine_Base extends UAFiniteStateMachine_Base {
    atProgramStart: UAState;
    lastTransition: UATransitionVariable<LocalizedText>;
    lastTransitionReason: UAMultiStateValueDiscrete<Int16, DataType.Int16>;
    programStartToSuspended: UATransition;
    resetToProgramStart?: UAMethod;
    suspended: UAState;
    suspendedToProgramStart: UATransition;
}
export interface UAReadySubstateMachine extends Omit<UAFiniteStateMachine, "lastTransition">, UAReadySubstateMachine_Base {}