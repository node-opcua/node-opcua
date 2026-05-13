import type { UAObject } from "node-opcua-address-space-base";
import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UAPubSubDiagnostics, UAPubSubDiagnostics_Base, UAPubSubDiagnostics_counters } from "./ua_pub_sub_diagnostics";
import type { UAPubSubDiagnosticsCounter } from "./ua_pub_sub_diagnostics_counter";

// ----- this file has been automatically generated - do not edit

export interface UAPubSubDiagnosticsWriterGroup_counters extends UAPubSubDiagnostics_counters { // Object
      sentNetworkMessages: UAPubSubDiagnosticsCounter<UInt32>;
      failedTransmissions: UAPubSubDiagnosticsCounter<UInt32>;
      encryptionErrors: UAPubSubDiagnosticsCounter<UInt32>;
}
export interface UAPubSubDiagnosticsWriterGroup_liveValues extends UAObject { // Object
      configuredDataSetWriters: UABaseDataVariable<UInt16, DataType.UInt16>;
      operationalDataSetWriters: UABaseDataVariable<UInt16, DataType.UInt16>;
      securityTokenID?: UABaseDataVariable<UInt32, DataType.UInt32>;
      timeToNextTokenID?: UABaseDataVariable<number, DataType.Double>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubDiagnosticsWriterGroupType i=19834                    |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubDiagnosticsWriterGroup_Base extends UAPubSubDiagnostics_Base {
    counters: UAPubSubDiagnosticsWriterGroup_counters;
    liveValues: UAPubSubDiagnosticsWriterGroup_liveValues;
}
export interface UAPubSubDiagnosticsWriterGroup extends Omit<UAPubSubDiagnostics, "counters"|"liveValues">, UAPubSubDiagnosticsWriterGroup_Base {}