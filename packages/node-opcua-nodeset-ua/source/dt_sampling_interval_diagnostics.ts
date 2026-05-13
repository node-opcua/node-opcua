import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |SamplingIntervalDiagnosticsDataType                         |
 * | isAbstract|false                                                       |
 */
export interface DTSamplingIntervalDiagnostics extends DTStructure {
  samplingInterval: number; // Double ns=0;i=290
  monitoredItemCount: UInt32; // UInt32 ns=0;i=7
  maxMonitoredItemCount: UInt32; // UInt32 ns=0;i=7
  disabledMonitoredItemCount: UInt32; // UInt32 ns=0;i=7
}
export interface UDTSamplingIntervalDiagnostics extends ExtensionObject, DTSamplingIntervalDiagnostics {};