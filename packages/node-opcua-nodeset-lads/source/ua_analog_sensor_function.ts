import type { UAProperty } from "node-opcua-address-space-base";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAExclusiveLevelAlarm } from "node-opcua-nodeset-ua/dist/ua_exclusive_level_alarm";
import type { DataType } from "node-opcua-variant";

import type { UABaseSensorFunction, UABaseSensorFunction_Base } from "./ua_base_sensor_function";

// ----- this file has been automatically generated - do not edit

export interface UAAnalogSensorFunction_operational extends UAFunctionalGroup { // Object
      /**
       * sensorValue
       * SensorValue is the calibrated and optionally
       * compensated/filtered process value.
       */
      sensorValue: UAAnalogUnitRange<(number | number[]), DataType.Double>;
}
export interface UAAnalogSensorFunction_calibration extends UAFunctionalGroup { // Object
      /**
       * calibrationValues
       * CalibrationValues is an array of calibration
       * values for converting the Sensor’s raw value to
       * the process value.
       */
      calibrationValues?: UABaseDataVariable<number[], DataType.Double>;
}
export interface UAAnalogSensorFunction_tuning extends UAFunctionalGroup { // Object
      /**
       * damping
       * Damping is a low-pass filter parameter used for
       * signal damping.
       */
      damping?: UAProperty<number, DataType.Double>;
}
/**
 * The AnalogSensorFunctionType is a abstract
 * subtype of the BaseSensorFunctionType which
 * represents an analogue measured value. This is an
 * extension point for all analogue measured values
 * without built-in compensation on the Sensor.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AnalogSensorFunctionType i=1046                             |
 * |isAbstract      |true                                                        |
 */
export interface UAAnalogSensorFunction_Base extends UABaseSensorFunction_Base {
    /**
     * alarmMonitor
     * AlarmMonitor indicates whether the limit of an
     * analogue Sensor is exceeded. See: 10000-9: Alarms
     * & Conditions | ExclusiveLevelAlarmType.
     */
    alarmMonitor?: UAExclusiveLevelAlarm;
    /**
     * operational
     * Used to organize parameters for operation of this
     * function.
     */
    operational: UAAnalogSensorFunction_operational;
    /**
     * calibrationValues
     * CalibrationValues is an array of calibration
     * values for converting the Sensor’s raw value to
     * the process value.
     */
    calibrationValues?: UABaseDataVariable<number[], DataType.Double>;
    /**
     * damping
     * Damping is a low-pass filter parameter used for
     * signal damping.
     */
    damping?: UAProperty<number, DataType.Double>;
    /**
     * calibration
     * Calibration is used to organize parameters for
     * configuration of this Function
     */
    calibration?: UAAnalogSensorFunction_calibration;
    /**
     * tuning
     * Tuning is used to organize parameters for
     * operation of this Function.
     */
    tuning?: UAAnalogSensorFunction_tuning;
    /**
     * rawValue
     * RawValue is the raw value measured at the Sensor
     * element, such as the Nernst voltage of a pH
     * Sensor element.
     */
    rawValue: UAAnalogUnitRange<(number | number[]), DataType.Double>;
    /**
     * sensorValue
     * SensorValue is the calibrated and optionally
     * compensated/filtered process value.
     */
    sensorValue: UAAnalogUnitRange<(number | number[]), DataType.Double>;
}
export interface UAAnalogSensorFunction extends UABaseSensorFunction, UAAnalogSensorFunction_Base {}