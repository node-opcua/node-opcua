// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component"
import { EnumAxisMotionProfile } from "./enum_axis_motion_profile"
import { UALoad } from "./ua_load"
export interface UAAxis_parameterSet extends UAObject { // Object
      /**
       * actualAcceleration
       * : The ActualAcceleration variable provides the
       * axis acceleration. Applicable acceleration limits
       * of the axis shall be provided by the EURange
       * property of the AnalogUnitType.
       */
      actualAcceleration?: UAAnalogUnit<number, DataType.Double>;
      /**
       * actualPosition
       * The axis position inclusive Unit and
       * RangeOfMotion.
       */
      actualPosition: UAAnalogUnit<number, DataType.Double>;
      /**
       * actualSpeed
       * The axis speed on load side (after gear/spindle)
       * inclusive Unit.
       */
      actualSpeed?: UAAnalogUnit<number, DataType.Double>;
}
/**
 * The AxisType describes an axis of a motion device.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AxisType i=16601                                            |
 * |isAbstract      |false                                                       |
 */
export interface UAAxis_Base extends UAComponent_Base {
    /**
     * additionalLoad
     * The additional load which is mounted on this
     * axis. E.g. for process-need a transformer for
     * welding.
     */
    additionalLoad?: UALoad;
    assetId?: UAProperty<UAString, DataType.String>;
    /**
     * motionProfile
     * The kind of axis motion as defined with the
     * AxisMotionProfileEnumeration.
     */
    motionProfile: UAProperty<EnumAxisMotionProfile, DataType.Int32>;
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet: UAAxis_parameterSet;
}
export interface UAAxis extends Omit<UAComponent, "assetId"|"parameterSet">, UAAxis_Base {
}