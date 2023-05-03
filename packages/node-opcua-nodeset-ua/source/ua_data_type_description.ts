// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |DataTypeDescriptionType i=69                                |
 * |dataType        |String                                                      |
 * |dataType Name   |UAString i=12                                               |
 * |isAbstract      |false                                                       |
 */
export interface UADataTypeDescription_Base<T extends UAString>  extends UABaseDataVariable_Base<T, DataType.String> {
    dataTypeVersion?: UAProperty<UAString, DataType.String>;
    dictionaryFragment?: UAProperty<Buffer, DataType.ByteString>;
}
export interface UADataTypeDescription<T extends UAString> extends UABaseDataVariable<T, DataType.String>, UADataTypeDescription_Base<T> {
}