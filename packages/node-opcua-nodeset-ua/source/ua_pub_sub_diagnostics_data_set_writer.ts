import type { UAObject } from "node-opcua-address-space-base";
import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { StatusCode } from "node-opcua-status-code";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UAPubSubDiagnostics, UAPubSubDiagnostics_Base, UAPubSubDiagnostics_counters } from "./ua_pub_sub_diagnostics";
import type { UAPubSubDiagnosticsCounter } from "./ua_pub_sub_diagnostics_counter";

// ----- this file has been automatically generated - do not edit

export interface UAPubSubDiagnosticsDataSetWriter_counters extends UAPubSubDiagnostics_counters { // Object
      failedDataSetMessages: UAPubSubDiagnosticsCounter<UInt32>;
}
export interface UAPubSubDiagnosticsDataSetWriter_liveValues extends UAObject { // Object
      messageSequenceNumber?: UABaseDataVariable<UInt16, DataType.UInt16>;
      statusCode?: UABaseDataVariable<StatusCode, DataType.StatusCode>;
      majorVersion?: UABaseDataVariable<UInt32, DataType.UInt32>;
      minorVersion?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubDiagnosticsDataSetWriterType i=19968                  |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubDiagnosticsDataSetWriter_Base extends UAPubSubDiagnostics_Base {
    counters: UAPubSubDiagnosticsDataSetWriter_counters;
    liveValues: UAPubSubDiagnosticsDataSetWriter_liveValues;
}
export interface UAPubSubDiagnosticsDataSetWriter extends Omit<UAPubSubDiagnostics, "counters"|"liveValues">, UAPubSubDiagnosticsDataSetWriter_Base {}