// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IZirconiumDioxideSignalConditionSetType i=1060              |
 * |isAbstract      |true                                                        |
 */
export interface UAIZirconiumDioxideSignalConditionSet_Base extends UABaseInterface_Base {
    relativeHeatOutput?: UAAnalogUnit<number, DataType.Float>;
    sampleGasVolumeFlow?: UAAnalogUnit<number, DataType.Float>;
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
    sensingElementResidualLife?: UAProperty<number, DataType.Float>;
    cellResistance?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIZirconiumDioxideSignalConditionSet extends UABaseInterface, UAIZirconiumDioxideSignalConditionSet_Base {
}