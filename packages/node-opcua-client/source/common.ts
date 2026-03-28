/**
 * @module node-opcua-client
 */

import type { BrowseNextRequest, BrowseNextResponse, BrowseRequest, BrowseResponse } from "node-opcua-service-browse";
import type { CallRequest, CallResponse } from "node-opcua-service-call";
import type {
    FindServersOnNetworkRequest,
    FindServersOnNetworkResponse,
    FindServersRequest,
    FindServersResponse
} from "node-opcua-service-discovery";
import type { GetEndpointsRequest, GetEndpointsResponse } from "node-opcua-service-endpoints";
import type { HistoryReadRequest, HistoryReadResponse } from "node-opcua-service-history";
import type { QueryFirstRequest, QueryFirstResponse, QueryNextRequest, QueryNextResponse } from "node-opcua-service-query";
import type { ReadRequest, ReadResponse } from "node-opcua-service-read";
import type {
    RegisterNodesRequest,
    RegisterNodesResponse,
    UnregisterNodesRequest,
    UnregisterNodesResponse
} from "node-opcua-service-register-node";
import type {
    ActivateSessionRequest,
    ActivateSessionResponse,
    CloseSessionRequest,
    CloseSessionResponse,
    CreateSessionRequest,
    CreateSessionResponse
} from "node-opcua-service-session";
import type {
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsResponse,
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
    DeleteMonitoredItemsRequest,
    DeleteMonitoredItemsResponse,
    DeleteSubscriptionsRequest,
    DeleteSubscriptionsResponse,
    ModifyMonitoredItemsRequest,
    ModifyMonitoredItemsResponse,
    ModifySubscriptionRequest,
    ModifySubscriptionResponse,
    PublishRequest,
    PublishResponse,
    RepublishRequest,
    RepublishResponse,
    SetMonitoringModeRequest,
    SetMonitoringModeResponse,
    SetPublishingModeRequest,
    SetPublishingModeResponse,
    TransferSubscriptionsRequest,
    TransferSubscriptionsResponse
} from "node-opcua-service-subscription";
import type {
    TranslateBrowsePathsToNodeIdsRequest,
    TranslateBrowsePathsToNodeIdsResponse
} from "node-opcua-service-translate-browse-path";
import type { WriteRequest, WriteResponse } from "node-opcua-service-write";

export type Request =
    | CreateSessionRequest
    | ActivateSessionRequest
    | CloseSessionRequest
    | GetEndpointsRequest
    | ReadRequest
    | BrowseRequest
    | BrowseNextRequest
    | WriteRequest
    | CallRequest
    | TranslateBrowsePathsToNodeIdsRequest
    | CreateSubscriptionRequest
    | DeleteSubscriptionsRequest
    | TransferSubscriptionsRequest
    | CreateMonitoredItemsRequest
    | ModifyMonitoredItemsRequest
    | ModifySubscriptionRequest
    | SetMonitoringModeRequest
    | PublishRequest
    | RepublishRequest
    | DeleteMonitoredItemsRequest
    | SetPublishingModeRequest
    | FindServersOnNetworkRequest
    | FindServersRequest
    | HistoryReadRequest
    | RegisterNodesRequest
    | UnregisterNodesRequest
    | QueryFirstRequest
    | QueryNextRequest;

export type Response =
    | CreateSessionResponse
    | ActivateSessionResponse
    | CloseSessionResponse
    | GetEndpointsResponse
    | ReadResponse
    | BrowseResponse
    | BrowseNextResponse
    | WriteResponse
    | CallResponse
    | TranslateBrowsePathsToNodeIdsResponse
    | CreateSubscriptionResponse
    | DeleteSubscriptionsResponse
    | TransferSubscriptionsResponse
    | CreateMonitoredItemsResponse
    | ModifyMonitoredItemsResponse
    | ModifySubscriptionResponse
    | SetMonitoringModeResponse
    | PublishResponse
    | RepublishResponse
    | DeleteMonitoredItemsResponse
    | SetPublishingModeResponse
    | FindServersOnNetworkResponse
    | FindServersResponse
    | HistoryReadResponse
    | RegisterNodesResponse
    | UnregisterNodesResponse
    | QueryFirstResponse
    | QueryNextResponse;
