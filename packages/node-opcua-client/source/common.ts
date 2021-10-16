/**
 * @module node-opcua-client
 */

import { BrowseNextRequest, BrowseNextResponse, BrowseRequest, BrowseResponse } from "node-opcua-service-browse";
import { CallRequest, CallResponse } from "node-opcua-service-call";
import {
    FindServersOnNetworkRequest,
    FindServersOnNetworkResponse,
    FindServersRequest,
    FindServersResponse
} from "node-opcua-service-discovery";
import { GetEndpointsRequest, GetEndpointsResponse } from "node-opcua-service-endpoints";
import { HistoryReadRequest, HistoryReadResponse } from "node-opcua-service-history";
import { QueryFirstRequest, QueryFirstResponse, QueryNextRequest, QueryNextResponse } from "node-opcua-service-query";
import { ReadRequest, ReadResponse } from "node-opcua-service-read";
import {
    RegisterNodesRequest,
    RegisterNodesResponse,
    UnregisterNodesRequest,
    UnregisterNodesResponse
} from "node-opcua-service-register-node";
import {
    ActivateSessionRequest,
    ActivateSessionResponse,
    CloseSessionRequest,
    CloseSessionResponse,
    CreateSessionRequest,
    CreateSessionResponse
} from "node-opcua-service-session";
import {
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
import {
    TranslateBrowsePathsToNodeIdsRequest,
    TranslateBrowsePathsToNodeIdsResponse
} from "node-opcua-service-translate-browse-path";
import { WriteRequest, WriteResponse } from "node-opcua-service-write";

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
