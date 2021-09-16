// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/source/ua_component"
import { UALoad } from "./ua_load"
export interface UAMotionDevice_parameterSet extends UAObject { // Object
      /**
       * onPath
       * OnPath is true if the motion device is on or near
       * enough the planned program path such that program
       * execution can continue. If the MotionDevice
       * deviates too much from this path in case of
       * errors or an emergency stop, this value becomes
       * false. If OnPath is false, the motion device
       * needs repositioning to continue program execution.
       */
      onPath?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
      /**
       * inControl
       * InControl provides the information if the
       * actuators (in most cases a motor) of the motion
       * device are powered up and in control: "true". The
       * motion device might be in a standstill.
       */
      inControl?: UABaseDataVariable<boolean, /*z*/DataType.Boolean>;
      /**
       * speedOverride
       * SpeedOverride provides the current speed setting
       * in percent of programmed speed (0 - 100%).
       */
      speedOverride: UABaseDataVariable<number, /*z*/DataType.Double>;
}
/**
 * Represents a specific motion device in the motion
 * device system like a robot, a linear unit or a
 * positioner. A MotionDevice should have at least
 * one axis.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:MotionDeviceType ns=7;i=1004                    |
 * |isAbstract      |false                                             |
 */
export interface UAMotionDevice_Base extends UAComponent_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAMotionDevice_parameterSet;
    manufacturer: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    model: UAProperty<LocalizedText, /*z*/DataType.LocalizedText>;
    productCode: UAProperty<UAString, /*z*/DataType.String>;
    serialNumber: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * motionDeviceCategory
     * The variable MotionDeviceCategory provides the
     * kind of motion device defined by
     * MotionDeviceCategoryEnumeration based on ISO 8373.
     */
    motionDeviceCategory: UAProperty<any, any>;
    /**
     * axes
     * Axes is a container for one or more instances of
     * the AxisType.
     */
    axes: UAFolder;
    /**
     * powerTrains
     * PowerTrains is a container for one or more
     * instances of the PowerTrainType.
     */
    powerTrains: UAFolder;
    /**
     * flangeLoad
     * The FlangeLoad is the load on the flange or at
     * the mounting point of the MotionDevice. This can
     * be the maximum load of the MotionDevice.
     */
    flangeLoad?: UALoad;
    /**
     * additionalComponents
     * AdditionalComponents is a container for one or
     * more instances of subtypes of ComponentType
     * defined in OPC UA DI. The listed components are
     * installed at the motion device, e.g. an IO-board.
     */
    additionalComponents?: UAFolder;
}
export interface UAMotionDevice extends Omit<UAComponent, "parameterSet"|"manufacturer"|"model"|"productCode"|"serialNumber">, UAMotionDevice_Base {
}