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
 * |typedDefinition |DataItemType i=2365                                         |
 * |dataType        |Null                                                        |
 * |dataType Name   |(VariantOptions | VariantOptions[]) i=0                     |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UADataItem_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    definition?: UAProperty<UAString, DataType.String>;
    valuePrecision?: UAProperty<number, DataType.Double>;
}
export interface UADataItem<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UADataItem_Base<T, DT> {}