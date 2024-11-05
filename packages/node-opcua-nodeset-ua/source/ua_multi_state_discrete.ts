// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UADiscreteItem, UADiscreteItem_Base } from "./ua_discrete_item"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |MultiStateDiscreteType i=2376                               |
 * |dataType        |Variant                                                     |
 * |dataType Name   |(number | number[]) i=28                                    |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateDiscrete_Base<T, DT extends DataType>  extends UADiscreteItem_Base<T, DT> {
    enumStrings: UAProperty<LocalizedText[], DataType.LocalizedText>;
}
export interface UAMultiStateDiscrete<T, DT extends DataType> extends UADiscreteItem<T, DT>, UAMultiStateDiscrete_Base<T, DT> {
}