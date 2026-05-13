import type { UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UAPubSubDiagnostics, UAPubSubDiagnostics_Base } from "./ua_pub_sub_diagnostics";

// ----- this file has been automatically generated - do not edit

export interface UAPubSubDiagnosticsConnection_liveValues extends UAObject { // Object
      resolvedAddress: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubDiagnosticsConnectionType i=19786                     |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubDiagnosticsConnection_Base extends UAPubSubDiagnostics_Base {
    liveValues: UAPubSubDiagnosticsConnection_liveValues;
}
export interface UAPubSubDiagnosticsConnection extends Omit<UAPubSubDiagnostics, "liveValues">, UAPubSubDiagnosticsConnection_Base {}