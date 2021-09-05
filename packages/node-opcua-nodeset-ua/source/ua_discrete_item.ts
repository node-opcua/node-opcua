// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UADataItem, UADataItem_Base } from "./ua_data_item"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |DiscreteItemType ns=0;i=2372                      |
 * |dataType        |Null                                              |
 * |dataType Name   |undefined ns=0;i=0                                |
 * |isAbstract      |true                                              |
 */
export interface UADiscreteItem_Base<T, DT extends DataType>  extends UADataItem_Base<T/*g*/, DT> {
}
export interface UADiscreteItem<T, DT extends DataType> extends UADataItem<T, /*m*/DT>, UADiscreteItem_Base<T, DT /*A*/> {
}