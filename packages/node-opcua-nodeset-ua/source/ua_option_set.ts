// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |OptionSetType i=11487                                       |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions i=0                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAOptionSet_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    optionSetValues: UAProperty<LocalizedText[], DataType.LocalizedText>;
    bitMask?: UAProperty<boolean[], DataType.Boolean>;
}
export interface UAOptionSet<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAOptionSet_Base<T, DT> {
}