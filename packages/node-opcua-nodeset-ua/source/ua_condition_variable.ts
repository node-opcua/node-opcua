// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ConditionVariableType ns=0;i=9002                 |
 * |dataType        |Null                                              |
 * |dataType Name   |VariantOptions ns=0;i=0                           |
 * |isAbstract      |false                                             |
 */
export interface UAConditionVariable_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    sourceTimestamp: UAProperty<Date, DataType.DateTime>;
}
export interface UAConditionVariable<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAConditionVariable_Base<T, DT> {
}