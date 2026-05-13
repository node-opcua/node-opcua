import type { Int16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine";
import type { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state";
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
 * |typedDefinition |ExecutingSubstateMachineType i=1007                         |
 * |isAbstract      |false                                                       |
 */
export interface UAExecutingSubstateMachine_Base extends UAFiniteStateMachine_Base {
    lastTransition: UATransitionVariable<LocalizedText>;
    lastTransitionReason: UAMultiStateValueDiscrete<Int16, DataType.Int16>;
    running: UAInitialState;
    runningToStopping: UATransition;
    stopping: UAState;
}
export interface UAExecutingSubstateMachine extends Omit<UAFiniteStateMachine, "lastTransition">, UAExecutingSubstateMachine_Base {}