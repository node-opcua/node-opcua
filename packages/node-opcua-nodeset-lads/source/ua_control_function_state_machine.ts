import type { UAMethod } from "node-opcua-address-space-base";

import type { UAFunctionalStateMachine, UAFunctionalStateMachine_Base } from "./ua_functional_state_machine";

// ----- this file has been automatically generated - do not edit

/**
 * Represents the state of a Function in a LADS
 * Device
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ControlFunctionStateMachineType i=1044                      |
 * |isAbstract      |false                                                       |
 */
export interface UAControlFunctionStateMachine_Base extends UAFunctionalStateMachine_Base {
    startWithTargetValue?: UAMethod;
    start?: UAMethod;
}
export interface UAControlFunctionStateMachine extends UAFunctionalStateMachine, UAControlFunctionStateMachine_Base {}