import type { UAMethod } from "node-opcua-address-space-base";
import type { Int16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DTEnumValue } from "node-opcua-nodeset-ua/dist/dt_enum_value";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition";
import type { UATransitionVariable } from "node-opcua-nodeset-ua/dist/ua_transition_variable";
import type { DataType } from "node-opcua-variant";

import type { UAOperationStateMachine, UAOperationStateMachine_Base } from "./ua_operation_state_machine";
import type { UAReadySubstateMachine } from "./ua_ready_substate_machine";

// ----- this file has been automatically generated - do not edit

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
export interface UATaskControlStateMachine extends Omit<UAOperationStateMachine, "configuredDefaultStopMode"|"executing"|"executingToIdle"|"executingToReady"|"idle"|"idleToIdle"|"idleToReady"|"lastTransition"|"lastTransitionReason"|"possibleStopModes"|"ready"|"readyToExecuting"|"readyToIdle"|"start"|"stop">, UATaskControlStateMachine_Base {}