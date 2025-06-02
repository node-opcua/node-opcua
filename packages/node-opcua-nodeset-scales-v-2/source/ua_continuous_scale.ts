// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { EnumRateControlMode } from "./enum_rate_control_mode"
import { UAScaleDevice, UAScaleDevice_Base } from "./ua_scale_device"
import { UAMeasuredItem } from "./ua_measured_item"
import { UATotalizer } from "./ua_totalizer"
import { UAProductionPreset } from "./ua_production_preset"
/**
 * Represents a continuous scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ContinuousScaleType i=10                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAContinuousScale_Base extends UAScaleDevice_Base {
   // PlaceHolder for $Totalizer$
    controlMagnitude?: UAAnalogUnit<any, any>;
    /**
     * flowRate
     * Defines the conveying capacity in volume per time.
     */
    flowRate: UAMeasuredItem<any, any>;
    load?: UAAnalogUnit<any, any>;
    /**
     * masterTotalizer
     * Defines the overall volume that was conveyed over
     * the lifetime of the scale.
     */
    masterTotalizer?: UATotalizer;
    /**
     * maxFlowRate
     * Defines the maximum volume that may be conveyed.
     * Largest volume per time.
     */
    maxFlowRate?: UAAnalogUnit<any, any>;
    /**
     * minFlowRate
     * Defines the minimum volume that can be conveyed.
     * Smallest volume per time.
     */
    minFlowRate?: UAAnalogUnit<any, any>;
    /**
     * productionPreset
     * Contains the productions presets.
     */
    productionPreset?: UAProductionPreset;
    rateControlMode?: UABaseDataVariable<EnumRateControlMode, DataType.Int32>;
    speed?: UAAnalogUnit<any, any>;
    targetFlowRate?: UAAnalogUnit<any, any>;
}
export interface UAContinuousScale extends Omit<UAScaleDevice, "productionPreset">, UAContinuousScale_Base {
}