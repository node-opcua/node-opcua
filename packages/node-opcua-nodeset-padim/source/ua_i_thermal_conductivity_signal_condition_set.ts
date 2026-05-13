import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
export interface UAIThermalConductivitySignalConditionSet extends UABaseInterface, UAIThermalConductivitySignalConditionSet_Base {}