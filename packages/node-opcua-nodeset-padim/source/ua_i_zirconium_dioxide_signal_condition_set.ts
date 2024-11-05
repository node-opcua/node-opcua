// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IZirconiumDioxideSignalConditionSetType i=1060              |
 * |isAbstract      |true                                                        |
 */
export interface UAIZirconiumDioxideSignalConditionSet_Base extends UABaseInterface_Base {
    relativeHeatOutput?: UADataItem<number, DataType.Float>;
    sampleGasVolumeFlow?: UAAnalogUnit<number, DataType.Float>;
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIZirconiumDioxideSignalConditionSet extends UABaseInterface, UAIZirconiumDioxideSignalConditionSet_Base {
}