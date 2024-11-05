// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UABaseAnalog } from "node-opcua-nodeset-ua/source/ua_base_analog"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |INonDispersiveInfraredSignalConditionSetType i=1055         |
 * |isAbstract      |true                                                        |
 */
export interface UAINonDispersiveInfraredSignalConditionSet_Base extends UABaseInterface_Base {
    absoluteSampleGasPressure?: UAAnalogUnit<number, DataType.Float>;
    chopperFrequencyDeviation?: UABaseAnalog<number, DataType.Float>;
    sampleCellTemperature?: UAAnalogUnit<number, DataType.Float>;
    sourceResidualLife?: UAProperty<number, DataType.Float>;
}
export interface UAINonDispersiveInfraredSignalConditionSet extends UABaseInterface, UAINonDispersiveInfraredSignalConditionSet_Base {
}