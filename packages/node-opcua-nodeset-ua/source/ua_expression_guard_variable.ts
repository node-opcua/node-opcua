// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { DTContentFilter } from "./dt_content_filter"
import { UAGuardVariable, UAGuardVariable_Base } from "./ua_guard_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ExpressionGuardVariableType i=15128                         |
 * |dataType        |LocalizedText                                               |
 * |dataType Name   |LocalizedText i=21                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAExpressionGuardVariable_Base<T extends LocalizedText>  extends UAGuardVariable_Base<T> {
    expression: UAProperty<DTContentFilter, DataType.ExtensionObject>;
}
export interface UAExpressionGuardVariable<T extends LocalizedText> extends UAGuardVariable<T>, UAExpressionGuardVariable_Base<T> {
}