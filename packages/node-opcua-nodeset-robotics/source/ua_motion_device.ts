// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
import { UALoad } from "./ua_load"
import { EnumMotionDeviceCategory } from "./enum_motion_device_category"
export interface UAMotionDevice_parameterSet extends UAObject { // Object
      /**
       * inControl
       * InControl provides the information if the
       * actuators (in most cases a motor) of the motion
       * device are powered up and in control: "true". The
       * motion device might be in a standstill.
       */
      inControl?: UABaseDataVariable<boolean, DataType.Boolean>;
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
      onPath?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * speedOverride
       * SpeedOverride provides the current speed setting
       * in percent of programmed speed (0 - 100%).
       */
      speedOverride: UABaseDataVariable<number, DataType.Double>;
}
/**
 * Represents a specific motion device in the motion
 * device system like a robot, a linear unit or a
 * positioner. A MotionDevice should have at least
 * one axis.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MotionDeviceType i=1004                                     |
 * |isAbstract      |false                                                       |
 */
export interface UAMotionDevice_Base extends UAComponent_Base {
    /**
     * additionalComponents
     * AdditionalComponents is a container for one or
     * more instances of subtypes of ComponentType
     * defined in OPC UA DI. The listed components are
     * installed at the motion device, e.g. an IO-board.
     */
    additionalComponents?: UAFolder;
    assetId?: UAProperty<UAString, DataType.String>;
    /**
     * axes
     * Axes is a container for one or more instances of
     * the AxisType.
     */
    axes: UAFolder;
    componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
    deviceManual?: UAProperty<UAString, DataType.String>;
    /**
     * flangeLoad
     * The FlangeLoad is the load on the flange or at
     * the mounting point of the MotionDevice. This can
     * be the maximum load of the MotionDevice.
     */
    flangeLoad?: UALoad;
    manufacturer: UAProperty<LocalizedText, DataType.LocalizedText>;
    model: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * motionDeviceCategory
     * The variable MotionDeviceCategory provides the
     * kind of motion device defined by
     * MotionDeviceCategoryEnumeration based on ISO 8373.
     */
    motionDeviceCategory: UAProperty<EnumMotionDeviceCategory, DataType.Int32>;
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAMotionDevice_parameterSet;
    /**
     * powerTrains
     * PowerTrains is a container for one or more
     * instances of the PowerTrainType.
     */
    powerTrains: UAFolder;
    productCode: UAProperty<UAString, DataType.String>;
    serialNumber: UAProperty<UAString, DataType.String>;
    taskControlReference?: UABaseDataVariable<NodeId, DataType.NodeId>;
}
export interface UAMotionDevice extends Omit<UAComponent, "assetId"|"componentName"|"deviceManual"|"manufacturer"|"model"|"parameterSet"|"productCode"|"serialNumber">, UAMotionDevice_Base {
}