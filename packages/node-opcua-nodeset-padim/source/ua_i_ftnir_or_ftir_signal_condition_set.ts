// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface"
import { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IFtnirOrFtirSignalConditionSetType i=1112                   |
 * |isAbstract      |true                                                        |
 */
export interface UAIFtnirOrFtirSignalConditionSet_Base extends UABaseInterface_Base {
    transmissionRatio?: UADataItem<number, DataType.Float>;
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
    mahalanobisDistance?: UAProperty<number, DataType.Float>;
    spectralResidual?: UAProperty<number, DataType.Float>;
    electronicsReadNoise?: UAProperty<number, DataType.Float>;
    laserResidualLife?: UAProperty<number, DataType.Float>;
}
export interface UAIFtnirOrFtirSignalConditionSet extends UABaseInterface, UAIFtnirOrFtirSignalConditionSet_Base {
}