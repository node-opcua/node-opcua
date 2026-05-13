import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseAnalog } from "node-opcua-nodeset-ua/dist/ua_base_analog";
import type { DataType } from "node-opcua-variant";

import type { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal";

// ----- this file has been automatically generated - do not edit

export interface UATocSignal_signalConditionSet extends UAObject { // Object
      absoluteSampleGasPressure?: UAAnalogUnit<number, DataType.Float>;
      chopperFrequencyDeviation?: UABaseAnalog<number, DataType.Float>;
      detectorZeroSignal?: UAAnalogUnit<number, DataType.Float>;
      relativeReagentLevel?: UAAnalogUnit<(number | number[]), DataType.Float>;
      sampleCellTemperature?: UAAnalogUnit<number, DataType.Float>;
      sampleGasVolumeFlow?: UAAnalogUnit<number, DataType.Float>;
      sourceResidualLife?: UAProperty<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TocSignalType i=1078                                        |
 * |isAbstract      |false                                                       |
 */
export interface UATocSignal_Base extends UAAnalyticalSignal_Base {
    signalConditionSet?: UATocSignal_signalConditionSet;
}
export interface UATocSignal extends Omit<UAAnalyticalSignal, "signalConditionSet">, UATocSignal_Base {}