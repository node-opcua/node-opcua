/**
 * @module node-opcua-client
 */

import { EventEmitter } from "events";

import { DateTime, UInt8 } from "node-opcua-basic-types";
import { ServerState } from "node-opcua-common";
import { Certificate } from "node-opcua-crypto";
import { LocalizedTextLike } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import {
    IBasicSession,
    IBasicSessionBrowse,
    IBasicSessionBrowseNext,
    IBasicSessionCall,
    IBasicSessionRead,
    IBasicSessionTranslateBrowsePath,
    IBasicSessionWrite,
    ResponseCallback
} from "node-opcua-pseudo-session";
import { ErrorCallback } from "node-opcua-status-code";
import { EndpointDescription } from "node-opcua-service-endpoints";
import { HistoryReadResult } from "node-opcua-service-history";
import { QueryFirstRequestOptions, QueryFirstResponse } from "node-opcua-service-query";
import {
    CreateMonitoredItemsRequestOptions,
    CreateMonitoredItemsResponse,
    CreateSubscriptionRequestOptions,
    CreateSubscriptionResponse,
    DeleteMonitoredItemsRequestOptions,
    DeleteMonitoredItemsResponse,
    DeleteSubscriptionsRequestOptions,
    DeleteSubscriptionsResponse,
    ModifyMonitoredItemsRequestOptions,
    ModifyMonitoredItemsResponse,
    ModifySubscriptionRequestOptions,
    ModifySubscriptionResponse,
    PublishRequest,
    PublishResponse,
    RepublishRequest,
    RepublishResponse,
    SetMonitoringModeRequestOptions,
    SetMonitoringModeResponse,
    TransferSubscriptionsRequestOptions,
    TransferSubscriptionsResponse,
    SetTriggeringResponse,
    SetTriggeringRequestOptions
} from "node-opcua-service-subscription";
import { StatusCode } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import { Callback } from "node-opcua-status-code";
import { IBasicSessionChangeUser } from "node-opcua-pseudo-session";
import { ExtensionObject } from "node-opcua-extension-object";
import { ArgumentDefinition, MethodId } from "node-opcua-pseudo-session";
import { AggregateFunction } from "node-opcua-constants";
import {
    AggregateConfigurationOptions,
    HistoryReadRequest,
    HistoryReadResponse,
    HistoryReadValueIdOptions
} from "node-opcua-types";

import { ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";
export { ExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object";

export { ExtensionObject } from "node-opcua-extension-object";
export { ArgumentDefinition, CallMethodRequestLike, MethodId } from "node-opcua-pseudo-session";

import { ClientSubscription } from "./client_subscription";


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

export type DeleteMonitoredItemsRequestLike = DeleteMonitoredItemsRequestOptions;
export type CreateSubscriptionRequestLike = CreateSubscriptionRequestOptions;
export type DeleteSubscriptionsRequestLike = DeleteSubscriptionsRequestOptions;
export type TransferSubscriptionsRequestLike = TransferSubscriptionsRequestOptions;
export type CreateMonitoredItemsRequestLike = CreateMonitoredItemsRequestOptions;
export type ModifyMonitoredItemsRequestLike = ModifyMonitoredItemsRequestOptions;
export type ModifySubscriptionRequestLike = ModifySubscriptionRequestOptions;
export type SetMonitoringModeRequestLike = SetMonitoringModeRequestOptions;
export type QueryFirstRequestLike = QueryFirstRequestOptions;

export type SubscriptionId = number;

export interface ClientSessionBase {
    // properties
    /** the session Id */
    timeout: number;
    authenticationToken?: NodeId;
    sessionId: NodeId;
    subscriptionCount: number;
    isReconnecting: boolean;
    endpoint: EndpointDescription;
    /**
     * the time of the latest request sent by the client to the server
     */
    lastRequestSentTime: Date;
    /**
     * the time of the latest response received by the client
     */
    lastResponseReceivedTime: Date;
    /**
     * the server certificate as provided by the server
     */
    serverCertificate: Certificate;
    /**
     * the session name
     */
    name: string;

    close(callback: ErrorCallback): void;

    close(deleteSubscription: boolean, callback: ErrorCallback): void;

    close(deleteSubscription?: boolean): Promise<void>;
}

export interface ClientSession extends ClientSessionBase {
    /* */
    serverEndpoints: EndpointDescription[];
}
// events
export interface ClientSession extends EventEmitter {
    // tslint:disable:unified-signatures
    on(event: "keepalive", eventHandler: (lastKnownServerState: ServerState) => void): this;

    on(event: "keepalive_failure", eventHandler: (state: any) => void): this;

    on(event: "session_closed", eventHandler: (statusCode: StatusCode) => void): this;

    /**
     *  session_restored is raised when the session and related subscription
     *  have been fully repaired after a reconnection.
     */
    on(event: "session_restored", eventHandler: () => void): this;

    on(event: string | symbol, listener: (...args: any[]) => void): this;
}

// browse services
export interface ClientSessionBrowseService extends IBasicSessionBrowse, IBasicSessionBrowseNext {
    /**
     * the maximum number of reference that the server should return per browseResult
     * Continuous points will be return by server to allow retrieving remaining references
     * with browseNext
     */
    requestedMaxReferencesPerNode: number;

  }

// translate browsePathTo NodeId services
export interface ClientSessionTranslateBrowsePathService extends IBasicSessionTranslateBrowsePath {
}

// query services
export interface ClientSessionQueryService {
    queryFirst(queryFirstRequest: QueryFirstRequestLike): Promise<QueryFirstResponse>;

    queryFirst(queryFirstRequest: QueryFirstRequestLike, callback: ResponseCallback<QueryFirstResponse>): void;
}

// call services
export interface ClientSessionCallService extends IBasicSessionCall {
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
     * @param callback
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
     * session.call(methodsToCall,function(err,callResults) {
     *    if (!err) {
     *         const callResult = callResults[0];
     *         console.log(" statusCode = ",rep.statusCode);
     *         console.log(" inputArgumentResults[0] = ",callResult.inputArgumentResults[0].toString());
     *         console.log(" inputArgumentResults[1] = ",callResult.inputArgumentResults[1].toString());
     *         console.log(" outputArgument[0]       = ",callResult.outputArgument[0].toString()); // array of variant
     *    }
     * });
     * ```
     */


    getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;

    getArgumentDefinition(methodId: MethodId, callback: (err: Error | null, args?: ArgumentDefinition) => void): void;
}

// register services
export interface ClientSessionRegisterService {
    registerNodes(nodesToRegister: NodeIdLike[]): Promise<NodeId[]>;

    registerNodes(nodesToRegister: NodeIdLike[], callback: (err: Error | null, registeredNodeIds?: NodeId[]) => void): void;

    unregisterNodes(nodesToRegister: NodeIdLike[]): Promise<void>;

    unregisterNodes(nodesToRegister: NodeIdLike[], callback: (err?: Error) => void): void;
}

// read services
export interface ClientSessionReadService extends IBasicSessionRead {
  
    /**
     * @deprecated
     */
    readVariableValue(nodeId: NodeIdLike, callback: ResponseCallback<DataValue>): void;
    /**
     * @deprecated
     */
    readVariableValue(nodeId: NodeIdLike): Promise<DataValue>;
    /**
     * @deprecated
     */
    readVariableValue(nodeIds: NodeIdLike[], callback: ResponseCallback<DataValue[]>): void;
    /**
     * @deprecated
     */
    readVariableValue(nodeIds: NodeIdLike[]): Promise<DataValue[]>;
}

// write services
export interface ClientSessionWriteService extends IBasicSessionWrite {


    /**
     * @deprecated
     */
    writeSingleNode(nodeToWrite: NodeIdLike, value: Variant): Promise<StatusCode>;

    /**
     * @deprecated
     */
    writeSingleNode(nodeToWrite: NodeIdLike, value: Variant, callback: ResponseCallback<StatusCode>): void;
}

// raw subscription services
export interface ClientSessionRawSubscriptionService {
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
    createSubscription(options: CreateSubscriptionRequestLike, callback: ResponseCallback<CreateSubscriptionResponse>): void;

    createSubscription(options: CreateSubscriptionRequestLike): Promise<CreateSubscriptionResponse>;

    setMonitoringMode(options: SetMonitoringModeRequestLike, callback: ResponseCallback<SetMonitoringModeResponse>): void;

    setMonitoringMode(options: SetMonitoringModeRequestLike): Promise<SetMonitoringModeResponse>;

    createMonitoredItems(options: CreateMonitoredItemsRequestLike, callback: ResponseCallback<CreateMonitoredItemsResponse>): void;

    createMonitoredItems(options: CreateMonitoredItemsRequestLike): Promise<CreateMonitoredItemsResponse>;

    modifySubscription(options: ModifySubscriptionRequestLike, callback: ResponseCallback<ModifySubscriptionResponse>): void;

    modifySubscription(options: ModifySubscriptionRequestLike): Promise<ModifySubscriptionResponse>;

    transferSubscriptions(
        options: TransferSubscriptionsRequestLike,
        callback?: ResponseCallback<TransferSubscriptionsResponse>
    ): void;

    transferSubscriptions(options: TransferSubscriptionsRequestLike): Promise<TransferSubscriptionsResponse>;

    deleteSubscriptions(options: DeleteSubscriptionsRequestLike, callback?: ResponseCallback<DeleteSubscriptionsResponse>): void;

    deleteSubscriptions(options: DeleteSubscriptionsRequestLike): Promise<DeleteSubscriptionsResponse>;

    /**
     *
     * @method modifyMonitoredItems
     * @async
     */
    modifyMonitoredItems(options: ModifyMonitoredItemsRequestLike, callback?: ResponseCallback<ModifyMonitoredItemsResponse>): void;

    modifyMonitoredItems(options: ModifyMonitoredItemsRequestLike): Promise<ModifyMonitoredItemsResponse>;

    getMonitoredItems(subscriptionId: SubscriptionId): Promise<MonitoredItemData>;

    getMonitoredItems(subscriptionId: SubscriptionId, callback: ResponseCallback<MonitoredItemData>): void;

    deleteMonitoredItems(request: DeleteMonitoredItemsRequestLike, callback: Callback<DeleteMonitoredItemsResponse>): void;

    deleteMonitoredItems(request: DeleteMonitoredItemsRequestLike): Promise<DeleteMonitoredItemsResponse>;

    setTriggering(request: SetTriggeringRequestOptions): Promise<SetTriggeringResponse>;
    setTriggering(request: SetTriggeringRequestOptions, callback: ResponseCallback<SetTriggeringResponse>): void;
}

// subscription service
export interface ClientSessionSubscriptionService {
    createSubscription2(createSubscriptionRequest: CreateSubscriptionRequestLike): Promise<ClientSubscription>;

    createSubscription2(
        createSubscriptionRequest: CreateSubscriptionRequestLike,
        callback: ResponseCallback<ClientSubscription>
    ): void;
}

export interface ClientSessionChangeUser extends IBasicSessionChangeUser {
    /* */
}

export interface HistoryReadValueIdOptions2 extends HistoryReadValueIdOptions {
    nodeId: NodeIdLike; // nodeId is mandatory here
}

export interface ExtraReadHistoryValueParameters {
    numValuesPerNode?: number;
    returnBounds?: boolean;
    isReadModified?: boolean;
    //
    timestampsToReturn?: TimestampsToReturn;
}

// history services
export interface ClientSessionReadHistoryService {
    readHistoryValue(
        nodesToRead: NodeIdLike[] | HistoryReadValueIdOptions2[],
        start: DateTime,
        end: DateTime,
        callback: (err: Error | null, results?: HistoryReadResult[]) => void
    ): void;
    readHistoryValue(
        nodesToRead: NodeIdLike[] | HistoryReadValueIdOptions2[],
        start: DateTime,
        end: DateTime,
        options: ExtraReadHistoryValueParameters | undefined,
        callback: (err: Error | null, results?: HistoryReadResult[]) => void
    ): void;

    readHistoryValue(
        nodesToRead: NodeIdLike[] | HistoryReadValueIdOptions2[],
        start: DateTime,
        end: DateTime,
        options?: ExtraReadHistoryValueParameters
    ): Promise<HistoryReadResult[]>;

    readHistoryValue(
        nodeToRead: NodeIdLike | HistoryReadValueIdOptions2,
        start: DateTime,
        end: DateTime,
        callback: (err: Error | null, result?: HistoryReadResult) => void
    ): void;
    readHistoryValue(
        nodeToRead: NodeIdLike | HistoryReadValueIdOptions2,
        start: DateTime,
        end: DateTime,
        options: ExtraReadHistoryValueParameters | undefined,
        callback: (err: Error | null, result?: HistoryReadResult) => void
    ): void;

    readHistoryValue(
        nodeToRead: NodeIdLike | HistoryReadValueIdOptions2,
        start: DateTime,
        end: DateTime,
        options?: ExtraReadHistoryValueParameters
    ): Promise<HistoryReadResult>;

    /**
     * @method readAggregateValue
     * @async
     *
     * @example
     *
     * ```javascript
     * //  es5
     * session.readAggregateValue(
     *   {nodeId: "ns=5;s=Simulation Examples.Functions.Sine1" },
     *   new Date("2015-06-10T09:00:00.000Z"),
     *   new Date("2015-06-10T09:01:00.000Z"),
     *  AggregateFunction.Average, 3600000, (err,dataValues)  => {
     *
     * });
     * ```
     *
     * ```javascript
     * //  es6
     * const dataValues = await session.readAggregateValue(
     *   { nodeId: "ns=5;s=Simulation Examples.Functions.Sine1" },
     *   new Date("2015-06-10T09:00:00.000Z"),
     *   new Date("2015-06-10T09:01:00.000Z"),
     *   AggregateFunction.Average, 3600000);
     * ```
     * @param nodes   the read value id
     * @param startTime   the start time in UTC format
     * @param endTime     the end time in UTC format
     * @param aggregateFn
     * @param processingInterval in milliseconds
     * @param callback
     *
     *
     * aggregateConfiguration contains additional parameters
     *
     * - The TreatUncertainAsBad Variable indicates how the Server treats data returned with a
     *   StatusCode severity Uncertain with respect to Aggregate calculations. A value of True
     *   indicates the Server considers the severity equivalent to Bad, a value of False indicates
     *   the Server considers the severity equivalent to Good, unless the Aggregate definition says
     *   otherwise. The default value is True. Note that the value is still treated as Uncertain when
     *   the StatusCode for the result is calculated.
     *
     * - The PercentDataBad Variable indicates the minimum percentage of Bad data in a given interval
     *   required for the StatusCode for the given interval for processed data request to be set to Bad.
     *   (Uncertain is treated as defined above.) Refer to 5.4.3 for details on using this Variable when
     *   assigning StatusCodes. For details on which Aggregates use the PercentDataBad Variable, see the
     *   definition of each Aggregate. The default value is 100.
     *
     * - The PercentDataGood Variable indicates the minimum percentage of Good data in a given interval
     *   required for the StatusCode for the given interval for the processed data requests to be set to
     *   Good. Refer to 5.4.3 for details on using this Variable when assigning StatusCodes. For details
     *   on which Aggregates use the PercentDataGood Variable, see the definition of each Aggregate.
     *   The default value is 100.
     *
     * - The PercentDataGood and PercentDataBad shall follow the following relationship
     *         PercentDataGood ≥ (100 – PercentDataBad).
     *   If they are equal the result of the PercentDataGood calculation is used. If the values
     *   entered for PercentDataGood and PercentDataBad do not result in a valid calculation
     *   (e.g. Bad = 80; Good = 0) the result will have a StatusCode of Bad_AggregateInvalidInputs
     *   The StatusCode Bad_AggregateInvalidInputs will be returned if the value of PercentDataGood
     *   or PercentDataBad exceed 100.
     *
     * - The UseSlopedExtrapolation Variable indicates how the Server interpolates data when no boundary
     *   value exists (i.e. extrapolating into the future from the last known value). A value of False
     *   indicates that the Server will use a SteppedExtrapolation format, and hold the last known value
     *   constant. A value of True indicates the Server will project the value using UseSlopedExtrapolation
     *   mode. The default value is False. For SimpleBounds this value is ignored.
     *
     */
    readAggregateValue(
        nodesToRead: HistoryReadValueIdOptions[],
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction[],
        processingInterval: number,
        callback: Callback<HistoryReadResult[]>
    ): void;
    readAggregateValue(
        nodesToRead: HistoryReadValueIdOptions[],
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction[],
        processingInterval: number
    ): Promise<HistoryReadResult[]>;
    readAggregateValue(
        nodeToRead: HistoryReadValueIdOptions,
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction,
        processingInterval: number,
        callback: Callback<HistoryReadResult>
    ): void;
    readAggregateValue(
        nodeToRead: HistoryReadValueIdOptions,
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction,
        processingInterval: number
    ): Promise<HistoryReadResult>;
    readAggregateValue(
        nodesToRead: HistoryReadValueIdOptions[],
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction[],
        processingInterval: number,
        aggregateConfiguration: AggregateConfigurationOptions,
        callback: Callback<HistoryReadResult[]>
    ): void;
    readAggregateValue(
        nodesToRead: HistoryReadValueIdOptions[],
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction[],
        processingInterval: number,
        aggregateConfiguration: AggregateConfigurationOptions
    ): Promise<HistoryReadResult[]>;
    readAggregateValue(
        nodeToRead: HistoryReadValueIdOptions,
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction,
        processingInterval: number,
        aggregateConfiguration: AggregateConfigurationOptions,
        callback: Callback<HistoryReadResult>
    ): void;
    readAggregateValue(
        nodeToRead: HistoryReadValueIdOptions,
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction,
        processingInterval: number,
        aggregateConfiguration: AggregateConfigurationOptions
    ): Promise<HistoryReadResult>;

    historyRead(request: HistoryReadRequest, callback: Callback<HistoryReadResponse>): void;
    historyRead(request: HistoryReadRequest): Promise<HistoryReadResponse>;
}

export interface ClientSessionDataTypeService {
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
     * session.getBuiltInDataType(nodeId,function(err,dataType) {
     *   assert(dataType === opcua.DataType.DateTime);
     * });
     * // or
     * nodeId = opcua.coerceNodeId("ns=2;s=Static_Scalar_ImagePNG");
     * const dataType: await session.getBuiltInDataType(nodeId);
     * assert(dataType === opcua.DataType.ByteString);
     * ```
     */
    getBuiltInDataType(nodeId: NodeId): Promise<DataType>;

    getBuiltInDataType(nodeId: NodeId, callback: (err: Error | null, dataType?: DataType) => void): void;
}

export interface ClientSessionNamespaceService {
    getNamespaceIndex(namespaceUri: string): number;

    readNamespaceArray(): Promise<string[]>;

    readNamespaceArray(callback: (err: Error | null, namespaceArray?: string[]) => void): void;
}

export interface ClientSessionExtensionObjectService {
    constructExtensionObject(dataType: NodeId, pojo: Record<string, unknown>): Promise<ExtensionObject>;

    /**
     * @private
     */
    extractNamespaceDataType(): Promise<ExtraDataTypeManager>;
}

export interface ClientSessionConditionService {
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
    addCommentCondition(conditionId: NodeIdLike, eventId: Buffer, comment: LocalizedTextLike, callback: Callback<StatusCode>): void;

    addCommentCondition(conditionId: NodeIdLike, eventId: Buffer, comment: LocalizedTextLike): Promise<StatusCode>;

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
    confirmCondition(conditionId: NodeIdLike, eventId: Buffer, comment: LocalizedTextLike, callback: Callback<StatusCode>): void;

    confirmCondition(conditionId: NodeIdLike, eventId: Buffer, comment: LocalizedTextLike): Promise<StatusCode>;

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
    acknowledgeCondition(conditionId: NodeId, eventId: Buffer, comment: LocalizedTextLike, callback: Callback<StatusCode>): void;

    acknowledgeCondition(conditionId: NodeId, eventId: Buffer, comment: LocalizedTextLike): Promise<StatusCode>;

    /**
     * @method findMethodId
     *
     * @param nodeId      the nodeId of the parent Object
     * @param methodName  the method name 
     * @param callback
     * 
     * note: 
     *   - methodName is a browse name and may therefore be prefixed with a namespace index.
     *   - if method is not found on the object specified by nodeId, then the findMethodId will
     *     recursively browse up the hierarchy of object typeDefinition Node 
     *     until it reaches the root type. and try to find the first method that matches the
     *     provided name.
     * 
     * @deprecated use global findMethodId(session, nodeId, methoName): Promise<NodeId> instead
     */
    findMethodId(nodeId: NodeIdLike, methodName: string, callback: ResponseCallback<NodeId>): void;

    findMethodId(nodeId: NodeIdLike, methodName: string): Promise<NodeId>;
}

// publish Server
export interface ClientSessionPublishService {
    publish(options: PublishRequest, callback: ResponseCallback<PublishResponse>): void;
    republish(options: RepublishRequest, callback: ResponseCallback<RepublishResponse>): void;
}

export interface ClientSession
    extends ClientSessionTranslateBrowsePathService,
        ClientSessionQueryService,
        ClientSessionBrowseService,
        // ClientSessionRawSubscriptionService,
        ClientSessionSubscriptionService,
        ClientSessionCallService,
        ClientSessionRegisterService,
        ClientSessionReadService,
        // ClientSessionWriteService,
        ClientSessionReadHistoryService,
        ClientSessionConditionService,
        ClientSessionExtensionObjectService,
        ClientSessionNamespaceService,
        ClientSessionDataTypeService,
        ClientSessionChangeUser,
        IBasicSession {}
