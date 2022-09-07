// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |DataItemType ns=0;i=2365                          |
 * |dataType        |Null                                              |
 * |dataType Name   |VariantOptions ns=0;i=0                           |
 * |isAbstract      |false                                             |
 */
export interface UADataItem_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    definition?: UAProperty<UAString, DataType.String>;
    valuePrecision?: UAProperty<number, DataType.Double>;
}
export interface UADataItem<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UADataItem_Base<T, DT> {
}