import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { DataType } from "node-opcua-variant";

import type { UAAnalogSensorFunction, UAAnalogSensorFunction_Base, UAAnalogSensorFunction_operational } from "./ua_analog_sensor_function";

// ----- this file has been automatically generated - do not edit

export interface UAAnalogScalarSensorFunction_operational extends UAAnalogSensorFunction_operational { // Object
      /**
       * sensorValue
       * SensorValue is the calibrated and optionally
       * compensated/filtered process value.
       */
      sensorValue: UAAnalogUnitRange<number, DataType.Double>;
      /**
       * rawValue
       * RawValue is the raw value measured at the Sensor
       * element, such as the Nernst voltage of a pH
       * Sensor element.
       */
      rawValue: UAAnalogUnitRange<number, DataType.Double>;
}
/**
 * The AnalogScalarSensorFunctionType is a concrete
 * subtype of the AnalogSensorFunctionType which
 * represents an analogue measured value.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogScalarSensorFunctionType i=1016                       |
 * |isAbstract      |false                                                       |
 */
export interface UAAnalogScalarSensorFunction_Base extends UAAnalogSensorFunction_Base {
    /**
     * operational
     * Used to organize parameters for operation of this
     * function.
     */
    operational: UAAnalogScalarSensorFunction_operational;
    /**
     * sensorValue
     * SensorValue is the calibrated and optionally
     * compensated/filtered process value.
     */
    sensorValue: UAAnalogUnitRange<number, DataType.Double>;
    /**
     * rawValue
     * RawValue is the raw value measured at the Sensor
     * element, such as the Nernst voltage of a pH
     * Sensor element.
     */
    rawValue: UAAnalogUnitRange<number, DataType.Double>;
}
export interface UAAnalogScalarSensorFunction extends Omit<UAAnalogSensorFunction, "operational"|"sensorValue"|"rawValue">, UAAnalogScalarSensorFunction_Base {}