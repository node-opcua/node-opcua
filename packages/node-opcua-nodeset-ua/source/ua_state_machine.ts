// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAStateVariable } from "./ua_state_variable"
import { UATransitionVariable } from "./ua_transition_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |StateMachineType ns=0;i=2299                      |
 * |isAbstract      |false                                             |
 */
export interface UAStateMachine_Base {
    currentState: UAStateVariable<LocalizedText>;
    lastTransition?: UATransitionVariable<LocalizedText>;
}
export interface UAStateMachine extends UAObject, UAStateMachine_Base {
}