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
 * |typedDefinition |DataTypeDictionaryType ns=0;i=72                  |
 * |dataType        |ByteString                                        |
 * |dataType Name   |Buffer ns=0;i=15                                  |
 * |isAbstract      |false                                             |
 */
export interface UADataTypeDictionary_Base<T extends Buffer/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ByteString> {
    dataTypeVersion?: UAProperty<UAString, /*z*/DataType.String>;
    "$namespaceUri"?: UAProperty<UAString, /*z*/DataType.String>;
    deprecated?: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UADataTypeDictionary<T extends Buffer/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ByteString>, UADataTypeDictionary_Base<T /*B*/> {
}