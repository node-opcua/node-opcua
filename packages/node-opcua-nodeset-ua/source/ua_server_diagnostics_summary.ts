// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
import { DTServerDiagnosticsSummary } from "./dt_server_diagnostics_summary"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |ServerDiagnosticsSummaryType ns=0;i=2150          |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTServerDiagnosticsSummary ns=0;i=859             |
 * |isAbstract      |false                                             |
 */
export interface UAServerDiagnosticsSummary_Base<T extends DTServerDiagnosticsSummary/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    serverViewCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    currentSessionCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    cumulatedSessionCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    securityRejectedSessionCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    rejectedSessionCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    sessionTimeoutCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    sessionAbortCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    publishingIntervalCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    currentSubscriptionCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    cumulatedSubscriptionCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    securityRejectedRequestsCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    rejectedRequestsCount: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UAServerDiagnosticsSummary<T extends DTServerDiagnosticsSummary/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UAServerDiagnosticsSummary_Base<T /*B*/> {
}