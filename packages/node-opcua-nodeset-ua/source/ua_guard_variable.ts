// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |GuardVariableType ns=0;i=15113                    |
 * |dataType        |LocalizedText                                     |
 * |dataType Name   |LocalizedText ns=0;i=21                           |
 * |isAbstract      |false                                             |
 */
export interface UAGuardVariable_Base<T extends LocalizedText/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.LocalizedText> {
}
export interface UAGuardVariable<T extends LocalizedText/*j*/> extends UABaseDataVariable<T, /*n*/DataType.LocalizedText>, UAGuardVariable_Base<T /*B*/> {
}