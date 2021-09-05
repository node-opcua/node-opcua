// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAMultiStateValueDiscrete, UAMultiStateValueDiscrete_Base } from "./ua_multi_state_value_discrete"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |MultiStateDictionaryEntryDiscreteBaseType ns=0;i=19077|
 * |dataType        |Variant                                           |
 * |dataType Name   |Variant ns=0;i=26                                 |
 * |isAbstract      |false                                             |
 */
export interface UAMultiStateDictionaryEntryDiscreteBase_Base<T, DT extends DataType>  extends UAMultiStateValueDiscrete_Base<T/*g*/, DT> {
    enumDictionaryEntries: UAProperty<NodeId[], /*z*/DataType.NodeId>;
    valueAsDictionaryEntries?: UAProperty<NodeId[], /*z*/DataType.NodeId>;
}
export interface UAMultiStateDictionaryEntryDiscreteBase<T, DT extends DataType> extends UAMultiStateValueDiscrete<T, /*m*/DT>, UAMultiStateDictionaryEntryDiscreteBase_Base<T, DT /*A*/> {
}