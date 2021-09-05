// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSessionDiagnostics } from "./dt_session_diagnostics"
import { UASessionDiagnosticsVariable } from "./ua_session_diagnostics_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |SessionDiagnosticsArrayType ns=0;i=2196           |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTSessionDiagnostics[] ns=0;i=865                 |
 * |isAbstract      |false                                             |
 */
export interface UASessionDiagnosticsArray_Base<T extends DTSessionDiagnostics[]/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    sessionDiagnostics: UASessionDiagnosticsVariable<DTSessionDiagnostics>;
}
export interface UASessionDiagnosticsArray<T extends DTSessionDiagnostics[]/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UASessionDiagnosticsArray_Base<T /*B*/> {
}