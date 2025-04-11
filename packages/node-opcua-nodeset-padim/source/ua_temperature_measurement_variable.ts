// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_dictionary_entry_discrete"
import { UAAnalogSignalVariable, UAAnalogSignalVariable_Base } from "./ua_analog_signal_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TemperatureMeasurementVariableType i=1120                   |
 * |dataType        |Float                                                       |
 * |dataType Name   |(number | number[]) i=10                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATemperatureMeasurementVariable_Base<T extends (number | number[])>  extends UAAnalogSignalVariable_Base<T, DataType.Float> {
    sensorType: UAMultiStateDictionaryEntryDiscrete<(UInt32 | UInt32[]), DataType.UInt32>;
    sensorConnection?: UAMultiStateDictionaryEntryDiscrete<(UInt32 | UInt32[]), DataType.UInt32>;
    sensorReference?: UAMultiStateDictionaryEntryDiscrete<(UInt32 | UInt32[]), DataType.UInt32>;
    sensorClass?: UAMultiStateDictionaryEntryDiscrete<(UInt32 | UInt32[]), DataType.UInt32>;
}
export interface UATemperatureMeasurementVariable<T extends (number | number[])> extends UAAnalogSignalVariable<T, DataType.Float>, UATemperatureMeasurementVariable_Base<T> {
}