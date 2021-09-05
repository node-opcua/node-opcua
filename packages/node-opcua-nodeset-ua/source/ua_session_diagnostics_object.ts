// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTSessionDiagnostics } from "./dt_session_diagnostics"
import { UASessionDiagnosticsVariable } from "./ua_session_diagnostics_variable"
import { DTSessionSecurityDiagnostics } from "./dt_session_security_diagnostics"
import { UASessionSecurityDiagnostics } from "./ua_session_security_diagnostics"
import { DTSubscriptionDiagnostics } from "./dt_subscription_diagnostics"
import { UASubscriptionDiagnosticsArray } from "./ua_subscription_diagnostics_array"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |SessionDiagnosticsObjectType ns=0;i=2029          |
 * |isAbstract      |false                                             |
 */
export interface UASessionDiagnosticsObject_Base {
    sessionDiagnostics: UASessionDiagnosticsVariable<DTSessionDiagnostics>;
    sessionSecurityDiagnostics: UASessionSecurityDiagnostics<DTSessionSecurityDiagnostics>;
    subscriptionDiagnosticsArray: UASubscriptionDiagnosticsArray<DTSubscriptionDiagnostics[]>;
}
export interface UASessionDiagnosticsObject extends UAObject, UASessionDiagnosticsObject_Base {
}