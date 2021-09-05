// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTServerDiagnosticsSummary } from "./dt_server_diagnostics_summary"
import { UAServerDiagnosticsSummary } from "./ua_server_diagnostics_summary"
import { DTSamplingIntervalDiagnostics } from "./dt_sampling_interval_diagnostics"
import { UASamplingIntervalDiagnosticsArray } from "./ua_sampling_interval_diagnostics_array"
import { DTSubscriptionDiagnostics } from "./dt_subscription_diagnostics"
import { UASubscriptionDiagnosticsArray } from "./ua_subscription_diagnostics_array"
import { UASessionsDiagnosticsSummary } from "./ua_sessions_diagnostics_summary"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |ServerDiagnosticsType ns=0;i=2020                 |
 * |isAbstract      |false                                             |
 */
export interface UAServerDiagnostics_Base {
    serverDiagnosticsSummary: UAServerDiagnosticsSummary<DTServerDiagnosticsSummary>;
    samplingIntervalDiagnosticsArray?: UASamplingIntervalDiagnosticsArray<DTSamplingIntervalDiagnostics[]>;
    subscriptionDiagnosticsArray: UASubscriptionDiagnosticsArray<DTSubscriptionDiagnostics[]>;
    sessionsDiagnosticsSummary: UASessionsDiagnosticsSummary;
    enabledFlag: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAServerDiagnostics extends UAObject, UAServerDiagnostics_Base {
}