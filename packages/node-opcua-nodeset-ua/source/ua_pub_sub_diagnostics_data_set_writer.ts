// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { UAPubSubDiagnostics_counters, UAPubSubDiagnostics, UAPubSubDiagnostics_Base } from "./ua_pub_sub_diagnostics"
import { UAPubSubDiagnosticsCounter } from "./ua_pub_sub_diagnostics_counter"
import { UABaseDataVariable } from "./ua_base_data_variable"
export interface UAPubSubDiagnosticsDataSetWriter_counters extends UAPubSubDiagnostics_counters { // Object
      failedDataSetMessages: UAPubSubDiagnosticsCounter<UInt32>;
}
export interface UAPubSubDiagnosticsDataSetWriter_liveValues extends UAObject { // Object
      messageSequenceNumber?: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
      statusCode?: UABaseDataVariable<StatusCode, /*z*/DataType.StatusCode>;
      majorVersion?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
      minorVersion?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubDiagnosticsDataSetWriterType ns=0;i=19968   |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubDiagnosticsDataSetWriter_Base extends UAPubSubDiagnostics_Base {
    counters: UAPubSubDiagnosticsDataSetWriter_counters;
    liveValues: UAPubSubDiagnosticsDataSetWriter_liveValues;
}
export interface UAPubSubDiagnosticsDataSetWriter extends Omit<UAPubSubDiagnostics, "counters"|"liveValues">, UAPubSubDiagnosticsDataSetWriter_Base {
}