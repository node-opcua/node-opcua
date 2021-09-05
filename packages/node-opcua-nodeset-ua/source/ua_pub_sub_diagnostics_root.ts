// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16 } from "node-opcua-basic-types"
import { UABaseDataVariable } from "./ua_base_data_variable"
import { UAPubSubDiagnostics, UAPubSubDiagnostics_Base } from "./ua_pub_sub_diagnostics"
export interface UAPubSubDiagnosticsRoot_liveValues extends UAObject { // Object
      configuredDataSetWriters: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
      configuredDataSetReaders: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
      operationalDataSetWriters: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
      operationalDataSetReaders: UABaseDataVariable<UInt16, /*z*/DataType.UInt16>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubDiagnosticsRootType ns=0;i=19732            |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubDiagnosticsRoot_Base extends UAPubSubDiagnostics_Base {
    liveValues: UAPubSubDiagnosticsRoot_liveValues;
}
export interface UAPubSubDiagnosticsRoot extends Omit<UAPubSubDiagnostics, "liveValues">, UAPubSubDiagnosticsRoot_Base {
}