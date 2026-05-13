import type { UAProperty } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IAmperometricCalibrationType i=1048                         |
 * |isAbstract      |true                                                        |
 */
export interface UAIAmperometricCalibration_Base extends UABaseInterface_Base {
    amperometricSensorSlope?: UAAnalogUnit<number, DataType.Float>;
    amperometricSensorZeroPoint?: UAAnalogUnit<number, DataType.Float>;
    absoluteAirPressure?: UAAnalogUnit<number, DataType.Float>;
    sensorT90?: UAProperty<number, DataType.Float>;
}
export interface UAIAmperometricCalibration extends UABaseInterface, UAIAmperometricCalibration_Base {}