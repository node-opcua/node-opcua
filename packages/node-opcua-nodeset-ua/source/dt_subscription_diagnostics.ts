// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { UInt32, Byte } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |SubscriptionDiagnosticsDataType                   |
 * | isAbstract|false                                             |
 */
export interface DTSubscriptionDiagnostics extends DTStructure  {
  sessionId: NodeId; // NodeId ns=0;i=17
  subscriptionId: UInt32; // UInt32 ns=0;i=7
  priority: Byte; // Byte ns=0;i=3
  publishingInterval: number; // Double ns=0;i=290
  maxKeepAliveCount: UInt32; // UInt32 ns=0;i=7
  maxLifetimeCount: UInt32; // UInt32 ns=0;i=7
  maxNotificationsPerPublish: UInt32; // UInt32 ns=0;i=7
  publishingEnabled: boolean; // Boolean ns=0;i=1
  modifyCount: UInt32; // UInt32 ns=0;i=7
  enableCount: UInt32; // UInt32 ns=0;i=7
  disableCount: UInt32; // UInt32 ns=0;i=7
  republishRequestCount: UInt32; // UInt32 ns=0;i=7
  republishMessageRequestCount: UInt32; // UInt32 ns=0;i=7
  republishMessageCount: UInt32; // UInt32 ns=0;i=7
  transferRequestCount: UInt32; // UInt32 ns=0;i=7
  transferredToAltClientCount: UInt32; // UInt32 ns=0;i=7
  transferredToSameClientCount: UInt32; // UInt32 ns=0;i=7
  publishRequestCount: UInt32; // UInt32 ns=0;i=7
  dataChangeNotificationsCount: UInt32; // UInt32 ns=0;i=7
  eventNotificationsCount: UInt32; // UInt32 ns=0;i=7
  notificationsCount: UInt32; // UInt32 ns=0;i=7
  latePublishRequestCount: UInt32; // UInt32 ns=0;i=7
  currentKeepAliveCount: UInt32; // UInt32 ns=0;i=7
  currentLifetimeCount: UInt32; // UInt32 ns=0;i=7
  unacknowledgedMessageCount: UInt32; // UInt32 ns=0;i=7
  discardedMessageCount: UInt32; // UInt32 ns=0;i=7
  monitoredItemCount: UInt32; // UInt32 ns=0;i=7
  disabledMonitoredItemCount: UInt32; // UInt32 ns=0;i=7
  monitoringQueueOverflowCount: UInt32; // UInt32 ns=0;i=7
  nextSequenceNumber: UInt32; // UInt32 ns=0;i=7
  eventQueueOverFlowCount: UInt32; // UInt32 ns=0;i=7
}