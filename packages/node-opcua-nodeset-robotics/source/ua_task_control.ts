// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
import { EnumExecutionMode } from "./enum_execution_mode"
import { UATaskControlOperation } from "./ua_task_control_operation"
export interface UATaskControl_parameterSet extends UAObject { // Object
      /**
       * executionMode
       * Execution mode of the task control (continuous or
       * step-wise).
       */
      executionMode?: UABaseDataVariable<EnumExecutionMode, DataType.Int32>;
      /**
       * taskProgramLoaded
       * The TaskProgramLoaded variable is TRUE if a task
       * program is loaded in the task control, FALSE
       * otherwise.
       */
      taskProgramLoaded: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * taskProgramName
       * A customer given identifier for the task program.
       */
      taskProgramName: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * Represents a specific task control active on the
 * controller.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TaskControlType i=1011                                      |
 * |isAbstract      |false                                                       |
 */
export interface UATaskControl_Base extends UAComponent_Base {
    /**
     * componentName
     * A user writable name provided by the vendor,
     * integrator or user of the device.
     */
    componentName: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UATaskControl_parameterSet;
    taskControlOperation?: UATaskControlOperation;
    taskModules?: UAFolder;
}
export interface UATaskControl extends Omit<UAComponent, "componentName"|"parameterSet">, UATaskControl_Base {
}