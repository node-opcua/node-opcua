// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { DTContentFilter } from "./dt_content_filter"
import { UAGuardVariable, UAGuardVariable_Base } from "./ua_guard_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ExpressionGuardVariableType ns=0;i=15128          |
 * |dataType        |LocalizedText                                     |
 * |dataType Name   |LocalizedText ns=0;i=21                           |
 * |isAbstract      |false                                             |
 */
export interface UAExpressionGuardVariable_Base<T extends LocalizedText/*j*/>  extends UAGuardVariable_Base<T/*h*/> {
    expression: UAProperty<DTContentFilter, /*z*/DataType.ExtensionObject>;
}
export interface UAExpressionGuardVariable<T extends LocalizedText/*j*/> extends UAGuardVariable<T/*k*/>, UAExpressionGuardVariable_Base<T /*B*/> {
}