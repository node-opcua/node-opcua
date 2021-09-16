// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/source/ua_component"
import { UALoad } from "./ua_load"
export interface UAAxis_parameterSet extends UAObject { // Object
      /**
       * actualPosition
       * The axis position inclusive Unit and
       * RangeOfMotion.
       */
      actualPosition: UAAnalogUnit<number, /*z*/DataType.Double>;
      /**
       * actualSpeed
       * The axis speed on load side (after gear/spindle)
       * inclusive Unit.
       */
      actualSpeed?: UAAnalogUnit<number, /*z*/DataType.Double>;
      /**
       * actualAcceleration
       * : The ActualAcceleration variable provides the
       * axis acceleration. Applicable acceleration limits
       * of the axis shall be provided by the EURange
       * property of the AnalogUnitType.
       */
      actualAcceleration?: UAAnalogUnit<number, /*z*/DataType.Double>;
}
/**
 * The AxisType describes an axis of a motion device.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/             |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |7:AxisType ns=7;i=16601                           |
 * |isAbstract      |false                                             |
 */
export interface UAAxis_Base extends UAComponent_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAAxis_parameterSet;
    /**
     * motionProfile
     * The kind of axis motion as defined with the
     * AxisMotionProfileEnumeration.
     */
    motionProfile: UAProperty<any, any>;
    /**
     * additionalLoad
     * The additional load which is mounted on this
     * axis. E.g. for process-need a transformer for
     * welding.
     */
    additionalLoad?: UALoad;
}
export interface UAAxis extends Omit<UAComponent, "parameterSet">, UAAxis_Base {
}