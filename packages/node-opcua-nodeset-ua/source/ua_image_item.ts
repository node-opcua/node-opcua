// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { DTAxisInformation } from "./dt_axis_information"
import { UAArrayItem, UAArrayItem_Base } from "./ua_array_item"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ImageItemType ns=0;i=12047                        |
 * |dataType        |Null                                              |
 * |dataType Name   |VariantOptions[] ns=0;i=0                         |
 * |isAbstract      |false                                             |
 */
export interface UAImageItem_Base<T, DT extends DataType>  extends UAArrayItem_Base<T, DT> {
    xAxisDefinition: UAProperty<DTAxisInformation, DataType.ExtensionObject>;
    yAxisDefinition: UAProperty<DTAxisInformation, DataType.ExtensionObject>;
}
export interface UAImageItem<T, DT extends DataType> extends UAArrayItem<T, DT>, UAImageItem_Base<T, DT> {
}