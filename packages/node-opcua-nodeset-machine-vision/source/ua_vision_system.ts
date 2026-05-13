import type { UAMethod, UAObject } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAFiniteStateVariable } from "node-opcua-nodeset-ua/dist/ua_finite_state_variable";
import type { UAState } from "node-opcua-nodeset-ua/dist/ua_state";
import type { DataType } from "node-opcua-variant";

import type { DTSystemStateDescription } from "./dt_system_state_description";
import type { UAConfigurationManagement } from "./ua_configuration_management";
import type { UARecipeManagement } from "./ua_recipe_management";
import type { UAResultManagement } from "./ua_result_management";
import type { UASafetyStateManagement } from "./ua_safety_state_management";
import type { UAVisionAutomaticModeStateMachine } from "./ua_vision_automatic_mode_state_machine";
import type { UAVisionStateMachine } from "./ua_vision_state_machine";
import type { UAVisionStepModelStateMachine } from "./ua_vision_step_model_state_machine";

// ----- this file has been automatically generated - do not edit

export interface UAVisionSystem_visionStateMachine extends Omit<UAVisionStateMachine, "automaticModeStateMachine"|"confirmAll"|"currentState"|"error"|"errorStepModel"|"halt"|"halted"|"haltedStepModel"|"operational"|"preoperational"|"preoperationalStepModel"|"reset"|"selectModeAutomatic"> { // Object
      automaticModeStateMachine?: UAVisionAutomaticModeStateMachine;
      confirmAll?: UAMethod;
      currentState: UAFiniteStateVariable<LocalizedText>;
      error: UAState;
      errorStepModel?: UAVisionStepModelStateMachine;
      halt: UAMethod;
      halted: UAState;
      haltedStepModel?: UAVisionStepModelStateMachine;
      operational: UAState;
      preoperational: UAState;
      preoperationalStepModel?: UAVisionStepModelStateMachine;
      reset: UAMethod;
      selectModeAutomatic?: UAMethod;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |VisionSystemType i=1003                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAVisionSystem_Base {
    configurationManagement?: UAConfigurationManagement;
    diagnosticLevel?: UABaseDataVariable<UInt16, DataType.UInt16>;
    recipeManagement?: UARecipeManagement;
    resultManagement?: UAResultManagement;
    safetyStateManagement?: UASafetyStateManagement;
    systemState?: UABaseDataVariable<DTSystemStateDescription, DataType.ExtensionObject>;
    visionStateMachine: UAVisionSystem_visionStateMachine;
}
export interface UAVisionSystem extends UAObject, UAVisionSystem_Base {}