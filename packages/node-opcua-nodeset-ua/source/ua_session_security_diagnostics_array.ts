// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSessionSecurityDiagnostics } from "./dt_session_security_diagnostics"
import { UASessionSecurityDiagnostics } from "./ua_session_security_diagnostics"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |SessionSecurityDiagnosticsArrayType ns=0;i=2243   |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTSessionSecurityDiagnostics[] ns=0;i=868         |
 * |isAbstract      |false                                             |
 */
export interface UASessionSecurityDiagnosticsArray_Base<T extends DTSessionSecurityDiagnostics[]/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    sessionSecurityDiagnostics: UASessionSecurityDiagnostics<DTSessionSecurityDiagnostics>;
}
export interface UASessionSecurityDiagnosticsArray<T extends DTSessionSecurityDiagnostics[]/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UASessionSecurityDiagnosticsArray_Base<T /*B*/> {
}