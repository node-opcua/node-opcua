// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAInitialState } from "node-opcua-nodeset-ua/dist/ua_initial_state"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConfirmationStateMachineType i=307                          |
 * |isAbstract      |false                                                       |
 */
export interface UAConfirmationStateMachine_Base extends UAFiniteStateMachine_Base {
    confirm: UAMethod;
    confirmationTimeout: UABaseDataVariable<number, DataType.Double>;
    notWaitingForConfirm: UAInitialState;
    waitingForConfirm: UAState;
    notWaitingForConfirmToWaitingForConfirm: UATransition;
    waitingForConfirmToNotWaitingForConfirm: UATransition;
}
export interface UAConfirmationStateMachine extends UAFiniteStateMachine, UAConfirmationStateMachine_Base {
}