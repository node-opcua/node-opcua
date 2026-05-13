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
 * |typedDefinition |IPhCalibrationType i=1046                                   |
 * |isAbstract      |true                                                        |
 */
export interface UAIPhCalibration_Base extends UABaseInterface_Base {
    sensorAsymmetryPotential?: UAAnalogUnit<number, DataType.Float>;
    sensorSlope?: UAAnalogUnit<number, DataType.Float>;
    sensorT90?: UAProperty<number, DataType.Float>;
}
export interface UAIPhCalibration extends UABaseInterface, UAIPhCalibration_Base {}