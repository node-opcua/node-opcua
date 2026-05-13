import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IOpticalFluorescenseQuenchingSignalConditionSetType i=1063  |
 * |isAbstract      |true                                                        |
 */
export interface UAIOpticalFluorescenseQuenchingSignalConditionSet_Base extends UABaseInterface_Base {
    sensorCleaningsCounter?: UAProperty<UInt32, DataType.UInt32>;
    sensorNextCalibration?: UAAnalogUnit<UInt32, DataType.UInt32>;
    sensorSterilisationsCounter?: UAProperty<UInt32, DataType.UInt32>;
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIOpticalFluorescenseQuenchingSignalConditionSet extends UABaseInterface, UAIOpticalFluorescenseQuenchingSignalConditionSet_Base {}