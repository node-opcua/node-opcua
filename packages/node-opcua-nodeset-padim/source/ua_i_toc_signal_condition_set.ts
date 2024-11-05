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
 * |typedDefinition |ITocSignalConditionSetType i=1056                           |
 * |isAbstract      |true                                                        |
 */
export interface UAITocSignalConditionSet_Base extends UABaseInterface_Base {
    absoluteSampleGasPressure?: UAAnalogUnit<number, DataType.Float>;
    chopperFrequencyDeviation?: UABaseAnalog<number, DataType.Float>;
    sampleCellTemperature?: UAAnalogUnit<number, DataType.Float>;
    detectorZeroSignal?: UAAnalogUnit<number, DataType.Float>;
    sourceResidualLife?: UAProperty<number, DataType.Float>;
    relativeReagentLevel?: UAAnalogUnit<(number | number[]), DataType.Float>;
    sampleGasVolumeFlow?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAITocSignalConditionSet extends UABaseInterface, UAITocSignalConditionSet_Base {
}