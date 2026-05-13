import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UAAnalogUnitRange, UAAnalogUnitRange_Base } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * Define the desired value of the Variable it
 * belongs to.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/ProcessValues/        |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ProcessValueSetpointVariableType i=2003                     |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAProcessValueSetpointVariable_Base<T, DT extends DataType>  extends UAAnalogUnitRange_Base<T, DT> {
    /**
     * autoDeviationAdjustment
     * Defines if the deviation variables are
     * automatically adjusted.
     */
    autoDeviationAdjustment?: UAProperty<boolean, DataType.Boolean>;
    /**
     * deviationSensitivity
     * Indicates the sensitivity of the deviation
     * variables when automatically set.
     */
    deviationSensitivity?: UAMultiStateValueDiscrete<UInt16, DataType.UInt16>;
    /**
     * highDeviation
     * Defines the high limit for deviation, relative to
     * the process value setpoint.
     */
    highDeviation?: UAAnalogUnit<any, any>;
    /**
     * highHighDeviation
     * Defines the high high limit for deviation,
     * relative to the process value setpoint.
     */
    highHighDeviation?: UAAnalogUnit<any, any>;
    /**
     * lowDeviation
     * Defines the low limit for deviation, relative to
     * the process value setpoint.
     */
    lowDeviation?: UAAnalogUnit<any, any>;
    /**
     * lowLowDeviation
     * Defines the low low limit for deviation, relative
     * to the process value setpoint.
     */
    lowLowDeviation?: UAAnalogUnit<any, any>;
    /**
     * substituteValue
     * Value that should be used when the process value
     * setpoint cannot be controlled anymore.
     */
    substituteValue?: UABaseDataVariable<any, any>;
}
export interface UAProcessValueSetpointVariable<T, DT extends DataType> extends UAAnalogUnitRange<T, DT>, UAProcessValueSetpointVariable_Base<T, DT> {}