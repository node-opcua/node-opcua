// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt16, UAString } from "node-opcua-basic-types"
import { UAFiniteStateVariable } from "node-opcua-nodeset-ua/source/ua_finite_state_variable"
import { UAState } from "node-opcua-nodeset-ua/source/ua_state"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTConfiguration } from "./dt_configuration"
import { DTSystemStateDescription } from "./dt_system_state_description"
import { UAVisionStateMachine } from "./ua_vision_state_machine"
import { UAVisionAutomaticModeStateMachine } from "./ua_vision_automatic_mode_state_machine"
import { UAVisionStepModelStateMachine } from "./ua_vision_step_model_state_machine"
import { UAConfigurationManagement } from "./ua_configuration_management"
import { UARecipeManagement } from "./ua_recipe_management"
import { UAResultManagement } from "./ua_result_management"
import { UASafetyStateManagement } from "./ua_safety_state_management"
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
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:VisionSystemType ns=4;i=1003                    |
 * |isAbstract      |false                                             |
 */
export interface UAVisionSystem_Base {
    configurationManagement?: UAConfigurationManagement;
    diagnosticLevel?: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
    recipeManagement?: UARecipeManagement;
    resultManagement?: UAResultManagement;
    safetyStateManagement?: UASafetyStateManagement;
    systemState?: UABaseDataVariable<DTSystemStateDescription, /*z*/DataType.ExtensionObject>;
    visionStateMachine: UAVisionSystem_visionStateMachine;
}
export interface UAVisionSystem extends UAObject, UAVisionSystem_Base {
}