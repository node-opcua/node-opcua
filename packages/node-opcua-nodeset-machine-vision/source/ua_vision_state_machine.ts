// ----- this file has been automatically generated - do not edit
import { UAMethod } from "node-opcua-address-space-base"
import { UAFiniteStateMachine, UAFiniteStateMachine_Base } from "node-opcua-nodeset-ua/dist/ua_finite_state_machine"
import { UAState } from "node-opcua-nodeset-ua/dist/ua_state"
import { UATransition } from "node-opcua-nodeset-ua/dist/ua_transition"
import { UAVisionAutomaticModeStateMachine } from "./ua_vision_automatic_mode_state_machine"
import { UAVisionStepModelStateMachine } from "./ua_vision_step_model_state_machine"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |VisionStateMachineType i=1017                               |
 * |isAbstract      |false                                                       |
 */
export interface UAVisionStateMachine_Base extends UAFiniteStateMachine_Base {
    automaticModeStateMachine?: UAVisionAutomaticModeStateMachine;
    confirmAll?: UAMethod;
    error: UAState;
    errorStepModel?: UAVisionStepModelStateMachine;
    errorToHalted: UATransition;
    errorToHaltedAuto: UATransition;
    errorToOperationalAuto: UATransition;
    errorToPreoperational: UATransition;
    errorToPreoperationalAuto: UATransition;
    halt: UAMethod;
    halted: UAState;
    haltedStepModel?: UAVisionStepModelStateMachine;
    haltedToPreoperational: UATransition;
    haltedToPreoperationalAuto: UATransition;
    operational: UAState;
    operationalToErrorAuto: UATransition;
    operationalToHalted: UATransition;
    operationalToHaltedAuto: UATransition;
    operationalToPreoperational: UATransition;
    operationalToPreoperationalAuto: UATransition;
    preoperational: UAState;
    preoperationalStepModel?: UAVisionStepModelStateMachine;
    preoperationalToErrorAuto: UATransition;
    preoperationalToHalted: UATransition;
    preoperationalToHaltedAuto: UATransition;
    preoperationalToInitialized: UATransition;
    preoperationalToInitializedAuto: UATransition;
    preoperationalToOperational: UATransition;
    preoperationalToOperationalAuto: UATransition;
    reset: UAMethod;
    selectModeAutomatic?: UAMethod;
}
export interface UAVisionStateMachine extends UAFiniteStateMachine, UAVisionStateMachine_Base {
}