// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UInt16 } from "node-opcua-basic-types"
import { UAPubSubDiagnostics_counters, UAPubSubDiagnostics, UAPubSubDiagnostics_Base } from "./ua_pub_sub_diagnostics"
import { UAPubSubDiagnosticsCounter } from "./ua_pub_sub_diagnostics_counter"
import { UABaseDataVariable } from "./ua_base_data_variable"
export interface UAPubSubDiagnosticsReaderGroup_counters extends UAPubSubDiagnostics_counters { // Object
      receivedNetworkMessages: UAPubSubDiagnosticsCounter<UInt32>;
      receivedInvalidNetworkMessages?: UAPubSubDiagnosticsCounter<UInt32>;
      decryptionErrors?: UAPubSubDiagnosticsCounter<UInt32>;
}
export interface UAPubSubDiagnosticsReaderGroup_liveValues extends UAObject { // Object
      configuredDataSetReaders: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
      operationalDataSetReaders: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubDiagnosticsReaderGroupType ns=0;i=19903     |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubDiagnosticsReaderGroup_Base extends UAPubSubDiagnostics_Base {
    counters: UAPubSubDiagnosticsReaderGroup_counters;
    liveValues: UAPubSubDiagnosticsReaderGroup_liveValues;
}
export interface UAPubSubDiagnosticsReaderGroup extends Omit<UAPubSubDiagnostics, "counters"|"liveValues">, UAPubSubDiagnosticsReaderGroup_Base {
}