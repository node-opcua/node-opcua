import type { UAMethod } from "node-opcua-address-space-base";
import type { UAMachineryOperationModeStateMachine, UAMachineryOperationModeStateMachine_Base } from "node-opcua-nodeset-machinery/dist/ua_machinery_operation_mode_state_machine";

// ----- this file has been automatically generated - do not edit

/**
 * State machine representing the operation mode of
 * a laboratory device. Optional methods allow for
 * initiating changes of the operation mode from
 * remote.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |LADSOperationModeStateMachineType i=1050                    |
 * |isAbstract      |false                                                       |
 */
export interface UALADSOperationModeStateMachine_Base extends UAMachineryOperationModeStateMachine_Base {
    gotoProcessing?: UAMethod;
    gotoMaintenance?: UAMethod;
    gotoSetup?: UAMethod;
}
export interface UALADSOperationModeStateMachine extends UAMachineryOperationModeStateMachine, UALADSOperationModeStateMachine_Base {}