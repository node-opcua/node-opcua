// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTSessionSecurityDiagnostics } from "./dt_session_security_diagnostics"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |SessionSecurityDiagnosticsType ns=0;i=2244        |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTSessionSecurityDiagnostics ns=0;i=868           |
 * |isAbstract      |false                                             |
 */
export interface UASessionSecurityDiagnostics_Base<T extends DTSessionSecurityDiagnostics/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    sessionId: UABaseDataVariable<NodeId, /*z*/DataType.NodeId>;
    clientUserIdOfSession: UABaseDataVariable<UAString, /*z*/DataType.String>;
    clientUserIdHistory: UABaseDataVariable<UAString[], /*z*/DataType.String>;
    authenticationMechanism: UABaseDataVariable<UAString, /*z*/DataType.String>;
    encoding: UABaseDataVariable<UAString, /*z*/DataType.String>;
    transportProtocol: UABaseDataVariable<UAString, /*z*/DataType.String>;
    securityMode: UABaseDataVariable<EnumMessageSecurityMode, /*z*/DataType.Int32>;
    securityPolicyUri: UABaseDataVariable<UAString, /*z*/DataType.String>;
    clientCertificate: UABaseDataVariable<Buffer, /*z*/DataType.ByteString>;
}
export interface UASessionSecurityDiagnostics<T extends DTSessionSecurityDiagnostics/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UASessionSecurityDiagnostics_Base<T /*B*/> {
}