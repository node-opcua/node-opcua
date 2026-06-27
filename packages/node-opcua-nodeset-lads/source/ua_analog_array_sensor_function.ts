import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { DataType } from "node-opcua-variant";

import type { UAAnalogSensorFunction, UAAnalogSensorFunction_Base } from "./ua_analog_sensor_function";

// ----- this file has been automatically generated - do not edit

/**
 * The AnalogArraySensorFunctionType is a concrete
 * subtype of the AnalogSensorFunctionType which
 * represents an array of analogue measured values.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogArraySensorFunctionType i=1015                        |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogArraySensorFunction_Base extends UAAnalogSensorFunction_Base {
    /**
     * sensorValue
     * SensorValue is the calibrated and optionally
     * compensated/filtered array of measurement values.
     */
    sensorValue: UAAnalogUnitRange<number[], DataType.Double>;
    /**
     * rawValue
     * RawValue is the raw value measured at the sensor
     * array, such as the electrical current of
     * plate-reader photo-detectors.
     */
    rawValue: UAAnalogUnitRange<number[], DataType.Double>;
}
export interface UAAnalogArraySensorFunction extends Omit<UAAnalogSensorFunction, "sensorValue"|"rawValue">, UAAnalogArraySensorFunction_Base {}