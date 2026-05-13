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
 * |typedDefinition |IOpticalFluorescenseQuenchingCalibrationType i=1049         |
 * |isAbstract      |true                                                        |
 */
export interface UAIOpticalFluorescenseQuenchingCalibration_Base extends UABaseInterface_Base {
    absoluteAirPressure?: UAAnalogUnit<number, DataType.Float>;
    opticalFluorescenseQuenchingSensorSlope?: UAAnalogUnit<number, DataType.Float>;
    opticalFluorescenseQuenchingSensorZeroPoint?: UAAnalogUnit<number, DataType.Float>;
    sensorT90?: UAProperty<number, DataType.Float>;
}
export interface UAIOpticalFluorescenseQuenchingCalibration extends UABaseInterface, UAIOpticalFluorescenseQuenchingCalibration_Base {}