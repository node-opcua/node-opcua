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

import type { UAExecutingSubstateMachine } from "./ua_executing_substate_machine";
import type { UAIdleSubstateMachine } from "./ua_idle_substate_machine";
import type { UAOperationStateMachine, UAOperationStateMachine_Base } from "./ua_operation_state_machine";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SystemOperationStateMachineType i=1021                      |
 * |isAbstract      |false                                                       |
 */
export interface UASystemOperationStateMachine_Base extends UAOperationStateMachine_Base {
    configuredDefaultStopMode?: UABaseDataVariable<Int16, DataType.Int16>;
    executing: UAState;
    executingSubstateMachine?: UAExecutingSubstateMachine;
    executingToIdle: UATransition;
    executingToReady: UATransition;
    getReady?: UAMethod;
    idle: UAState;
    idleSubstateMachine?: UAIdleSubstateMachine;
    idleToIdle: UATransition;
    idleToReady: UATransition;
    lastTransition: UATransitionVariable<LocalizedText>;
    lastTransitionReason: UAMultiStateValueDiscrete<Int16, DataType.Int16>;
    possibleStopModes?: UABaseDataVariable<DTEnumValue[], DataType.ExtensionObject>;
    ready: UAState;
    readyToExecuting: UATransition;
    readyToIdle: UATransition;
    standDown?: UAMethod;
    start?: UAMethod;
    stop?: UAMethod;
}
export interface UASystemOperationStateMachine extends Omit<UAOperationStateMachine, "configuredDefaultStopMode"|"executing"|"executingToIdle"|"executingToReady"|"idle"|"idleToIdle"|"idleToReady"|"lastTransition"|"lastTransitionReason"|"possibleStopModes"|"ready"|"readyToExecuting"|"readyToIdle"|"start"|"stop">, UASystemOperationStateMachine_Base {}