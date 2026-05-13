import type { UAObject } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UAPubSubDiagnostics, UAPubSubDiagnostics_Base } from "./ua_pub_sub_diagnostics";

// ----- this file has been automatically generated - do not edit

export interface UAPubSubDiagnosticsRoot_liveValues extends UAObject { // Object
      configuredDataSetWriters: UABaseDataVariable<UInt16, DataType.UInt16>;
      configuredDataSetReaders: UABaseDataVariable<UInt16, DataType.UInt16>;
      operationalDataSetWriters: UABaseDataVariable<UInt16, DataType.UInt16>;
      operationalDataSetReaders: UABaseDataVariable<UInt16, DataType.UInt16>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubDiagnosticsRootType i=19732                           |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubDiagnosticsRoot_Base extends UAPubSubDiagnostics_Base {
    liveValues: UAPubSubDiagnosticsRoot_liveValues;
}
export interface UAPubSubDiagnosticsRoot extends Omit<UAPubSubDiagnostics, "liveValues">, UAPubSubDiagnosticsRoot_Base {}