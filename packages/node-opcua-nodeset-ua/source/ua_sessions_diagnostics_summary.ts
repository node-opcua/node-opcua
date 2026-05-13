import type { UAObject } from "node-opcua-address-space-base";

import type { DTSessionDiagnostics } from "./dt_session_diagnostics";
import type { DTSessionSecurityDiagnostics } from "./dt_session_security_diagnostics";
import type { UASessionDiagnosticsArray } from "./ua_session_diagnostics_array";
import type { UASessionSecurityDiagnosticsArray } from "./ua_session_security_diagnostics_array";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SessionsDiagnosticsSummaryType i=2026                       |
 * |isAbstract      |false                                                       |
 */
export interface UASessionsDiagnosticsSummary_Base {
    sessionDiagnosticsArray: UASessionDiagnosticsArray<DTSessionDiagnostics[]>;
    sessionSecurityDiagnosticsArray: UASessionSecurityDiagnosticsArray<DTSessionSecurityDiagnostics[]>;
   // PlaceHolder for $ClientName$
}
export interface UASessionsDiagnosticsSummary extends UAObject, UASessionsDiagnosticsSummary_Base {}