// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAGuardVariable, UAGuardVariable_Base } from "./ua_guard_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ElseGuardVariableType ns=0;i=15317                |
 * |dataType        |LocalizedText                                     |
 * |dataType Name   |LocalizedText ns=0;i=21                           |
 * |isAbstract      |false                                             |
 */
export interface UAElseGuardVariable_Base<T extends LocalizedText/*j*/>  extends UAGuardVariable_Base<T/*h*/> {
}
export interface UAElseGuardVariable<T extends LocalizedText/*j*/> extends UAGuardVariable<T/*k*/>, UAElseGuardVariable_Base<T /*B*/> {
}