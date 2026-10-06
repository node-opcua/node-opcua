import type { UInt16 } from "node-opcua-basic-types";
import type { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { StatusCode } from "node-opcua-status-code";

import type { EnumConnectionStateEnum } from "./enum_connection_state_enum.js";
import type { EnumFxErrorEnum } from "./enum_fx_error_enum.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionDiagnosticsDataType                               |
 * | isAbstract|false                                                       |
 */
export interface DTConnectionDiagnostics extends DTStructure {
  /** BrowseName of the related <Connection> Node in the ConnectionConfigurationSet*/
  name: QualifiedName; // QualifiedName ns=0;i=20
  lastActivity: UInt16; // UInt16 ns=35;i=3009
  connectionState: EnumConnectionStateEnum; // Int32 ns=35;i=3011
  errorEndpoint1: EnumFxErrorEnum; // Int32 ns=35;i=3015
  endpoint1Status: StatusCode; // StatusCode ns=0;i=19
  errorEndpoint2: EnumFxErrorEnum; // Int32 ns=35;i=3015
  endpoint2Status: StatusCode; // StatusCode ns=0;i=19
}
export interface UDTConnectionDiagnostics extends ExtensionObject, DTConnectionDiagnostics {};