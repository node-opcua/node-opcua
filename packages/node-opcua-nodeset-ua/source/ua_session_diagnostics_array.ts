import type { DataType } from "node-opcua-variant";

import type { DTSessionDiagnostics } from "./dt_session_diagnostics";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable";
import type { UASessionDiagnosticsVariable } from "./ua_session_diagnostics_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |SessionDiagnosticsArrayType i=2196                          |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTSessionDiagnostics[] i=865                                |
 * |value rank      |1                                                           |
 * |isAbstract      |false                                                       |
 */
export interface UASessionDiagnosticsArray_Base<T extends DTSessionDiagnostics[]>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    sessionDiagnostics: UASessionDiagnosticsVariable<DTSessionDiagnostics>;
}
export interface UASessionDiagnosticsArray<T extends DTSessionDiagnostics[]> extends UABaseDataVariable<T, DataType.ExtensionObject>, UASessionDiagnosticsArray_Base<T> {}