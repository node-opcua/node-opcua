import type { UInt32 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAMultiStateDictionaryEntryDiscreteBase, UAMultiStateDictionaryEntryDiscreteBase_Base } from "node-opcua-nodeset-ua/dist/ua_multi_state_dictionary_entry_discrete_base";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |MultiStateDiscreteSignalVariableType i=1142                 |
 * |dataType        |UInt32                                                      |
 * |dataType Name   |UInt32 i=7                                                  |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateDiscreteSignalVariable_Base<T extends UInt32>  extends UAMultiStateDictionaryEntryDiscreteBase_Base<T, DataType.UInt32> {
    actualValue?: UABaseDataVariable<UInt32, DataType.UInt32>;
    simulationValue?: UABaseDataVariable<UInt32, DataType.UInt32>;
    simulationState?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAMultiStateDiscreteSignalVariable<T extends UInt32> extends UAMultiStateDictionaryEntryDiscreteBase<T, DataType.UInt32>, UAMultiStateDiscreteSignalVariable_Base<T> {}