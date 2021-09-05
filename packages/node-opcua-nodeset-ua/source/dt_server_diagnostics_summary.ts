// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ServerDiagnosticsSummaryDataType                  |
 * | isAbstract|false                                             |
 */
export interface DTServerDiagnosticsSummary extends DTStructure  {
  serverViewCount: UInt32; // UInt32 ns=0;i=7
  currentSessionCount: UInt32; // UInt32 ns=0;i=7
  cumulatedSessionCount: UInt32; // UInt32 ns=0;i=7
  securityRejectedSessionCount: UInt32; // UInt32 ns=0;i=7
  rejectedSessionCount: UInt32; // UInt32 ns=0;i=7
  sessionTimeoutCount: UInt32; // UInt32 ns=0;i=7
  sessionAbortCount: UInt32; // UInt32 ns=0;i=7
  currentSubscriptionCount: UInt32; // UInt32 ns=0;i=7
  cumulatedSubscriptionCount: UInt32; // UInt32 ns=0;i=7
  publishingIntervalCount: UInt32; // UInt32 ns=0;i=7
  securityRejectedRequestsCount: UInt32; // UInt32 ns=0;i=7
  rejectedRequestsCount: UInt32; // UInt32 ns=0;i=7
}