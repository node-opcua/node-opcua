import type { UAProperty } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseAnalog } from "node-opcua-nodeset-ua/dist/ua_base_analog";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
export interface UAITocSignalConditionSet extends UABaseInterface, UAITocSignalConditionSet_Base {}