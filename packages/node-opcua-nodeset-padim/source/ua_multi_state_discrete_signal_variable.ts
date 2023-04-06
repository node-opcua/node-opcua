// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UAMultiStateDictionaryEntryDiscreteBase, UAMultiStateDictionaryEntryDiscreteBase_Base } from "node-opcua-nodeset-ua/source/ua_multi_state_dictionary_entry_discrete_base"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |20:MultiStateDiscreteSignalVariableType ns=20;i=1142|
 * |dataType        |UInt32                                            |
 * |dataType Name   |UInt32 ns=0;i=7                                   |
 * |isAbstract      |false                                             |
 */
export interface UAMultiStateDiscreteSignalVariable_Base<T extends UInt32>  extends UAMultiStateDictionaryEntryDiscreteBase_Base<T, DataType.UInt32> {
    actualValue?: UABaseDataVariable<UInt32, DataType.UInt32>;
    simulationValue?: UABaseDataVariable<UInt32, DataType.UInt32>;
    simulationState?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAMultiStateDiscreteSignalVariable<T extends UInt32> extends UAMultiStateDictionaryEntryDiscreteBase<T, DataType.UInt32>, UAMultiStateDiscreteSignalVariable_Base<T> {
}