import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { DataType } from "node-opcua-variant";

import type { UAAnalogScalarSensorFunction, UAAnalogScalarSensorFunction_Base } from "./ua_analog_scalar_sensor_function";

// ----- this file has been automatically generated - do not edit

/**
 * The
 * AnalogScalarSensorFunctionWithCompensationType
 * represents a compensated  analogue measured value
 * (e.g. pH sensor, dissolved oxygen sensor, ..)
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogScalarSensorFunctionWithCompensationType i=1000       |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogScalarSensorFunctionWithCompensation_Base extends UAAnalogScalarSensorFunction_Base {
    /**
     * compensationValue
     * CompensationValue is the compensation value used
     * while calculating the process value, such as the
     * temperature at the Sensor element for pH or DO
     * Sensors.
     */
    compensationValue: UAAnalogUnitRange<number, DataType.Double>;
}
export interface UAAnalogScalarSensorFunctionWithCompensation extends UAAnalogScalarSensorFunction, UAAnalogScalarSensorFunctionWithCompensation_Base {}