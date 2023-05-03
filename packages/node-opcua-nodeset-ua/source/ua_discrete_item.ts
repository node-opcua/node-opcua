// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { UADataItem, UADataItem_Base } from "./ua_data_item"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |DiscreteItemType i=2372                                     |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions i=0                                          |
 * |isAbstract      |true                                                        |
 */
export type UADiscreteItem_Base<T, DT extends DataType> = UADataItem_Base<T, DT>;
export interface UADiscreteItem<T, DT extends DataType> extends UADataItem<T, DT>, UADiscreteItem_Base<T, DT> {
}