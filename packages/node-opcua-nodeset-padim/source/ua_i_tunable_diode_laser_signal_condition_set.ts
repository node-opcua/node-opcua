// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item"
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
export interface UAITunableDiodeLaserSignalConditionSet extends UABaseInterface, UAITunableDiodeLaserSignalConditionSet_Base {
}