// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { DTEnumValue } from "node-opcua-nodeset-ua/source/dt_enum_value"
import { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_dictionary_entry_discrete"
import { UAAnalogSignalVariable, UAAnalogSignalVariable_Base } from "./ua_analog_signal_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |20:FlowMeasurementVariableType ns=20;i=1122       |
 * |dataType        |Float                                             |
 * |dataType Name   |number ns=0;i=10                                  |
 * |isAbstract      |false                                             |
 */
export interface UAFlowMeasurementVariable_Base<T extends number>  extends UAAnalogSignalVariable_Base<T, DataType.Float> {
    lowFlowCutOff: UAProperty<number, DataType.Float>;
    flowDirection?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
}
export interface UAFlowMeasurementVariable<T extends number> extends UAAnalogSignalVariable<T, DataType.Float>, UAFlowMeasurementVariable_Base<T> {
}