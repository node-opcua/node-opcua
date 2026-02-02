// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int16 } from "node-opcua-basic-types"
import { DTEnumValue } from "node-opcua-nodeset-ua/dist/dt_enum_value"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UATransitionVariable } from "node-opcua-nodeset-ua/dist/ua_transition_variable"
import { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete"
import { UAOperationStateMachine, UAOperationStateMachine_Base } from "./ua_operation_state_machine"
import { UAReadySubstateMachine } from "./ua_ready_substate_machine"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TaskControlStateMachineType i=1025                          |
 * |isAbstract      |false                                                       |
 */
export interface UATaskControlStateMachine_Base extends UAOperationStateMachine_Base {
    configuredDefaultStopMode?: UABaseDataVariable<Int16, DataType.Int16>;
    executing: UAState;
    executingToIdle: UATransition;
    executingToReady: UATransition;
    idle: UAState;
    idleToIdle: UATransition;
    idleToReady: UATransition;
    lastTransition: UATransitionVariable<LocalizedText>;
    lastTransitionReason: UAMultiStateValueDiscrete<Int16, DataType.Int16>;
    loadByName?: UAMethod;
    loadByNodeId?: UAMethod;
    possibleStopModes?: UABaseDataVariable<DTEnumValue[], DataType.ExtensionObject>;
    ready: UAState;
    readySubstateMachine?: UAReadySubstateMachine;
    readyToExecuting: UATransition;
    readyToIdle: UATransition;
    start?: UAMethod;
    stop?: UAMethod;
    unloadByName?: UAMethod;
    unloadByNodeId?: UAMethod;
    unloadProgram?: UAMethod;
}
export interface UATaskControlStateMachine extends Omit<UAOperationStateMachine, "configuredDefaultStopMode"|"executing"|"executingToIdle"|"executingToReady"|"idle"|"idleToIdle"|"idleToReady"|"lastTransition"|"lastTransitionReason"|"possibleStopModes"|"ready"|"readyToExecuting"|"readyToIdle"|"start"|"stop">, UATaskControlStateMachine_Base {
}