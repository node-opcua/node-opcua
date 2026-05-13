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
 * |typedDefinition |IGasChromatographCalibrationType i=1094                     |
 * |isAbstract      |true                                                        |
 */
export interface UAIGasChromatographCalibration_Base extends UABaseInterface_Base {
    calibrationRange1ResponseFactor?: UAProperty<number, DataType.Float>;
    calibrationRange1LowerRangeValue?: UAAnalogUnit<number, DataType.Float>;
    calibrationRange1UpperRangeValue?: UAAnalogUnit<number, DataType.Float>;
    calibrationRange2ResponseFactor?: UAProperty<number, DataType.Float>;
    calibrationRange2LowerRangeValue?: UAAnalogUnit<number, DataType.Float>;
    calibrationRange2UpperRangeValue?: UAAnalogUnit<number, DataType.Float>;
    calibrationRange3ResponseFactor?: UAProperty<number, DataType.Float>;
    calibrationRange3LowerRangeValue?: UAAnalogUnit<number, DataType.Float>;
    calibrationRange3UpperRangeValue?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIGasChromatographCalibration extends UABaseInterface, UAIGasChromatographCalibration_Base {}