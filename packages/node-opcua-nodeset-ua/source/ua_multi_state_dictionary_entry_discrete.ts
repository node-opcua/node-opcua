// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAMultiStateDictionaryEntryDiscreteBase, UAMultiStateDictionaryEntryDiscreteBase_Base } from "./ua_multi_state_dictionary_entry_discrete_base"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |MultiStateDictionaryEntryDiscreteType i=19084               |
 * |dataType        |Variant                                                     |
 * |dataType Name   |Variant i=26                                                |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateDictionaryEntryDiscrete_Base<T, DT extends DataType>  extends UAMultiStateDictionaryEntryDiscreteBase_Base<T, DT> {
    valueAsDictionaryEntries: UAProperty<NodeId[], DataType.NodeId>;
}
export interface UAMultiStateDictionaryEntryDiscrete<T, DT extends DataType> extends Omit<UAMultiStateDictionaryEntryDiscreteBase<T, DT>, "valueAsDictionaryEntries">, UAMultiStateDictionaryEntryDiscrete_Base<T, DT> {
}