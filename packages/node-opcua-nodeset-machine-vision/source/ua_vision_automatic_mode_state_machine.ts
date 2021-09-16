// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/source/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/source/ua_transition"
import { UAVisionStepModelStateMachine } from "./ua_vision_step_model_state_machine"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:VisionAutomaticModeStateMachineType ns=4;i=1021 |
 * |isAbstract      |false                                             |
 */
export interface UAVisionAutomaticModeStateMachine_Base extends UAFiniteStateMachine_Base {
    abort: UAMethod;
    continuousExecution: UAState;
    continuousExecutionStepModel?: UAVisionStepModelStateMachine;
    continuousExecutionToReadyAbort: UATransition;
    continuousExecutionToReadyAuto: UATransition;
    continuousExecutionToReadyStop: UATransition;
    initialized: UAState;
    initializedStepModel?: UAVisionStepModelStateMachine;
    initializedToReadyAuto: UATransition;
    initializedToReadyProduct: UATransition;
    initializedToReadyRecipe: UATransition;
    ready: UAState;
    readyStepModel?: UAVisionStepModelStateMachine;
    readyToContinuousExecution: UATransition;
    readyToContinuousExecutionAuto: UATransition;
    readyToInitializedAuto: UATransition;
    readyToInitializedProduct: UATransition;
    readyToInitializedRecipe: UATransition;
    readyToSingleExecution: UATransition;
    readyToSingleExecutionAuto: UATransition;
    simulationMode?: UAMethod;
    singleExecution: UAState;
    singleExecutionStepModel?: UAVisionStepModelStateMachine;
    singleExecutionToReadyAbort: UATransition;
    singleExecutionToReadyAuto: UATransition;
    singleExecutionToReadyStop: UATransition;
    startContinuous: UAMethod;
    startSingleJob: UAMethod;
    stop: UAMethod;
}
export interface UAVisionAutomaticModeStateMachine extends UAFiniteStateMachine, UAVisionAutomaticModeStateMachine_Base {
}