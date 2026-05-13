import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |DataTypeDescriptionType i=69                                |
 * |dataType        |String                                                      |
 * |dataType Name   |UAString i=12                                               |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UADataTypeDescription_Base<T extends UAString>  extends UABaseDataVariable_Base<T, DataType.String> {
    dataTypeVersion?: UAProperty<UAString, DataType.String>;
    dictionaryFragment?: UAProperty<Buffer, DataType.ByteString>;
}
export interface UADataTypeDescription<T extends UAString> extends UABaseDataVariable<T, DataType.String>, UADataTypeDescription_Base<T> {}