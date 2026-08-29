import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTSessionDiagnostics } from "./dt_session_diagnostics.js";
import type { DTSessionSecurityDiagnostics } from "./dt_session_security_diagnostics.js";
import type { DTSubscriptionDiagnostics } from "./dt_subscription_diagnostics.js";
import type { UASessionDiagnosticsVariable } from "./ua_session_diagnostics_variable.js";
import type { UASessionSecurityDiagnostics } from "./ua_session_security_diagnostics.js";
import type { UASubscriptionDiagnosticsArray } from "./ua_subscription_diagnostics_array.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SessionDiagnosticsObjectType i=2029                         |
 * |isAbstract      |false                                                       |
 */
export interface UASessionDiagnosticsObject_Base {
    sessionDiagnostics: UASessionDiagnosticsVariable<DTSessionDiagnostics>;
    sessionSecurityDiagnostics: UASessionSecurityDiagnostics<DTSessionSecurityDiagnostics>;
    subscriptionDiagnosticsArray: UASubscriptionDiagnosticsArray<DTSubscriptionDiagnostics[]>;
    currentRoleIds?: UAProperty<NodeId[], DataType.NodeId>;
}
export interface UASessionDiagnosticsObject extends UAObject, UASessionDiagnosticsObject_Base {}