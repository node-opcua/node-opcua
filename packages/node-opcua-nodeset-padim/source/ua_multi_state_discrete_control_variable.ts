// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_dictionary_entry_discrete"
import { UAMultiStateDiscreteSignalVariable, UAMultiStateDiscreteSignalVariable_Base } from "./ua_multi_state_discrete_signal_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |MultiStateDiscreteControlVariableType i=1219                |
 * |dataType        |UInt32                                                      |
 * |dataType Name   |UInt32 i=7                                                  |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateDiscreteControlVariable_Base<T extends UInt32>  extends UAMultiStateDiscreteSignalVariable_Base<T> {
    setpoint: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
    operatingDirection?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
    faultState?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
}
export interface UAMultiStateDiscreteControlVariable<T extends UInt32> extends UAMultiStateDiscreteSignalVariable<T>, UAMultiStateDiscreteControlVariable_Base<T> {
}