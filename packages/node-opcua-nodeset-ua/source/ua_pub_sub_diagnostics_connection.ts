// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "./ua_base_data_variable"
import { UAPubSubDiagnostics, UAPubSubDiagnostics_Base } from "./ua_pub_sub_diagnostics"
export interface UAPubSubDiagnosticsConnection_liveValues extends UAObject { // Object
      resolvedAddress: UABaseDataVariable<UAString, /*z*/DataType.String>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubDiagnosticsConnectionType ns=0;i=19786      |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubDiagnosticsConnection_Base extends UAPubSubDiagnostics_Base {
    liveValues: UAPubSubDiagnosticsConnection_liveValues;
}
export interface UAPubSubDiagnosticsConnection extends Omit<UAPubSubDiagnostics, "liveValues">, UAPubSubDiagnosticsConnection_Base {
}