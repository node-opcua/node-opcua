// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int16 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransitionVariable } from "node-opcua-nodeset-ua/dist/ua_transition_variable"
import { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
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
export interface UAReadySubstateMachine extends Omit<UAFiniteStateMachine, "lastTransition">, UAReadySubstateMachine_Base {
}