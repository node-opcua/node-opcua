import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTSamplingIntervalDiagnostics } from "./dt_sampling_interval_diagnostics.js";
import type { DTServerDiagnosticsSummary } from "./dt_server_diagnostics_summary.js";
import type { DTSubscriptionDiagnostics } from "./dt_subscription_diagnostics.js";
import type { UASamplingIntervalDiagnosticsArray } from "./ua_sampling_interval_diagnostics_array.js";
import type { UAServerDiagnosticsSummary } from "./ua_server_diagnostics_summary.js";
import type { UASessionsDiagnosticsSummary } from "./ua_sessions_diagnostics_summary.js";
import type { UASubscriptionDiagnosticsArray } from "./ua_subscription_diagnostics_array.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ServerDiagnosticsType i=2020                                |
 * |isAbstract      |false                                                       |
 */
export interface UAServerDiagnostics_Base {
    serverDiagnosticsSummary: UAServerDiagnosticsSummary<DTServerDiagnosticsSummary>;
    samplingIntervalDiagnosticsArray?: UASamplingIntervalDiagnosticsArray<DTSamplingIntervalDiagnostics[]>;
    subscriptionDiagnosticsArray: UASubscriptionDiagnosticsArray<DTSubscriptionDiagnostics[]>;
    sessionsDiagnosticsSummary: UASessionsDiagnosticsSummary;
    enabledFlag: UAProperty<boolean, DataType.Boolean>;
}
export interface UAServerDiagnostics extends UAObject, UAServerDiagnostics_Base {}