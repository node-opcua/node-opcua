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
 * |typedDefinition |DataTypeDictionaryType i=72                                 |
 * |dataType        |ByteString                                                  |
 * |dataType Name   |Buffer i=15                                                 |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UADataTypeDictionary_Base<T extends Buffer>  extends UABaseDataVariable_Base<T, DataType.ByteString> {
    dataTypeVersion?: UAProperty<UAString, DataType.String>;
    "$namespaceUri"?: UAProperty<UAString, DataType.String>;
    deprecated?: UAProperty<boolean, DataType.Boolean>;
}
export interface UADataTypeDictionary<T extends Buffer> extends UABaseDataVariable<T, DataType.ByteString>, UADataTypeDictionary_Base<T> {}