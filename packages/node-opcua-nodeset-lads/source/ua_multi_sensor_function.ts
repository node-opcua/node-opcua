import type { UABaseSensorFunction, UABaseSensorFunction_Base } from "./ua_base_sensor_function";
import type { UAFunction_functionSet } from "./ua_function";

// ----- this file has been automatically generated - do not edit

/**
 * The MultiSensorFunction represents complex
 * detectors with multiple sensors targeting a
 * specific measurement task, e.g. diode array
 * detector of a HPLC system. The specific sensor
 * elements are represented by sensor-functions in
 * the FunctionSet.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MultiSensorFunctionType i=1051                              |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiSensorFunction_Base extends UABaseSensorFunction_Base {
    /**
     * functionSet
     * The FunctionSetType is used for organising
     * FunctionType objects in an unordered list
     * structure.
     */
    functionSet: UAFunction_functionSet;
}
export interface UAMultiSensorFunction extends Omit<UABaseSensorFunction, "functionSet">, UAMultiSensorFunction_Base {}