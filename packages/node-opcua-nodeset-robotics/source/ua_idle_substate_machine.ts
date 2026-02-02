// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int16 } from "node-opcua-basic-types"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UATransitionVariable } from "node-opcua-nodeset-ua/dist/ua_transition_variable"
import { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IdleSubstateMachineType i=1009                              |
 * |isAbstract      |false                                                       |
 */
export interface UAIdleSubstateMachine_Base extends UAFiniteStateMachine_Base {
    gettingReady: UAState;
    gettingReadyToStandBy: UATransition;
    lastTransition: UATransitionVariable<LocalizedText>;
    lastTransitionReason: UAMultiStateValueDiscrete<Int16, DataType.Int16>;
    standBy: UAInitialState;
    standByToGettingReady: UATransition;
}
export interface UAIdleSubstateMachine extends Omit<UAFiniteStateMachine, "lastTransition">, UAIdleSubstateMachine_Base {
}