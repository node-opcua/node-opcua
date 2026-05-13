import type { UAObject } from "node-opcua-address-space-base";
import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UAPubSubDiagnostics, UAPubSubDiagnostics_Base, UAPubSubDiagnostics_counters } from "./ua_pub_sub_diagnostics";
import type { UAPubSubDiagnosticsCounter } from "./ua_pub_sub_diagnostics_counter";

// ----- this file has been automatically generated - do not edit

export interface UAPubSubDiagnosticsReaderGroup_counters extends UAPubSubDiagnostics_counters { // Object
      receivedNetworkMessages: UAPubSubDiagnosticsCounter<UInt32>;
      receivedInvalidNetworkMessages?: UAPubSubDiagnosticsCounter<UInt32>;
      decryptionErrors?: UAPubSubDiagnosticsCounter<UInt32>;
}
export interface UAPubSubDiagnosticsReaderGroup_liveValues extends UAObject { // Object
      configuredDataSetReaders: UABaseDataVariable<UInt16, DataType.UInt16>;
      operationalDataSetReaders: UABaseDataVariable<UInt16, DataType.UInt16>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubDiagnosticsReaderGroupType i=19903                    |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubDiagnosticsReaderGroup_Base extends UAPubSubDiagnostics_Base {
    counters: UAPubSubDiagnosticsReaderGroup_counters;
    liveValues: UAPubSubDiagnosticsReaderGroup_liveValues;
}
export interface UAPubSubDiagnosticsReaderGroup extends Omit<UAPubSubDiagnostics, "counters"|"liveValues">, UAPubSubDiagnosticsReaderGroup_Base {}