// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |SamplingIntervalDiagnosticsDataType               |
 * | isAbstract|false                                             |
 */
export interface DTSamplingIntervalDiagnostics extends DTStructure  {
  samplingInterval: number; // Double ns=0;i=290
  monitoredItemCount: UInt32; // UInt32 ns=0;i=7
  maxMonitoredItemCount: UInt32; // UInt32 ns=0;i=7
  disabledMonitoredItemCount: UInt32; // UInt32 ns=0;i=7
}