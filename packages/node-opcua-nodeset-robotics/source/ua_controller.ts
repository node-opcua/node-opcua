// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UAFileDirectory } from "node-opcua-nodeset-ua/dist/ua_file_directory"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
import { UAUser } from "./ua_user"
import { UASystemOperation } from "./ua_system_operation"
export interface UAController_parameterSet extends UAObject { // Object
      /**
       * cabinetFanSpeed
       * The speed of the cabinet fan.
       */
      cabinetFanSpeed?: UAAnalogUnit<number, DataType.Double>;
      /**
       * cpUFanSpeed
       * The speed of the CPU fan.
       */
      cpUFanSpeed?: UAAnalogUnit<number, DataType.Double>;
      /**
       * inputVoltage
       * The input voltage of the controller which can be
       * a configured value. To distinguish between an AC
       * or DC supply the optional property Definition of
       * the base type DataItemType shall be used.
       */
      inputVoltage?: UAAnalogUnit<number, DataType.Double>;
      /**
       * startUpTime
       * The date and time of the last start-up of the
       * controller.
       */
      startUpTime?: UABaseDataVariable<Date, DataType.DateTime>;
      /**
       * temperature
       * The controller temperature given by a temperature
       * sensor inside of the controller.
       */
      temperature?: UAAnalogUnit<number, DataType.Double>;
      /**
       * totalEnergyConsumption
       * The total accumulated energy consumed by the
       * motion devices related with this controller
       * instance.
       */
      totalEnergyConsumption?: UAAnalogUnit<number, DataType.Double>;
      /**
       * totalPowerOnTime
       * The total accumulated time the controller was
       * powered on.
       */
      totalPowerOnTime?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * upsState
       * The vendor specific status of an integrated UPS
       * or accumulator system.
       */
      upsState?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * The ControllerType describes the control unit of
 * motion devices. One motion device system can have
 * one or more instances of the ControllerType.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ControllerType i=1003                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAController_Base extends UAComponent_Base {
    assetId?: UAProperty<UAString, DataType.String>;
    componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * components
     * Components is a container for one or more
     * instances of subtypes of ComponentType defined in
     * OPC UA DI. The listed components are installed in
     * the motion device system, e.g. a processing-unit,
     * a power-supply, an IO-board or a drive, and have
     * an electrical interface to the controller.
     */
    components?: UAFolder;
    /**
     * currentUser
     * The current user of the system.
     */
    currentUser: UAUser;
    deviceManual?: UAProperty<UAString, DataType.String>;
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    model: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet?: UAController_parameterSet;
    productCode: UAProperty<UAString, DataType.String>;
    programs?: UAFileDirectory;
    serialNumber: UAProperty<UAString, DataType.String>;
    /**
     * software
     * Software is a container for one or more instances
     * of SoftwareType defined in OPC UA DI.
     */
    software: UAFolder;
    systemOperation?: UASystemOperation;
    /**
     * taskControls
     * TaskControls is a container for one or more
     * instances of TaskControlType.
     */
    taskControls: UAFolder;
}
export interface UAController extends Omit<UAComponent, "assetId"|"componentName"|"deviceManual"|"manufacturer"|"model"|"parameterSet"|"productCode"|"serialNumber">, UAController_Base {
}