import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ConditionVariableType i=9002                                |
 * |dataType        |Null                                                        |
 * |dataType Name   |(VariantOptions | VariantOptions[]) i=0                     |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAConditionVariable_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    sourceTimestamp: UAProperty<Date, DataType.DateTime>;
}
export interface UAConditionVariable<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAConditionVariable_Base<T, DT> {}