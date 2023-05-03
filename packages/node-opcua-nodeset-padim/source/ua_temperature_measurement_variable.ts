// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { DTEnumValue } from "node-opcua-nodeset-ua/source/dt_enum_value"
import { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_dictionary_entry_discrete"
import { UAAnalogSignalVariable, UAAnalogSignalVariable_Base } from "./ua_analog_signal_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TemperatureMeasurementVariableType i=1120                   |
 * |dataType        |Float                                                       |
 * |dataType Name   |number i=10                                                 |
 * |isAbstract      |false                                                       |
 */
export interface UATemperatureMeasurementVariable_Base<T extends number>  extends UAAnalogSignalVariable_Base<T, DataType.Float> {
    sensorType: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
    sensorConnection?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
    sensorReference?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
}
export interface UATemperatureMeasurementVariable<T extends number> extends UAAnalogSignalVariable<T, DataType.Float>, UATemperatureMeasurementVariable_Base<T> {
}