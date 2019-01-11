/**
 * @module node-opcua-client
 */

import { EventEmitter } from "events";

import { DateTime, UInt8 } from "node-opcua-basic-types";
import { ServerState } from "node-opcua-common";
import { Certificate, Nonce } from "node-opcua-crypto";

import { LocalizedTextLike } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { ErrorCallback } from "node-opcua-secure-channel";
import {
    BrowseDescription, BrowseDescriptionOptions, BrowseRequest, BrowseResponse, BrowseResult
} from "node-opcua-service-browse";
import {
    CallMethodRequest, CallMethodRequestOptions, CallMethodResult
} from "node-opcua-service-call";
import { EndpointDescription } from "node-opcua-service-endpoints";
import { HistoryReadResult } from "node-opcua-service-history";
import {
    QueryFirstRequest, QueryFirstRequestOptions, QueryFirstResponse
} from "node-opcua-service-query";
import {
    ReadValueId, ReadValueIdOptions
} from "node-opcua-service-read";
import {
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsRequestOptions, CreateMonitoredItemsResponse,
    CreateSubscriptionRequest,
    CreateSubscriptionRequestOptions, CreateSubscriptionResponse,
    DeleteMonitoredItemsRequest,
    DeleteMonitoredItemsRequestOptions,
    DeleteSubscriptionsRequest,
    DeleteSubscriptionsRequestOptions, DeleteSubscriptionsResponse,
    ModifyMonitoredItemsRequest,
    ModifyMonitoredItemsRequestOptions, ModifyMonitoredItemsResponse,
    ModifySubscriptionRequest,
    ModifySubscriptionRequestOptions, ModifySubscriptionResponse,
    SetMonitoringModeRequest,
    SetMonitoringModeRequestOptions, SetMonitoringModeResponse,
    TransferSubscriptionsRequest, TransferSubscriptionsRequestOptions, TransferSubscriptionsResponse
} from "node-opcua-service-subscription";
import {
    BrowsePath, BrowsePathResult
} from "node-opcua-service-translate-browse-path";
import {
    WriteValue, WriteValueOptions
} from "node-opcua-service-write";
import { StatusCode } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import { ClientSubscription } from "./client_subscription";
import { ClientSessionImpl } from "./private/client_session_impl";

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

export interface ClientSession {

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

    /**
     *
     * @method call
     *
     * @param methodToCall {CallMethodRequest} the call method request
     * @param callback
     *
     * @example :
     *
     * ```javascript
     * const methodToCall = {
     *     objectId: "ns=2;i=12",
     *     methodId: "ns=2;i=13",
     *     inputArguments: [
     *         new Variant({...}),
     *         new Variant({...}),
     *     ]
     * }
     * session.call(methodToCall,function(err,callResult) {
     *    if (!err) {
     *         console.log(" statusCode = ",callResult.statusCode);
     *         console.log(" inputArgumentResults[0] = ",callResult.inputArgumentResults[0].toString());
     *         console.log(" inputArgumentResults[1] = ",callResult.inputArgumentResults[1].toString());
     *         console.log(" outputArgument[0]       = ",callResult.outputArgument[0].toString()); // array of variant
     *    }
     * });
     * ```
     *
     * @method call
     *
     * @param methodsToCall {CallMethodRequest[]} the call method request array
     * @param callbackstad
     *
     *
     * @example :
     *
     * ```javascript
     * const methodsToCall = [ {
     *     objectId: "ns=2;i=12",
     *     methodId: "ns=2;i=13",
     *     inputArguments: [
     *         new Variant({...}),
     *         new Variant({...}),
     *     ]
     * }];
     * session.call(methodsToCall,function(err,callResutls) {
     *    if (!err) {
     *         const callResult = callResutls[0];
     *         console.log(" statusCode = ",rep.statusCode);
     *         console.log(" inputArgumentResults[0] = ",callResult.inputArgumentResults[0].toString());
     *         console.log(" inputArgumentResults[1] = ",callResult.inputArgumentResults[1].toString());
     *         console.log(" outputArgument[0]       = ",callResult.outputArgument[0].toString()); // array of variant
     *    }
     * });
     * ```
     */

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

// raw subscription services
export interface ClientSession {

    /**
     * @method createSubscription
     * @async
     *
     * @example
     *
     *    ```ts
     *    const options = {
     *      requestedPublishingInterval: 1000,
     *      requestedLifetimeCount:      2000,
     *      requestedMaxKeepAliveCount:    10,
     *      maxNotificationsPerPublish:  1000,
     *      publishingEnabled:           true,
     *      priority:                    128
     *    };
     *    const response = await session.createSubscription(options);
     *    ```
     */
    createSubscription(
      options: CreateSubscriptionRequestLike,
      callback: ResponseCallback<CreateSubscriptionResponse>
    ): void;

    createSubscription(
      options: CreateSubscriptionRequestLike
    ): Promise<CreateSubscriptionResponse>;

    setMonitoringMode(
      options: SetMonitoringModeRequestLike,
      callback: ResponseCallback<SetMonitoringModeResponse>
    ): void;

    setMonitoringMode(
      options: SetMonitoringModeRequestLike
    ): Promise<SetMonitoringModeResponse>;

    createMonitoredItems(
      options: CreateMonitoredItemsRequestLike,
      callback: ResponseCallback<CreateMonitoredItemsResponse>
    ): void;

    createMonitoredItems(
      options: CreateMonitoredItemsRequestLike
    ): Promise<CreateMonitoredItemsResponse>;

    modifySubscription(
      options: ModifySubscriptionRequestLike,
      callback: ResponseCallback<ModifySubscriptionResponse>
    ): void;

    modifySubscription(
      options: ModifySubscriptionRequestLike
    ): Promise<ModifySubscriptionResponse>;

    transferSubscriptions(
      options: TransferSubscriptionsRequestLike,
      callback?: ResponseCallback<TransferSubscriptionsResponse>
    ): void;

    transferSubscriptions(
      options: TransferSubscriptionsRequestLike
    ): Promise<TransferSubscriptionsResponse>;

    deleteSubscriptions(
      options: DeleteSubscriptionsRequestLike,
      callback?: ResponseCallback<DeleteSubscriptionsResponse>
    ): void;

    deleteSubscriptions(
      options: DeleteSubscriptionsRequestLike
    ): Promise<DeleteSubscriptionsResponse>;

    /**
     *
     * @method modifyMonitoredItems
     * @async
     */
    modifyMonitoredItems(
      options: ModifyMonitoredItemsRequestLike,
      callback?: ResponseCallback<ModifyMonitoredItemsResponse>
    ): void;

    modifyMonitoredItems(
      options: ModifyMonitoredItemsRequestLike)
      : Promise<ModifyMonitoredItemsResponse>;

    createSubscription2(
      createSubscriptionRequest: CreateSubscriptionRequestLike
    ): Promise<ClientSubscription>;

    createSubscription2(
      createSubscriptionRequest: CreateSubscriptionRequestLike,
      callback: ResponseCallback<ClientSubscription>
    ): void;

    getMonitoredItems(
      subscriptionId: SubscriptionId
    ): Promise<MonitoredItemData>;

    getMonitoredItems(
      subscriptionId: SubscriptionId,
      callback: ResponseCallback<MonitoredItemData>
    ): void;
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

export interface ClientSession {

    /**
     * retrieve the built-in DataType of a Variable, from its DataType attribute.
     *
     *
     * this method is useful to determine which DataType to use when constructing a Variant
     * @param nodeId - the node id of the variable to query
     * @async
     *
     *
     * @example
     *
     * ```javascript
     * const session = ...; // ClientSession
     * const nodeId = opcua.VariableIds.Server_ServerStatus_CurrentTime;
     * session.getBuildInDataType(nodeId,function(err,dataType) {
     *   assert(dataType === opcua.DataType.DateTime);
     * });
     * // or
     * nodeId = opcua.coerceNodeId("ns=2;s=Scalar_Static_ImagePNG");
     * const dataType: await session.getBuildInDataType(nodeId);
     * assert(dataType === opcua.DataType.ByteString);
     * ```
     */
    getBuiltInDataType(nodeId: NodeId): Promise<DataType>;

    getBuiltInDataType(nodeId: NodeId, callback: (err: Error | null, dataType?: DataType) => void): void;

}

export interface ClientSession {

    disableCondition(): void;

    enableCondition(): void;

    /**
     * helper to add a comment to a condition
     *
     * The AddComment Method is used to apply a comment to a specific state of a Condition instance.
     *
     * Normally, the NodeId of the object instance as the ObjectId is passed to the Call Service.
     *
     * However, some Servers do not expose Condition instances in the AddressSpace. Therefore all Servers
     * shall also allow Clients to call the AddComment Method by specifying ConditionId as the ObjectId.
     *
     * The Method cannot be called with an ObjectId of the ConditionType Node.
     *
     * ### Notes:
     * * Comments are added to Event occurrences identified via an EventId. EventIds where the related EventType
     * is not a ConditionType (or subtype of it) and thus does not support Comments are rejected.
     * * A ConditionEvent – where the Comment Variable contains this text – will be sent for the identified
     * state. If a comment is added to a previous state (i.e. a state for which the Server has created a
     * branch), the BranchId and all Condition values of this branch will be reported/.
     *
     */
    addCommentCondition(
      conditionId: NodeIdLike,
      eventId: Buffer,
      comment: LocalizedTextLike,
      callback: ErrorCallback
    ): void;

    addCommentCondition(
      conditionId: NodeIdLike,
      eventId: Buffer,
      comment: LocalizedTextLike
    ): Promise<void>;

    /**
     * helper to confirm a condition
     *
     * >> from Spec 1.03 Part 9 : page 27
     *    The Confirm Method is used to confirm an Event Notifications for a Condition instance state
     *    where ConfirmedState is FALSE.
     *
     *    Normally, the NodeId of the object instance as the ObjectId is passed to the Call Service.
     *
     *    However, some Servers do not expose Condition instances in the AddressSpace.
     *
     *    Therefore all Servers shall also allow Clients to call the Confirm Method by specifying ConditionId
     *    as the ObjectId.
     *
     *    The Method cannot be called with an ObjectId of the AcknowledgeableConditionType Node.
     * @param conditionId
     * @param eventId
     * @param comment
     * @param callback
     */
    confirmCondition(
      conditionId: NodeIdLike,
      eventId: Buffer,
      comment: LocalizedTextLike,
      callback: (err?: Error) => void
    ): void;

    confirmCondition(
      conditionId: NodeIdLike,
      eventId: Buffer,
      comment: LocalizedTextLike
    ): Promise<void>;

    /**
     * helper to acknowledge a condition
     *
     * >>> from Spec 1.03 Part 9 : page 27
     *
     *   The Acknowledge Method is used to acknowledge an Event Notification for a Condition
     *   instance state where AckedState is false.
     *
     *   Normally, the NodeId of the object instance as the ObjectId is passed to the Call Service.
     *
     *   However, some Servers do not expose Condition instances in the AddressSpace.
     *
     *   Therefore all Servers shall also allow Clients to call the Acknowledge Method by specifying ConditionId
     *   as the ObjectId.
     *
     *   The Method cannot be called with an ObjectId of the AcknowledgeableConditionType Node.
     *
     *   A Condition instance may be an Object that appears in the Server Address Space. If this is
     *   the case the ConditionId is the NodeId for the Object.
     *
     *   The EventId identifies a specific Event Notification where a state to be acknowledged was
     *   reported.
     *
     *   Acknowledgement and the optional comment will be applied to the state identified
     *   with the EventId. If the comment field is NULL (both locale and text are empty) it will be
     *   ignored and any existing comments will remain unchanged. If the comment is to be reset, an
     *   empty text with a locale shall be provided.
     *
     *   A valid EventId will result in an Event Notification where AckedState/Id is set to TRUE and the
     *   Comment Property contains the text of the optional comment argument. If a previous state is
     *   acknowledged, the BranchId and all Condition values of this branch will be reported.
     *
     * @param conditionId
     * @param eventId
     * @param comment
     * @param callback
     */
    acknowledgeCondition(
      conditionId: NodeId,
      eventId: Buffer,
      comment: LocalizedTextLike,
      callback: ErrorCallback): void;

    acknowledgeCondition(
      conditionId: NodeId,
      eventId: Buffer,
      comment: LocalizedTextLike
    ): Promise<void>;

    /**
     * @method findMethodId
     *
     * @param nodeId      the nodeId of the parent Object
     * @param methodName  the method name
     * @param callback
     */
    findMethodId(
      nodeId: NodeIdLike,
      methodName: string,
      callback: ResponseCallback<NodeId>
    ): void;

    findMethodId(
      nodeId: NodeIdLike,
      methodName: string
    ): Promise<NodeId>;

}
