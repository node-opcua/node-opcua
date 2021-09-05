// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTApplicationDescription } from "./dt_application_description"
import { DTServiceCounter } from "./dt_service_counter"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |SessionDiagnosticsDataType                        |
 * | isAbstract|false                                             |
 */
export interface DTSessionDiagnostics extends DTStructure  {
  sessionId: NodeId; // NodeId ns=0;i=17
  sessionName: UAString; // String ns=0;i=12
  clientDescription: DTApplicationDescription; // ExtensionObject ns=0;i=308
  serverUri: UAString; // String ns=0;i=12
  endpointUrl: UAString; // String ns=0;i=12
  localeIds: UAString[]; // String ns=0;i=295
  actualSessionTimeout: number; // Double ns=0;i=290
  maxResponseMessageSize: UInt32; // UInt32 ns=0;i=7
  clientConnectionTime: Date; // DateTime ns=0;i=294
  clientLastContactTime: Date; // DateTime ns=0;i=294
  currentSubscriptionsCount: UInt32; // UInt32 ns=0;i=7
  currentMonitoredItemsCount: UInt32; // UInt32 ns=0;i=7
  currentPublishRequestsInQueue: UInt32; // UInt32 ns=0;i=7
  totalRequestCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  unauthorizedRequestCount: UInt32; // UInt32 ns=0;i=7
  readCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  historyReadCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  writeCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  historyUpdateCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  callCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  createMonitoredItemsCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  modifyMonitoredItemsCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  setMonitoringModeCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  setTriggeringCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  deleteMonitoredItemsCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  createSubscriptionCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  modifySubscriptionCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  setPublishingModeCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  publishCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  republishCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  transferSubscriptionsCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  deleteSubscriptionsCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  addNodesCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  addReferencesCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  deleteNodesCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  deleteReferencesCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  browseCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  browseNextCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  translateBrowsePathsToNodeIdsCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  queryFirstCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  queryNextCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  registerNodesCount: DTServiceCounter; // ExtensionObject ns=0;i=871
  unregisterNodesCount: DTServiceCounter; // ExtensionObject ns=0;i=871
}