/**
 * @module node-opcua-client
 */

import { EventEmitter } from "events";

import { DateTime, UInt8 } from "node-opcua-basic-types";
import { ServerState } from "node-opcua-common";
import { Certificate, Nonce } from "node-opcua-crypto";

import { DataValue } from "node-opcua-data-value";
import { NodeId, NodeIdLike} from "node-opcua-nodeid";
import { ErrorCallback} from "node-opcua-secure-channel";
import {
    BrowseDescription, BrowseDescriptionOptions, BrowseRequest, BrowseResponse, BrowseResult
} from "node-opcua-service-browse";
import {
    CallMethodRequest, CallMethodRequestOptions, CallMethodResult} from "node-opcua-service-call";
import { EndpointDescription } from "node-opcua-service-endpoints";
import { HistoryReadResult } from "node-opcua-service-history";
import {
    QueryFirstRequest, QueryFirstRequestOptions, QueryFirstResponse} from "node-opcua-service-query";
import {
    ReadValueId, ReadValueIdOptions} from "node-opcua-service-read";
import {
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsRequestOptions,
    CreateSubscriptionRequest,
    CreateSubscriptionRequestOptions,
    DeleteMonitoredItemsRequest,
    DeleteMonitoredItemsRequestOptions,
    DeleteSubscriptionsRequest,
    DeleteSubscriptionsRequestOptions,
    ModifyMonitoredItemsRequest,
    ModifyMonitoredItemsRequestOptions,
    ModifySubscriptionRequest,
    ModifySubscriptionRequestOptions,
    SetMonitoringModeRequest,
    SetMonitoringModeRequestOptions,
    TransferSubscriptionsRequest, TransferSubscriptionsRequestOptions, } from "node-opcua-service-subscription";
import {
    BrowsePath, BrowsePathResult} from "node-opcua-service-translate-browse-path";
import {
    WriteValue, WriteValueOptions
} from "node-opcua-service-write";
import { StatusCode } from "node-opcua-status-code";
import { Variant} from "node-opcua-variant";
import { ClientSubscription } from "./client_subscription";

export type ResponseCallback<T> = (err: Error | null, response?: T) => void;

export interface NodeAttributes {
    nodeId: NodeId;
    statusCode: StatusCode;

    [key: string]: Variant | NodeId | StatusCode;
}

export interface MonitoredItemData {
    clientHandles: Uint32Array;
    serverHandles: Uint32Array;
}

export interface CreateSubscriptionOptions {
    requestedPublishingInterval: number;
    requestedLifetimeCount: number;
    requestedMaxKeepAliveCount: number;
    maxNotificationsPerPublish?: number;
    publishingEnabled?: boolean;
    priority?: UInt8;
}

export type BrowseDescriptionLike = string | BrowseDescriptionOptions | BrowseDescription;
export type ReadValueIdLike = ReadValueIdOptions | ReadValueId;
export type WriteValueLike = WriteValueOptions | WriteValue;
export type DeleteMonitoredItemsRequestLike = DeleteMonitoredItemsRequestOptions | DeleteMonitoredItemsRequest;
export type CreateSubscriptionRequestLike = CreateSubscriptionRequestOptions | CreateSubscriptionRequest;
export type DeleteSubscriptionsRequestLike = DeleteSubscriptionsRequestOptions | DeleteSubscriptionsRequest;
export type TransferSubscriptionsRequestLike = TransferSubscriptionsRequestOptions | TransferSubscriptionsRequest;
export type CreateMonitoredItemsRequestLike = CreateMonitoredItemsRequestOptions | CreateMonitoredItemsRequest;
export type ModifyMonitoredItemsRequestLike = ModifyMonitoredItemsRequestOptions | ModifyMonitoredItemsRequest;
export type ModifySubscriptionRequestLike = ModifySubscriptionRequestOptions | ModifySubscriptionRequest;
export type SetMonitoringModeRequestLike = SetMonitoringModeRequestOptions | SetMonitoringModeRequest;
export type CallMethodRequestLike = CallMethodRequestOptions | CallMethodRequest;
export type QueryFirstRequestLike = QueryFirstRequestOptions | QueryFirstRequest;

export type SubscriptionId = number;
export type MethodId = NodeIdLike ;

export interface ArgumentDefinition {
    inputArguments: Variant[];
    outputArguments: Variant[];
}

export interface ClientSession  {

    // properties
    /** the session Id */
    sessionId: NodeId;
    subscriptionCount: number;
    isReconnecting: boolean;
    endpoint: EndpointDescription;

    close(callback: ErrorCallback): void;

    close(deleteSubscription: boolean, callback: ErrorCallback): void;

    close(deleteSubscription?: boolean): Promise<void>;
}
// events
export interface ClientSession extends EventEmitter {
    // tslint:disable:unified-signatures
    on(event: "keepalive", eventHandler: (lastKnownServerState: ServerState) => void): ClientSession;

    on(event: "keepalive_failure", eventHandler: (state: any) => void): ClientSession;

    on(event: "session_closed", eventHandler: (statusCode: StatusCode) => void): ClientSession;

    on(event: string | symbol, listener: (...args: any[]) => void): this;

}
// browse services
export interface ClientSession {
    browse(nodeToBrowse: BrowseDescriptionLike, callback: ResponseCallback<BrowseResult>): void;

    browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;

    browse(nodeToBrowse: BrowseDescriptionLike): Promise<BrowseResult>;

    browse(nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
}
// translate browsePathTo NodeId services
export interface ClientSession {
    translateBrowsePath(browsesPath: BrowsePath[], callback: ResponseCallback<BrowsePathResult[]>): void;

    translateBrowsePath(browsePath: BrowsePath, callback: ResponseCallback<BrowsePathResult>): void;

    translateBrowsePath(browsePath: BrowsePath): Promise<BrowsePathResult>;

    translateBrowsePath(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]>;

}
// query services
export interface ClientSession {
    queryFirst(
        queryFirstRequest: QueryFirstRequestLike
    ): Promise<QueryFirstResponse>;

    queryFirst(
        queryFirstRequest: QueryFirstRequestLike,
        callback: ResponseCallback<QueryFirstResponse>
    ): void;
}
// call services
export interface ClientSession {
    call(
        methodToCall: CallMethodRequestLike,
        callback: (err: Error | null, result?: CallMethodResult) => void): void;

    call(
        methodsToCall: CallMethodRequestLike[],
        callback: (err: Error | null, results?: CallMethodResult[]) => void): void;

    call(
        methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;

    call(
        methodsToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;

    getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;

    getArgumentDefinition(methodId: MethodId, callback: (err: Error | null, args?: ArgumentDefinition) => void): void;
}
// register services
export interface ClientSession {

    registerNodes(nodesToRegister: NodeIdLike[]): Promise<NodeId[]>;

    registerNodes(
        nodesToRegister: NodeIdLike[],
        callback: (err: Error | null, registeredNodeIds?: NodeId[]) => void
    ): void;

    unregisterNodes(nodesToRegister: NodeIdLike[]): Promise<void>;

    unregisterNodes(
        nodesToRegister: NodeIdLike[],
        callback: (err?: Error) => void
    ): void;

}
// read services
export interface ClientSession {

    read(nodeToRead: ReadValueIdLike, maxAge: number, callback: ResponseCallback<DataValue>): void;
    read(nodesToRead: ReadValueIdLike[], maxAge: number, callback: ResponseCallback<DataValue[]>): void;

    read(nodeToRead: ReadValueIdLike, callback: ResponseCallback<DataValue>): void;

    read(nodesToRead: ReadValueIdLike[], callback: ResponseCallback<DataValue[]>): void;

    read(nodeToRead: ReadValueIdLike, maxAge?: number): Promise<DataValue>;

    read(nodesToRead: ReadValueIdLike[], maxAge?: number): Promise<DataValue[]>;

    readVariableValue(nodeId: NodeIdLike, callback: ResponseCallback<DataValue>): void;

    readVariableValue(nodeId: NodeIdLike): Promise<DataValue>;

    readVariableValue(nodeIds: NodeIdLike[], callback: ResponseCallback<DataValue[]>): void;

    readVariableValue(nodeIds: NodeIdLike[]): Promise<DataValue[]>;

}
// write services
export interface ClientSession {
    write(nodeToWrite: WriteValueLike, callback: ResponseCallback<StatusCode>): void;

    write(nodesToWrite: WriteValueLike[], callback: ResponseCallback<StatusCode[]>): void;

    write(nodesToWrite: WriteValueLike[]): Promise<StatusCode[]>;

    write(nodeToWrite: WriteValueLike): Promise<StatusCode>;

    writeSingleNode(nodeToWrite: NodeIdLike, value: Variant): Promise<StatusCode>;
    writeSingleNode(nodeToWrite: NodeIdLike, value: Variant, callback: ResponseCallback<StatusCode>): void;

}
// subscription services
export interface ClientSession {
    createSubscription2(
        createSubscriptionRequest: CreateSubscriptionRequestLike): Promise<ClientSubscription>;

    createSubscription2(
        createSubscriptionRequest: CreateSubscriptionRequestLike,
        callback: (err: Error | null, subscription?: ClientSubscription) => void
    ): void;
    getMonitoredItems(
        subscriptionId: SubscriptionId): Promise<MonitoredItemData>;
    getMonitoredItems(
        subscriptionId: SubscriptionId,
        callback: (err: Error | null, result?: MonitoredItemData) => void): void;
}
// history services
export interface ClientSession {

    readHistoryValue(
      nodes: ReadValueIdLike[],
      start: DateTime,
      end: DateTime,
      callback: (err: Error | null, results?: HistoryReadResult[]) => void): void;
    readHistoryValue(
      nodes: ReadValueIdLike[],
      start: DateTime,
      end: DateTime
    ): Promise<HistoryReadResult[]>;

    readHistoryValue(
      node: ReadValueIdLike,
      start: DateTime,
      end: DateTime,
      callback: (err: Error | null, results?: HistoryReadResult) => void): void;
    readHistoryValue(
      nodes: ReadValueIdLike,
      start: DateTime,
      end: DateTime
    ): Promise<HistoryReadResult>;

}
