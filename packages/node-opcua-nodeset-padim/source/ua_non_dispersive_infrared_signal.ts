// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
import { UABaseAnalog } from "node-opcua-nodeset-ua/source/ua_base_analog"
import { UAAnalyticalSignal, UAAnalyticalSignal_Base } from "./ua_analytical_signal"
export interface UANonDispersiveInfraredSignal_signalConditionSet extends UAObject { // Object
      absoluteSampleGasPressure?: UAAnalogUnit<number, DataType.Float>;
      chopperFrequencyDeviation?: UABaseAnalog<number, DataType.Float>;
      sampleCellTemperature?: UAAnalogUnit<number, DataType.Float>;
      sourceResidualLife?: UAProperty<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |NonDispersiveInfraredSignalType i=1071                      |
 * |isAbstract      |false                                                       |
 */
export interface UANonDispersiveInfraredSignal_Base extends UAAnalyticalSignal_Base {
    signalConditionSet?: UANonDispersiveInfraredSignal_signalConditionSet;
}
export interface UANonDispersiveInfraredSignal extends Omit<UAAnalyticalSignal, "signalConditionSet">, UANonDispersiveInfraredSignal_Base {
}