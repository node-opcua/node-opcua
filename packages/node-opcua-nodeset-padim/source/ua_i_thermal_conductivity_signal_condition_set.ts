// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IThermalConductivitySignalConditionSetType i=1058           |
 * |isAbstract      |true                                                        |
 */
export interface UAIThermalConductivitySignalConditionSet_Base extends UABaseInterface_Base {
    sampleTemperature?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIThermalConductivitySignalConditionSet extends UABaseInterface, UAIThermalConductivitySignalConditionSet_Base {
}