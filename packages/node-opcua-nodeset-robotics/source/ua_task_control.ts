// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/source/ua_component"
export interface UATaskControl_parameterSet extends UAObject { // Object
      /**
       * taskProgramName
       * A customer given identifier for the task program.
       */
      taskProgramName: UABaseDataVariable<UAString, /*z*/DataType.String>;
      /**
       * taskProgramLoaded
       * The TaskProgramLoaded variable is TRUE if a task
       * program is loaded in the task control, FALSE
       * otherwise.
       */
      taskProgramLoaded: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
      /**
       * executionMode
       * Execution mode of the task control (continuous or
       * step-wise).
       */
      executionMode?: UABaseDataVariable<any, any>;
}
/**
 * Represents a specific task control active on the
 * controller.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:TaskControlType ns=7;i=1011                     |
 * |isAbstract      |false                                             |
 */
export interface UATaskControl_Base extends UAComponent_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UATaskControl_parameterSet;
    /**
     * componentName
     * A user writable name provided by the vendor,
     * integrator or user of the device.
     */
    componentName: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
}
export interface UATaskControl extends Omit<UAComponent, "parameterSet"|"componentName">, UATaskControl_Base {
}