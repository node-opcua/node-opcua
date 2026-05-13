import type { DataType } from "node-opcua-variant";

import type { DTSessionSecurityDiagnostics } from "./dt_session_security_diagnostics";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";
import type { UASessionSecurityDiagnostics } from "./ua_session_security_diagnostics";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |SessionSecurityDiagnosticsArrayType i=2243                  |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTSessionSecurityDiagnostics[] i=868                        |
 * |value rank      |1                                                           |
 * |isAbstract      |false                                                       |
 */
export interface UASessionSecurityDiagnosticsArray_Base<T extends DTSessionSecurityDiagnostics[]>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    sessionSecurityDiagnostics: UASessionSecurityDiagnostics<DTSessionSecurityDiagnostics>;
}
export interface UASessionSecurityDiagnosticsArray<T extends DTSessionSecurityDiagnostics[]> extends UABaseDataVariable<T, DataType.ExtensionObject>, UASessionSecurityDiagnosticsArray_Base<T> {}