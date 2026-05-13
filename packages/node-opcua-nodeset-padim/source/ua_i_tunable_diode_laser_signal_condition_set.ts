import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ITunableDiodeLaserSignalConditionSetType i=1059             |
 * |isAbstract      |true                                                        |
 */
export interface UAITunableDiodeLaserSignalConditionSet_Base extends UABaseInterface_Base {
    absoluteSampleGasPressure?: UAAnalogUnit<number, DataType.Float>;
    laserTemperature?: UAAnalogUnit<number, DataType.Float>;
    sampleTemperature?: UAAnalogUnit<number, DataType.Float>;
    signalFitQuality?: UADataItem<number, DataType.Float>;
    signalNoiseRatio?: UADataItem<number, DataType.Float>;
    transmissionRatio?: UADataItem<number, DataType.Float>;
}
export interface UAITunableDiodeLaserSignalConditionSet extends UABaseInterface, UAITunableDiodeLaserSignalConditionSet_Base {}