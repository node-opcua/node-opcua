// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSessionSecurityDiagnostics } from "./dt_session_security_diagnostics"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |SessionSecurityDiagnosticsType i=2244                       |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTSessionSecurityDiagnostics i=868                          |
 * |isAbstract      |false                                                       |
 */
export interface UASessionSecurityDiagnostics_Base<T extends DTSessionSecurityDiagnostics>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    sessionId: UABaseDataVariable<NodeId, DataType.NodeId>;
    clientUserIdOfSession: UABaseDataVariable<UAString, DataType.String>;
    clientUserIdHistory: UABaseDataVariable<UAString[], DataType.String>;
    authenticationMechanism: UABaseDataVariable<UAString, DataType.String>;
    encoding: UABaseDataVariable<UAString, DataType.String>;
    transportProtocol: UABaseDataVariable<UAString, DataType.String>;
    securityMode: UABaseDataVariable<EnumMessageSecurityMode, DataType.Int32>;
    securityPolicyUri: UABaseDataVariable<UAString, DataType.String>;
    clientCertificate: UABaseDataVariable<Buffer, DataType.ByteString>;
}
export interface UASessionSecurityDiagnostics<T extends DTSessionSecurityDiagnostics> extends UABaseDataVariable<T, DataType.ExtensionObject>, UASessionSecurityDiagnostics_Base<T> {
}