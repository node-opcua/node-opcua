// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAMultiStateValueDiscrete, UAMultiStateValueDiscrete_Base } from "./ua_multi_state_value_discrete"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |MultiStateDictionaryEntryDiscreteBaseType i=19077           |
 * |dataType        |Variant                                                     |
 * |dataType Name   |number i=26                                                 |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateDictionaryEntryDiscreteBase_Base<T, DT extends DataType>  extends UAMultiStateValueDiscrete_Base<T, DT> {
    enumDictionaryEntries: UAProperty<NodeId[], DataType.NodeId>;
    valueAsDictionaryEntries?: UAProperty<NodeId[], DataType.NodeId>;
}
export interface UAMultiStateDictionaryEntryDiscreteBase<T, DT extends DataType> extends UAMultiStateValueDiscrete<T, DT>, UAMultiStateDictionaryEntryDiscreteBase_Base<T, DT> {
}