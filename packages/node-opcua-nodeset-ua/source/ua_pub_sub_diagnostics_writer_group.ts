// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { UAPubSubDiagnostics_counters, UAPubSubDiagnostics, UAPubSubDiagnostics_Base } from "./ua_pub_sub_diagnostics"
import { UAPubSubDiagnosticsCounter } from "./ua_pub_sub_diagnostics_counter"
import { UABaseDataVariable } from "./ua_base_data_variable"
export interface UAPubSubDiagnosticsWriterGroup_counters extends UAPubSubDiagnostics_counters { // Object
      sentNetworkMessages: UAPubSubDiagnosticsCounter<UInt32>;
      failedTransmissions: UAPubSubDiagnosticsCounter<UInt32>;
      encryptionErrors: UAPubSubDiagnosticsCounter<UInt32>;
}
export interface UAPubSubDiagnosticsWriterGroup_liveValues extends UAObject { // Object
      configuredDataSetWriters: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
      operationalDataSetWriters: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
      securityTokenID?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
      timeToNextTokenID?: UABaseDataVariable<number, /*z*/DataType.Double>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubDiagnosticsWriterGroupType ns=0;i=19834     |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubDiagnosticsWriterGroup_Base extends UAPubSubDiagnostics_Base {
    counters: UAPubSubDiagnosticsWriterGroup_counters;
    liveValues: UAPubSubDiagnosticsWriterGroup_liveValues;
}
export interface UAPubSubDiagnosticsWriterGroup extends Omit<UAPubSubDiagnostics, "counters"|"liveValues">, UAPubSubDiagnosticsWriterGroup_Base {
}