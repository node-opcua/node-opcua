// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/source/ua_component"
import { UAUser } from "./ua_user"
export interface UAController_parameterSet extends UAObject { // Object
      /**
       * totalPowerOnTime
       * The total accumulated time the controller was
       * powered on.
       */
      totalPowerOnTime?: UABaseDataVariable<UAString, /*z*/DataType.String>;
      /**
       * startUpTime
       * The date and time of the last start-up of the
       * controller.
       */
      startUpTime?: UABaseDataVariable<Date, /*z*/DataType.DateTime>;
      /**
       * upsState
       * The vendor specific status of an integrated UPS
       * or accumulator system.
       */
      upsState?: UABaseDataVariable<UAString, /*z*/DataType.String>;
      /**
       * totalEnergyConsumption
       * The total accumulated energy consumed by the
       * motion devices related with this controller
       * instance.
       */
      totalEnergyConsumption?: UAAnalogUnit<number, /*z*/DataType.Double>;
      /**
       * cabinetFanSpeed
       * The speed of the cabinet fan.
       */
      cabinetFanSpeed?: UAAnalogUnit<number, /*z*/DataType.Double>;
      /**
       * cpUFanSpeed
       * The speed of the CPU fan.
       */
      cpUFanSpeed?: UAAnalogUnit<number, /*z*/DataType.Double>;
      /**
       * inputVoltage
       * The input voltage of the controller which can be
       * a configured value. To distinguish between an AC
       * or DC supply the optional property Definition of
       * the base type DataItemType shall be used.
       */
      inputVoltage?: UAAnalogUnit<number, /*z*/DataType.Double>;
      /**
       * temperature
       * The controller temperature given by a temperature
       * sensor inside of the controller.
       */
      temperature?: UAAnalogUnit<number, /*z*/DataType.Double>;
}
/**
 * The ControllerType describes the control unit of
 * motion devices. One motion device system can have
 * one or more instances of the ControllerType.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:ControllerType ns=7;i=1003                      |
 * |isAbstract      |false                                             |
 */
export interface UAController_Base extends UAComponent_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet?: UAController_parameterSet;
    manufacturer: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    model: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    productCode: UAProperty<UAString, /*z*/DataType.String>;
    serialNumber: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * currentUser
     * The given name of the device.
     */
    currentUser: UAUser;
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
     * software
     * Software is a container for one or more instances
     * of SoftwareType defined in OPC UA DI.
     */
    software: UAFolder;
    /**
     * taskControls
     * TaskControls is a container for one or more
     * instances of TaskControlType.
     */
    taskControls: UAFolder;
}
export interface UAController extends Omit<UAComponent, "parameterSet"|"manufacturer"|"model"|"productCode"|"serialNumber">, UAController_Base {
}