import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTSessionDiagnostics } from "./dt_session_diagnostics";
import type { DTSessionSecurityDiagnostics } from "./dt_session_security_diagnostics";
import type { DTSubscriptionDiagnostics } from "./dt_subscription_diagnostics";
import type { UASessionDiagnosticsVariable } from "./ua_session_diagnostics_variable";
import type { UASessionSecurityDiagnostics } from "./ua_session_security_diagnostics";
import type { UASubscriptionDiagnosticsArray } from "./ua_subscription_diagnostics_array";

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