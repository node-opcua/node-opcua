// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { DTEnumValue } from "./dt_enum_value"
import { UADiscreteItem, UADiscreteItem_Base } from "./ua_discrete_item"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |MultiStateValueDiscreteType i=11238                         |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=26                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateValueDiscrete_Base<T, DT extends DataType>  extends UADiscreteItem_Base<T, DT> {
    enumValues: UAProperty<DTEnumValue[], DataType.ExtensionObject>;
    valueAsText: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAMultiStateValueDiscrete<T, DT extends DataType> extends UADiscreteItem<T, DT>, UAMultiStateValueDiscrete_Base<T, DT> {
}