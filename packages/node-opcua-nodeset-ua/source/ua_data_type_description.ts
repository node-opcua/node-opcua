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
 * |typedDefinition |DataTypeDescriptionType ns=0;i=69                 |
 * |dataType        |String                                            |
 * |dataType Name   |UAString ns=0;i=12                                |
 * |isAbstract      |false                                             |
 */
export interface UADataTypeDescription_Base<T extends UAString/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.String> {
    dataTypeVersion?: UAProperty<UAString, /*z*/DataType.String>;
    dictionaryFragment?: UAProperty<Buffer, /*z*/DataType.ByteString>;
}
export interface UADataTypeDescription<T extends UAString/*j*/> extends UABaseDataVariable<T, /*n*/DataType.String>, UADataTypeDescription_Base<T /*B*/> {
}