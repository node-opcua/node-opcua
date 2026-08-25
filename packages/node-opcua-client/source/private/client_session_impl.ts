/**
 * @module node-opcua-client-private
 */

import { EventEmitter } from "node:events";
import chalk from "chalk";
import { assert } from "node-opcua-assert";
import type { DateTime } from "node-opcua-basic-types";
import {
    type ExtraDataTypeManager,
    extractDataValueToPromote,
    getExtensionObjectConstructor,
    getExtraDataTypeManager,
    type PseudoDataValue,
    promoteOpaqueStructure
} from "node-opcua-client-dynamic-extension-object";
import type { AggregateFunction } from "node-opcua-constants";
import type { Certificate, Nonce } from "node-opcua-crypto/web";
import { BrowseDirection, type LocalizedTextLike } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import type { ExtensionObject } from "node-opcua-extension-object";
import { coerceNodeId, NodeId, type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import {
    type BrowseDescriptionLike,
    getArgumentDefinitionHelper,
    getBuiltInDataType,
    type IBasicSessionAsync2,
    type IBasicTransportSettings,
    type NodeAttributes,
    type ResponseCallback,
    readAllAttributes,
    readNamespaceArray
} from "node-opcua-pseudo-session";
import type { AnyConstructorFunc } from "node-opcua-schemas";
import {
    type ServiceFaultAnnotatedError as ChannelServiceFaultAnnotatedError,
    ClientSecureChannelLayer,
    requestHandleNotSetValue,
    type SignatureData
} from "node-opcua-secure-channel";
import { BrowseDescription, BrowseRequest, BrowseResponse, BrowseResult } from "node-opcua-service-browse";
import { CallMethodRequest, type CallMethodResult, CallRequest, CallResponse } from "node-opcua-service-call";
import type { EndpointDescription } from "node-opcua-service-endpoints";
import {
    HistoryData,
    HistoryReadRequest,
    HistoryReadResponse,
    type HistoryReadResult,
    ReadProcessedDetails,
    ReadRawModifiedDetails
} from "node-opcua-service-history";
import { QueryFirstRequest, QueryFirstResponse } from "node-opcua-service-query";
import {
    AttributeIds,
    ReadRequest,
    ReadResponse,
    ReadValueId,
    type ReadValueIdOptions,
    TimestampsToReturn
} from "node-opcua-service-read";
import {
    RegisterNodesRequest,
    RegisterNodesResponse,
    UnregisterNodesRequest,
    UnregisterNodesResponse
} from "node-opcua-service-register-node";
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
    SetTriggeringRequest,
    type SetTriggeringRequestOptions,
    SetTriggeringResponse,
    TransferSubscriptionsRequest,
    TransferSubscriptionsResponse
} from "node-opcua-service-subscription";
import {
    type BrowsePath,
    type BrowsePathResult,
    TranslateBrowsePathsToNodeIdsRequest,
    TranslateBrowsePathsToNodeIdsResponse
} from "node-opcua-service-translate-browse-path";
import { WriteRequest, WriteResponse, WriteValue } from "node-opcua-service-write";
import { type Callback, type CallbackT, type ErrorCallback, type StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    ActivateSessionRequest,
    type AggregateConfigurationOptions,
    BrowseNextRequest,
    BrowseNextResponse,
    CloseSessionRequest,
    type HistoryReadValueIdOptions,
    UserTokenType,
    type WriteValueOptions
} from "node-opcua-types";
import { buffer_ellipsis, getFunctionParameterNames, isNullOrUndefined } from "node-opcua-utils";
import { DataType, type Variant, type VariantLike } from "node-opcua-variant";

import type {
    ArgumentDefinition,
    CallMethodRequestLike,
    ClientSession,
    CreateMonitoredItemsRequestLike,
    CreateSubscriptionRequestLike,
    DeleteMonitoredItemsRequestLike,
    DeleteSubscriptionsRequestLike,
    ExtraReadHistoryValueParameters,
    HistoryReadValueIdOptions2,
    MethodId,
    ModifyMonitoredItemsRequestLike,
    ModifySubscriptionRequestLike,
    MonitoredItemData,
    QueryFirstRequestLike,
    SetMonitoringModeRequestLike,
    SubscriptionId,
    TransferSubscriptionsRequestLike
} from "../client_session";
import { ClientSessionKeepAliveManager } from "../client_session_keepalive_manager";
import type { ClientSubscription } from "../client_subscription";
import type { Request, Response } from "../common";
import type { UserIdentityInfo } from "../user_identity_info";

import { ClientSidePublishEngine } from "./client_publish_engine";
import { ClientSubscriptionImpl } from "./client_subscription_impl";
import type { IClientBase } from "./i_private_client";
import { repair_client_session } from "./reconnection/reconnection";

const helpAPIChange = process.env.DEBUG?.match(/API/);
const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);
const _errorLog = make_errorLog(__filename);

let pendingTransactionMessageDisplayed = false;

function coerceBrowseDescription(data: BrowseDescriptionLike | NodeId): BrowseDescription {
    if (typeof data === "string" || data instanceof NodeId) {
        return coerceBrowseDescription({
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: 0,
            nodeId: data,
            referenceTypeId: "HierarchicalReferences",
            resultMask: 63
        });
    } else {
        const options = data as { nodeId: NodeIdLike; referenceTypeId?: NodeIdLike | null };
        options.nodeId = resolveNodeId(options.nodeId);
        options.referenceTypeId = options.referenceTypeId ? resolveNodeId(options.referenceTypeId) : null;
        return new BrowseDescription(options);
    }
}

function coerceReadValueId(node: unknown): ReadValueId {
    if (typeof node === "string" || node instanceof NodeId) {
        return new ReadValueId({
            attributeId: AttributeIds.Value,
            dataEncoding: undefined, // {namespaceIndex: 0, name: undefined}
            indexRange: undefined,
            nodeId: resolveNodeId(node)
        });
    } else {
        assert(node instanceof Object);
        return new ReadValueId(node as ReadValueIdOptions);
    }
}

const emptyUint32Array = new Uint32Array(0);

type EmptyCallback = (err?: Error) => void;

// re-exported from node-opcua-secure-channel, where the annotation is produced
// (see process_request_callback): response / request / serviceDiagnostics / diagnosticsInfo.
type ServiceFaultAnnotatedError = ChannelServiceFaultAnnotatedError;

/**
 * attach the server side diagnostics to an error, so that a caller can inspect them without
 * having to know how the channel delivered the failure.
 *
 * For a ServiceFault there is no `response` argument at all - the channel moved the decoded
 * fault onto `err.response` - so fall back to it, otherwise the diagnostics of the most
 * interesting case would always be dropped.
 */
function annotateWithDiagnostics(err: Error, response?: Response): Error {
    const annotatedError = err as ServiceFaultAnnotatedError;
    const source = response ?? annotatedError.response;
    if (source?.responseHeader.serviceDiagnostics) {
        annotatedError.serviceDiagnostics = source.responseHeader.serviceDiagnostics;
    }
    const responseWithDiagnosticInfos = source as unknown as { diagnosticInfos?: unknown } | undefined;
    if (responseWithDiagnosticInfos?.diagnosticInfos) {
        annotatedError.diagnosticsInfo = responseWithDiagnosticInfos.diagnosticInfos;
    }
    return annotatedError;
}

export interface Reconnectable {
    _reconnecting: {
        reconnecting: boolean;
        pendingCallbacks: EmptyCallback[];
        pendingTransactions: { request: Request; callback: (err: Error | null, response?: Response) => void }[];
    };
}

/**
 * @class ClientSession
 */
export class ClientSessionImpl extends EventEmitter implements ClientSession, Reconnectable {
    static reconnectingElement: WeakMap<ClientSessionImpl, Reconnectable> = new WeakMap();
    public timeout: number;
    public authenticationToken?: NodeId;
    public requestedMaxReferencesPerNode: number;
    public sessionId: NodeId;
    public lastRequestSentTime: Date;
    public lastResponseReceivedTime: Date;
    public serverCertificate: Certificate;
    public userIdentityInfo?: UserIdentityInfo;
    public name = "";
    public serverNonce?: Nonce;
    public serverSignature?: SignatureData; // todo : remove ?
    public serverEndpoints: EndpointDescription[] = [];
    public lastActivateSessionStatusCode: StatusCode = StatusCodes.Good;
    public _client: IClientBase | null;
    public _closed: boolean;

    public _reconnecting: {
        reconnecting: boolean;
        pendingCallbacks: EmptyCallback[];
        pendingTransactions: { request: Request; callback: (err: Error | null, response?: Response) => void }[];
    };

    /**
     * @internal
     */
    public _closeEventHasBeenEmitted: boolean;
    private _publishEngine: ClientSidePublishEngine | null;
    private _keepAliveManager?: ClientSessionKeepAliveManager;
    private $$namespaceArray?: string[];
    private recursive_repair_detector = 0;

    constructor(client: IClientBase) {
        super();

        this.serverCertificate = Buffer.alloc(0);

        this.sessionId = new NodeId();

        this._closeEventHasBeenEmitted = false;
        this._client = client;
        this._publishEngine = null;

        this._closed = false;

        this._reconnecting = {
            reconnecting: false,
            pendingCallbacks: [],
            pendingTransactions: []
        };

        this.requestedMaxReferencesPerNode = 10000;
        this.lastRequestSentTime = new Date(1, 1, 1970);
        this.lastResponseReceivedTime = new Date(1, 1, 1970);
        this.timeout = 0;
    }

    getTransportSettings(): IBasicTransportSettings {
        if (!this._client) {
            throw new Error("session has been closed - no transport settings available");
        }
        return this._client.getTransportSettings();
    }
    /**
     * the endpoint on which this session is operating
     * @property endpoint
     * @type {EndpointDescription}
     */
    get endpoint(): EndpointDescription {
        if (!this._client?.endpoint) {
            throw new Error("session has been closed - no endpoint available");
        }
        return this._client.endpoint;
    }

    get subscriptionCount(): number {
        return this._publishEngine ? this._publishEngine.subscriptionCount : 0;
    }

    get isReconnecting(): boolean {
        return this._client ? this._client.isReconnecting || this._reconnecting?.reconnecting : false;
    }

    public toJSON(): Record<string, string | number | boolean> {
        return {
            name: this.name,
            sessionId: this.sessionId.toString(),
            timeout: this.timeout,
            state: this._closed ? "closed" : "active",
            isReconnecting: this.isReconnecting ? "true" : "false"
        };
    }

    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return this.toString();
    }

    protected resolveNodeId(nodeId: NodeIdLike): NodeIdLike {
        return resolveNodeId(nodeId);
    }
    public getPublishEngine(): ClientSidePublishEngine {
        if (!this._publishEngine) {
            this._publishEngine = new ClientSidePublishEngine(this);
        }
        return this._publishEngine;
    }

    public changeUser(userIdentityInfo: UserIdentityInfo): Promise<StatusCode>;
    public changeUser(userIdentityInfo: UserIdentityInfo, callback: CallbackT<StatusCode>): void;
    public changeUser(userIdentityInfo: UserIdentityInfo, callback?: CallbackT<StatusCode>): unknown {
        userIdentityInfo = userIdentityInfo || {
            type: UserTokenType.Anonymous
        };
        if (!this._client || !this.userIdentityInfo) {
            warningLog("changeUser: invalid session");
            return callback?.(null, StatusCodes.BadInternalError);
        }

        const old_userIdentity: UserIdentityInfo = this.userIdentityInfo;

        this._client._activateSession(this, userIdentityInfo, (err1: Error | null, _session2?: ClientSessionImpl) => {
            if (err1) {
                this.userIdentityInfo = old_userIdentity;
                warningLog("activate session error = ", err1.message);
                return callback?.(null, StatusCodes.BadUserAccessDenied);
            }
            this.userIdentityInfo = userIdentityInfo;
            callback?.(null, StatusCodes.Good);
        });
        return undefined;
    }
    /**
     *
     * @example
     *
     *    ```javascript
     *    session.browse("RootFolder",function(err,browseResult) {
     *      if(err) return callback(err);
     *      console.log(browseResult.toString());
     *      callback();
     *    } );
     *    ```
     *
     *
     * @example
     *
     *    ``` javascript
     *    const browseDescription = {
     *       nodeId: "ObjectsFolder",
     *       referenceTypeId: "Organizes",
     *       browseDirection: BrowseDirection.Inverse,
     *       includeSubtypes: true,
     *       nodeClassMask: 0,
     *       resultMask: 63
     *    }
     *    session.browse(browseDescription,function(err, browseResult) {
     *       if(err) return callback(err);
     *       console.log(browseResult.toString());
     *       callback();
     *    });
     *    ```
     * @example
     *
     * ``` javascript
     * session.browse([ "RootFolder", "ObjectsFolder"],function(err, browseResults) {
     *       assert(browseResults.length === 2);
     * });
     * ```
     *
     * @example
     * ``` javascript
     * const browseDescriptions = [
     * {
     *   nodeId: "ObjectsFolder",
     *   referenceTypeId: "Organizes",
     *   browseDirection: BrowseDirection.Inverse,
     *   includeSubtypes: true,
     *   nodeClassMask: 0,
     *   resultMask: 63
     * },
     * // {...}
     * ]
     *  session.browse(browseDescriptions,function(err, browseResults) {
     *
     *   });
     * ```
     *
     *
     */
    public browse(nodeToBrowse: BrowseDescriptionLike, callback: ResponseCallback<BrowseResult>): void;

    public browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;

    public async browse(nodeToBrowse: BrowseDescriptionLike): Promise<BrowseResult>;

    public async browse(nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
    /**
     * @internal
     * @param args
     */
    public browse(...args: unknown[]): unknown {
        const arg0 = args[0];
        const isArray = Array.isArray(arg0);
        const callback = args[1] as ResponseCallback<BrowseResult[] | BrowseResult>;
        assert(typeof callback === "function");

        assert(Number.isFinite(this.requestedMaxReferencesPerNode));

        const nodesToBrowse: BrowseDescription[] = (
            isArray ? (arg0 as BrowseDescriptionLike[]) : [arg0 as BrowseDescriptionLike]
        ).map(coerceBrowseDescription);

        const request = new BrowseRequest({
            nodesToBrowse,
            requestedMaxReferencesPerNode: this.requestedMaxReferencesPerNode
        });

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            if (err) {
                return callback(err);
            }

            /* c8 ignore next */
            if (!response || !(response instanceof BrowseResponse)) {
                return callback(new Error("Internal Error"));
            }

            const results: BrowseResult[] = response.results ? response.results : [];

            if (this.requestedMaxReferencesPerNode > 0) {
                for (let i = 0; i < results.length; i++) {
                    const r = results[i];

                    /* c8 ignore next */
                    if (r.references && r.references.length > this.requestedMaxReferencesPerNode) {
                        warningLog(
                            chalk.yellow("warning") +
                                " BrowseResponse : the server didn't take into" +
                                " account our requestedMaxReferencesPerNode "
                        );
                        warningLog(`        this.requestedMaxReferencesPerNode= ${this.requestedMaxReferencesPerNode}`);
                        warningLog(`        got ${r.references.length}for ${nodesToBrowse[i].nodeId.toString()}`);
                        warningLog("        continuationPoint ", r.continuationPoint);
                    }
                }
            }
            for (const r of results) {
                r.references = r.references || /* c8 ignore next */ [];
            }
            assert(results[0] instanceof BrowseResult);
            return callback(null, isArray ? results : results[0]);
        });
    }

    public browseNext(
        continuationPoint: Buffer,
        releaseContinuationPoints: boolean,
        callback: ResponseCallback<BrowseResult>
    ): void;

    public browseNext(
        continuationPoints: Buffer[],
        releaseContinuationPoints: boolean,
        callback: ResponseCallback<BrowseResult[]>
    ): void;

    public async browseNext(continuationPoint: Buffer, releaseContinuationPoints: boolean): Promise<BrowseResult>;
    public async browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean): Promise<BrowseResult[]>;
    public browseNext(...args: unknown[]): unknown {
        const arg0 = args[0];
        const isArray = Array.isArray(arg0);
        const releaseContinuationPoints = args[1] as boolean;
        const callback = args[2] as ResponseCallback<BrowseResult[] | BrowseResult>;
        assert(typeof callback === "function", "expecting a callback function here");

        const continuationPoints: Buffer[] = isArray ? (arg0 as Buffer[]) : [arg0 as Buffer];

        const request = new BrowseNextRequest({
            continuationPoints,
            releaseContinuationPoints
        });

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }

            /* c8 ignore next */
            if (!response || !(response instanceof BrowseNextResponse)) {
                return callback(new Error("Internal Error"));
            }
            const results: BrowseResult[] = response.results ? response.results : [];

            for (const r of results) {
                r.references = r.references || [];
            }
            assert(results[0] instanceof BrowseResult);
            return callback(null, isArray ? results : results[0]);
        });
    }

    /**
     *
     * @example
     *
     * ```javascript
     *     session.readVariableValue("ns=2;s=Furnace_1.Temperature",function(err,dataValue) {
     *        if(err) { return callback(err); }
     *        if (dataValue.isGood()) {
     *        }
     *        console.log(dataValue.toString());
     *        callback();
     *     });
     * ```
     *
     * @example
     *
     * ```javascript
     *   session.readVariableValue(["ns=0;i=2257","ns=0;i=2258"],function(err,dataValues) {
     *      if (!err) {
     *         console.log(dataValues[0].toString());
     *         console.log(dataValues[1].toString());
     *      }
     *   });
     * ```
     *
     * @example
     * ```javascript
     *     const dataValues = await session.readVariableValue(["ns=1;s=Temperature","ns=1;s=Pressure"]);
     * ```
     *
     * @deprecated
     */
    public readVariableValue(nodeId: NodeIdLike, callback: ResponseCallback<DataValue>): void;
    public readVariableValue(nodeIds: NodeIdLike[], callback: ResponseCallback<DataValue[]>): void;
    public async readVariableValue(nodeId: NodeIdLike): Promise<DataValue>;
    public async readVariableValue(nodeIds: NodeIdLike[]): Promise<DataValue[]>;
    /**
     * @internal
     * @param args
     */
    public readVariableValue(...args: unknown[]): unknown {
        const callback = args[1] as ResponseCallback<DataValue[] | DataValue>;
        assert(typeof callback === "function");

        const isArray = Array.isArray(args[0]);

        const nodes: unknown[] = isArray ? (args[0] as unknown[]) : [args[0]];

        const nodesToRead = nodes.map(coerceReadValueId);

        const request = new ReadRequest({
            nodesToRead,
            timestampsToReturn: TimestampsToReturn.Neither
        });

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }

            /* c8 ignore next */
            if (!(response instanceof ReadResponse)) {
                return callback(new Error("Internal Error"));
            }

            /* c8 ignore next */
            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
                return callback(new Error(response.responseHeader.serviceResult.toString()));
            }

            /* c8 ignore next */
            if (!response.results) {
                response.results = [];
            }

            assert(nodes.length === response.results.length);

            callback(null, isArray ? response.results : response.results[0]);
        });
    }

    /**
     *
     * @example
     *
     * ```javascript
     * //  es5
     * session.readHistoryValue(
     *   "ns=5;s=Simulation Examples.Functions.Sine1",
     *   "2015-06-10T09:00:00.000Z",
     *   "2015-06-10T09:01:00.000Z", function(err,dataValues) {
     *
     * });
     * ```
     *
     * ```javascript
     * //  es6
     * const dataValues = await session.readHistoryValue(
     *   "ns=5;s=Simulation Examples.Functions.Sine1",
     *   "2015-06-10T09:00:00.000Z",
     *   "2015-06-10T09:01:00.000Z");
     * ```
     * @param nodeToRead   the read value id
     * @param start   the start time in UTC format
     * @param end     the end time in UTC format
     * @param callback
     */
    public readHistoryValue(
        nodesToRead: NodeIdLike[] | HistoryReadValueIdOptions2[],
        start: DateTime,
        end: DateTime,
        callback: (err: Error | null, results?: HistoryReadResult[]) => void
    ): void;
    public readHistoryValue(
        nodesToRead: NodeIdLike[] | HistoryReadValueIdOptions2[],
        start: DateTime,
        end: DateTime,
        options: ExtraReadHistoryValueParameters | undefined,
        callback: (err: Error | null, results?: HistoryReadResult[]) => void
    ): void;
    public async readHistoryValue(
        nodesToRead: NodeIdLike[] | HistoryReadValueIdOptions2[],
        start: DateTime,
        end: DateTime,
        options?: ExtraReadHistoryValueParameters
    ): Promise<HistoryReadResult[]>;
    public readHistoryValue(
        nodeToRead: NodeIdLike | HistoryReadValueIdOptions2,
        start: DateTime,
        end: DateTime,
        callback: (err: Error | null, results?: HistoryReadResult) => void
    ): void;
    public readHistoryValue(
        nodeToRead: NodeIdLike | HistoryReadValueIdOptions2,
        start: DateTime,
        end: DateTime,
        options: ExtraReadHistoryValueParameters | undefined,
        callback: (err: Error | null, results?: HistoryReadResult) => void
    ): void;
    public async readHistoryValue(
        nodeToRead: NodeIdLike | HistoryReadValueIdOptions2,
        start: DateTime,
        end: DateTime,
        parameters: ExtraReadHistoryValueParameters
    ): Promise<HistoryReadResult>;
    public readHistoryValue(...args: unknown[]): unknown {
        const startTime = args[1] as DateTime;
        const endTime = args[2] as DateTime;

        let options: ExtraReadHistoryValueParameters = {};
        let callback = args[3];
        if (typeof callback !== "function") {
            options = args[3] as ExtraReadHistoryValueParameters;
            callback = args[4];
        }
        assert(typeof callback === "function");
        const cb = callback as (err: Error | null, results?: HistoryReadResult[] | HistoryReadResult) => void;

        // adjust parameters
        options.numValuesPerNode = options.numValuesPerNode || 0;
        options.returnBounds = !!(options.returnBounds || options.returnBounds === undefined);
        options.isReadModified = options.isReadModified || false;
        options.timestampsToReturn = options.timestampsToReturn ?? TimestampsToReturn.Both;

        const arg0 = args[0];
        const isArray = Array.isArray(arg0);

        const nodes: unknown[] = isArray ? (arg0 as unknown[]) : [arg0];

        const nodesToRead: HistoryReadValueIdOptions[] = [];

        for (const node of nodes as (NodeIdLike | HistoryReadValueIdOptions2)[]) {
            if (!(node as HistoryReadValueIdOptions2).nodeId) {
                nodesToRead.push({
                    continuationPoint: undefined,
                    dataEncoding: undefined, // {namespaceIndex: 0, name: undefined},
                    indexRange: undefined,
                    nodeId: this.resolveNodeId(node as NodeIdLike)
                });
            } else {
                nodesToRead.push(node as HistoryReadValueIdOptions);
            }
        }

        const readRawModifiedDetails = new ReadRawModifiedDetails({
            endTime,
            isReadModified: false,
            numValuesPerNode: options.numValuesPerNode,
            returnBounds: options.returnBounds,
            startTime
        });

        const request = new HistoryReadRequest({
            historyReadDetails: readRawModifiedDetails,
            nodesToRead,
            releaseContinuationPoints: false,
            timestampsToReturn: options.timestampsToReturn
        });

        request.nodesToRead = request.nodesToRead || [];

        assert(nodes.length === request.nodesToRead.length);
        return this.historyRead(request, (err: Error | null, response?: HistoryReadResponse) => {
            /* c8 ignore next */
            if (err) {
                return cb(err);
            }
            /* c8 ignore next */
            if (!response || !(response instanceof HistoryReadResponse)) {
                return cb(new Error("Internal Error"));
            }
            response.results = response.results || [];
            assert(nodes.length === response.results.length);
            cb(null, isArray ? response.results : response.results[0]);
        });
    }

    public historyRead(request: HistoryReadRequest, callback: Callback<HistoryReadResponse>): void;
    public historyRead(request: HistoryReadRequest): Promise<HistoryReadResponse>;
    public historyRead(request: HistoryReadRequest, callback?: CallbackT<HistoryReadResponse>): unknown {
        /* c8 ignore next */
        if (!callback) {
            throw new Error("expecting a callback");
        }

        return this.performMessageTransaction(request, (err: Error | null, response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }

            /* c8 ignore next */
            if (!response || !(response instanceof HistoryReadResponse)) {
                return callback(new Error("Internal Error"));
            }

            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
                return callback(new Error(response.responseHeader.serviceResult.toString()));
            }

            response.results = response.results || /* c8 ignore next */ [];

            // perform ExtensionObject resolution
            const promises = response.results.map(async (result) => {
                if (result.historyData && result.historyData instanceof HistoryData) {
                    if (result.historyData.dataValues) {
                        await promoteOpaqueStructure(this, result.historyData.dataValues);
                    }
                }
            });
            Promise.all(promises)
                .then(() => {
                    callback(null, response);
                })
                .catch((err) => callback(err));
        });
    }

    public readAggregateValue(
        nodesToRead: HistoryReadValueIdOptions[],
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction[],
        processingInterval: number,
        callback: Callback<HistoryReadResult[]>
    ): void;
    public async readAggregateValue(
        nodesToRead: HistoryReadValueIdOptions[],
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction[],
        processingInterval: number
    ): Promise<HistoryReadResult[]>;
    public readAggregateValue(
        nodeToRead: HistoryReadValueIdOptions,
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction,
        processingInterval: number,
        callback: Callback<HistoryReadResult>
    ): void;
    public async readAggregateValue(
        nodeToRead: HistoryReadValueIdOptions,
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction,
        processingInterval: number
    ): Promise<HistoryReadResult>;
    public readAggregateValue(
        nodesToRead: HistoryReadValueIdOptions[],
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction[],
        processingInterval: number,
        aggregateConfiguration: AggregateConfigurationOptions,
        callback: Callback<HistoryReadResult[]>
    ): void;
    public async readAggregateValue(
        nodesToRead: HistoryReadValueIdOptions[],
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction[],
        processingInterval: number,
        aggregateConfiguration: AggregateConfigurationOptions
    ): Promise<HistoryReadResult[]>;
    public readAggregateValue(
        nodeToRead: HistoryReadValueIdOptions,
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction,
        processingInterval: number,
        aggregateConfiguration: AggregateConfigurationOptions,
        callback: Callback<HistoryReadResult>
    ): void;
    public async readAggregateValue(
        nodeToRead: HistoryReadValueIdOptions,
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction,
        processingInterval: number,
        aggregateConfiguration: AggregateConfigurationOptions
    ): Promise<HistoryReadResult>;

    public readAggregateValue(
        arg0: HistoryReadValueIdOptions[] | HistoryReadValueIdOptions,
        startTime: DateTime,
        endTime: DateTime,
        aggregateFn: AggregateFunction[] | AggregateFunction,
        processingInterval: number,
        ...args: unknown[]
    ): unknown {
        const callback = (typeof args[0] === "function" ? args[0] : args[1]) as Callback<HistoryReadResult[] | HistoryReadResult>;
        assert(typeof callback === "function");
        const defaultAggregateFunction = {
            percentDataBad: 100,
            percentDataGood: 100,
            treatUncertainAsBad: true,
            useServerCapabilitiesDefaults: true,
            useSlopedExtrapolation: false
        };
        const aggregateConfiguration = (
            typeof args[0] === "function" ? defaultAggregateFunction : args[0]
        ) as AggregateConfigurationOptions;

        const isArray = Array.isArray(arg0);

        const nodesToRead: HistoryReadValueIdOptions[] = isArray
            ? (arg0 as HistoryReadValueIdOptions[])
            : [arg0 as HistoryReadValueIdOptions];

        const aggregateFns: AggregateFunction[] = Array.isArray(aggregateFn)
            ? (aggregateFn as AggregateFunction[])
            : [aggregateFn as AggregateFunction];

        assert(aggregateFns.length === nodesToRead.length);

        const readProcessedDetails = new ReadProcessedDetails({
            aggregateType: aggregateFns,
            endTime,
            processingInterval,
            startTime,
            aggregateConfiguration
        });

        const request = new HistoryReadRequest({
            historyReadDetails: readProcessedDetails,
            nodesToRead,
            releaseContinuationPoints: false,
            timestampsToReturn: TimestampsToReturn.Both
        });

        assert(nodesToRead.length === request.nodesToRead?.length);
        return this.performMessageTransaction(request, (err: Error | null, response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }

            /* c8 ignore next */
            if (!response || !(response instanceof HistoryReadResponse)) {
                return callback(new Error("Internal Error"));
            }

            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
                return callback(new Error(response.responseHeader.serviceResult.toString()));
            }

            response.results = response.results || /* c8 ignore next */ [];

            assert(nodesToRead.length === response.results.length);

            callback(null, isArray ? response.results : response.results[0]);
        });
    }

    /**
     *

     * @param nodesToWrite {WriteValue[]}  - the array of value to write. One or more elements.
     * @param {Function} callback -   the callback function
     * @param callback.err {object|null} the error if write has failed or null if OK
     * @param callback.statusCodes {StatusCode[]} - an array of status code of each write
     *
     * @example
     *
     *     const nodesToWrite = [
     *     {
     *          nodeId: "ns=1;s=SetPoint1",
     *          attributeId: opcua.AttributeIds.Value,
     *          value: {
     *             statusCode: Good,
     *             value: {
     *               dataType: opcua.DataType.Double,
     *               value: 100.0
     *             }
     *          }
     *     },
     *     {
     *          nodeId: "ns=1;s=SetPoint2",
     *          attributeIds opcua.AttributeIds.Value,
     *          value: {
     *             statusCode: Good,
     *             value: {
     *               dataType: opcua.DataType.Double,
     *               value: 45.0
     *             }
     *          }
     *     }
     *     ];
     *     session.write(nodesToWrite,function (err,statusCodes) {
     *       if(err) { return callback(err);}
     *       //
     *     });
     *

     * @param nodeToWrite {WriteValue}  - the value to write
     * @param callback -   the callback function
     * @param callback.err {object|null} the error if write has failed or null if OK
     * @param callback.statusCode {StatusCodes} - the status code of the write
     *
     * @example
     *
     *     const nodeToWrite = {
     *          nodeId: "ns=1;s=SetPoint",
     *          attributeId: opcua.AttributeIds.Value,
     *          value: {
     *             statusCode: Good,
     *             value: {
     *               dataType: opcua.DataType.Double,
     *               value: 100.0
     *             }
     *          }
     *     };
     *     session.write(nodeToWrite,function (err,statusCode) {
     *       if(err) { return callback(err);}
     *       //
     *     });
     *
     *

     * @param nodeToWrite {WriteValue}  - the value to write
     * @return {Promise<StatusCode>}
     *
     * @example
     *
     * ```javascript
     *   session.write(nodeToWrite).then(function(statusCode) { });
     * ```
     *
     * @example
     *
     * ```javascript
     *   const statusCode = await session.write(nodeToWrite);
     * ```
     *

     * @param nodesToWrite {Array<WriteValue>}  - the value to write
     * @return {Promise<Array<StatusCode>>}
     *
     * @example
     * ```javascript
     * session.write(nodesToWrite).then(function(statusCodes) { });
     * ```
     *
     * @example
     * ```javascript
     *   const statusCodes = await session.write(nodesToWrite);
     * ```
     */
    public write(nodeToWrite: WriteValueOptions, callback: ResponseCallback<StatusCode>): void;

    public write(nodesToWrite: WriteValueOptions[], callback: ResponseCallback<StatusCode[]>): void;

    public async write(nodesToWrite: WriteValueOptions[]): Promise<StatusCode[]>;

    public async write(nodeToWrite: WriteValueOptions): Promise<StatusCode>;

    /**
     * @internal
     * @param args
     */
    public write(...args: unknown[]): unknown {
        const arg0 = args[0];
        const isArray = Array.isArray(arg0);
        const nodesToWrite: WriteValueOptions[] = isArray ? (arg0 as WriteValueOptions[]) : [arg0 as WriteValueOptions];

        const callback = args[1] as (err: Error | null, results?: StatusCode[] | StatusCode | Response) => void;
        assert(typeof callback === "function");

        const request = new WriteRequest({ nodesToWrite });

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err, response);
            }

            /* c8 ignore next */
            if (!response || !(response instanceof WriteResponse)) {
                return callback(new Error("Internal Error"));
            }

            /* c8 ignore next */
            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
                return callback(new Error(response.responseHeader.serviceResult.toString()));
            }
            response.results = response.results || /* c8 ignore next */ [];
            assert(nodesToWrite.length === response.results.length);
            callback(null, isArray ? response.results : response.results[0]);
        });
    }

    /**
     * @deprecated use session.write instead
     *
     * @param nodeId  {NodeId}  - the node id of the node to write
     * @param value   {Variant} - the value to write
     * @param callback   {Function}
     * @param callback.err {object|null} the error if write has failed or null if OK
     * @param callback.statusCode {StatusCode} - the status code of the write
     *
     * @param nodeId  {NodeId}  - the node id of the node to write
     * @param value   {Variant} - the value to write
     * @return {Promise<StatusCode>} - the status code of the write
     *
     *
     * @example
     *     // please use session.write instead of session.writeSingleNode
     *     // as follow
     *     const statusCode = await session.write({
     *          nodeId,
     *          attributeId: AttributeIds.Value,
     *          value: {
     *             statusCode: Good,
     *             sourceTimestamp: new Date(), // optional, some server may not accept this
     *             value: {
     *               dataType: opcua.DataType.Double,
     *               value: 100.0
     *             }
     *          }
     *     });
     *
     *
     */
    public writeSingleNode(nodeId: NodeIdLike, value: VariantLike, callback: ResponseCallback<StatusCode>): void;

    public writeSingleNode(nodeId: NodeIdLike, value: VariantLike): Promise<StatusCode>;

    public writeSingleNode(...args: unknown[]): unknown {
        const nodeId = args[0] as NodeIdLike;
        const value = args[1] as VariantLike;
        const callback = args[2] as ResponseCallback<StatusCode>;

        assert(typeof callback === "function");

        const nodeToWrite = new WriteValue({
            attributeId: AttributeIds.Value,
            indexRange: undefined,
            nodeId: this.resolveNodeId(nodeId),
            value: new DataValue({ value })
        });

        return this.write(nodeToWrite, (err, statusCode) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }
            assert(statusCode);
            callback(null, statusCode);
        });
    }

    /**

     *
     * @example
     *
     *
     *  ``` javascript
     *  session.readAllAttributes("ns=2;s=Furnace_1.Temperature",function(err,data) {
     *    if(data.statusCode.isGood()) {
     *      console.log(" nodeId      = ",data.nodeId.toString());
     *      console.log(" browseName  = ",data.browseName.toString());
     *      console.log(" description = ",data.description.toString());
     *      console.log(" value       = ",data.value.toString()));
     *    }
     *  });
     *  ```
     *
     * @param nodes  array of nodeId to read
     * @param node  nodeId to read
     * @param callback
     */
    public readAllAttributes(node: NodeIdLike, callback: (err: Error | null, data?: NodeAttributes) => void): void;

    public readAllAttributes(nodes: NodeIdLike[], callback: (err: Error | null, data?: NodeAttributes[]) => void): void;

    public readAllAttributes(...args: unknown[]): void {
        const nodes = args[0] as NodeIdLike[];
        const callback = args[1] as (err: Error | null, data?: NodeAttributes[]) => void;
        readAllAttributes(this, nodes)
            .then((data: NodeAttributes[]) => callback(null, data))
            .catch((err: Error) => callback(err));
    }

    /**
     *
     *
     * @example
     *
     *     ```javascript
     *     ```
     *
     *   form1: reading a single node
     *
     *  ``` javascript
     *    const nodeToRead = {
     *             nodeId:      "ns=2;s=Furnace_1.Temperature",
     *             attributeId: AttributeIds.BrowseName
     *    };
     *
     *    session.read(nodeToRead,function(err,dataValue) {
     *        if (!err) {
     *           console.log(dataValue.toString());
     *        }
     *    });
     *    ```
     *
     *

     * @param nodesToRead               {Array<ReadValueId>} - an array of nodeId to read or a ReadValueId
     * @param [maxAge]                 {Number}
     * @param callback                 {Function}                - the callback function
     * @param callback.err             {Error|null}              - the error or null if the transaction was OK}
     * @param callback.dataValues       {Array<DataValue>}
     *
     * @example
     *
     *   ``` javascript
     *   const nodesToRead = [
     *        {
     *             nodeId:      "ns=2;s=Furnace_1.Temperature",
     *             attributeId: AttributeIds.BrowseName
     *        }
     *   ];
     *   session.read(nodesToRead,function(err,dataValues) {
     *     if (!err) {
     *       dataValues.forEach(dataValue=>console.log(dataValue.toString()));
     *     }
     *   });
     *   ```
     *
     */
    public read(nodeToRead: ReadValueIdOptions, maxAge: number, callback: ResponseCallback<DataValue>): void;

    public read(nodesToRead: ReadValueIdOptions[], maxAge: number, callback: ResponseCallback<DataValue[]>): void;

    public read(nodeToRead: ReadValueIdOptions, callback: ResponseCallback<DataValue>): void;

    public read(nodesToRead: ReadValueIdOptions[], callback: ResponseCallback<DataValue[]>): void;

    public read(nodeToRead: ReadValueIdOptions, maxAge?: number): Promise<DataValue>;

    public read(nodeToRead: ReadValueIdOptions[], maxAge?: number): Promise<DataValue[]>;

    /**
     * @internal
     * @param args
     */
    public read(...args: unknown[]): unknown {
        if (args.length === 2) {
            return this.read(args[0] as ReadValueIdOptions, 0, args[1] as ResponseCallback<DataValue>);
        }
        assert(args.length === 3);

        const isArray = Array.isArray(args[0]);

        const nodesToRead: ReadValueIdOptions[] = isArray ? (args[0] as ReadValueIdOptions[]) : [args[0] as ReadValueIdOptions];

        assert(Array.isArray(nodesToRead));

        const maxAge = args[1] as number;

        const callback = args[2] as (err: Error | null, results?: DataValue[] | DataValue | Response) => void;
        assert(typeof callback === "function");

        /* c8 ignore next */
        if (helpAPIChange) {
            // the read method deprecation detection and warning
            if (
                !(
                    getFunctionParameterNames(callback as unknown as (...args: unknown[]) => void)[1] === "dataValues" ||
                    getFunctionParameterNames(callback as unknown as (...args: unknown[]) => void)[1] === "dataValue"
                )
            ) {
                warningLog(chalk.red("[NODE-OPCUA-E04] the ClientSession#read  API has changed !!, please fix the client code"));
                warningLog(chalk.red("   replace ..:"));
                warningLog(chalk.cyan("   session.read(nodesToRead,function(err,nodesToRead,results) {}"));
                warningLog(chalk.red("   with .... :"));
                warningLog(chalk.cyan("   session.read(nodesToRead,function(err,dataValues) {}"));
                warningLog("");
                warningLog(
                    chalk.yellow(
                        "please make sure to refactor your code and check that " +
                            "the second argument of your callback function is named"
                    ),
                    chalk.cyan(`dataValue${isArray ? "s" : ""}`)
                );
                warningLog(chalk.cyan("to make this exception disappear"));
                throw new Error("ERROR ClientSession#read  API has changed !!, please fix the client code");
            }
        }

        // coerce nodeIds
        for (const node of nodesToRead) {
            if (node.nodeId) {
                node.nodeId = this.resolveNodeId(node.nodeId);
            }
        }

        const request = new ReadRequest({
            maxAge,
            nodesToRead,
            timestampsToReturn: TimestampsToReturn.Both
        });

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err, response);
            }

            /* c8 ignore next */
            if (!response || !(response instanceof ReadResponse)) {
                return callback(new Error("Internal Error"));
            }

            // perform ExtensionObject resolution
            promoteOpaqueStructure(this, response.results || [])
                .then(() => {
                    response.results = response.results || /* c8 ignore next */ [];
                    callback(null, isArray ? response.results : response.results[0]);
                })
                .catch((err) => {
                    callback(err);
                });
        });
    }

    public emitCloseEvent(statusCode: StatusCode): void {
        if (!this._closeEventHasBeenEmitted) {
            debugLog("ClientSession#emitCloseEvent");
            this._closeEventHasBeenEmitted = true;
            this.emit("session_closed", statusCode);
        }
    }

    public createSubscription(options: CreateSubscriptionRequestLike, callback: ResponseCallback<CreateSubscriptionResponse>): void;
    public createSubscription(options: CreateSubscriptionRequestLike): Promise<CreateSubscriptionResponse>;
    public createSubscription(
        options: CreateSubscriptionRequestLike,
        callback?: ResponseCallback<CreateSubscriptionResponse>
    ): unknown {
        return this._defaultRequest(CreateSubscriptionRequest, CreateSubscriptionResponse, options, callback);
    }

    /**

     * @param createSubscriptionRequest
     * @param callback
     *
     *
     * subscription.on("error',    function(err){ ... });
     * subscription.on("terminate',function(err){ ... });
     * const monitoredItem = await subscription.monitor(itemToMonitor,monitoringParameters,requestedParameters);
     * monitoredItem.on("changed",function( dataValue) {...});
     *
     */
    public async createSubscription2(createSubscriptionRequest: CreateSubscriptionRequestLike): Promise<ClientSubscription>;
    public createSubscription2(
        createSubscriptionRequest: CreateSubscriptionRequestLike,
        callback: (err: Error | null, subscription?: ClientSubscription) => void
    ): void;
    public createSubscription2(...args: unknown[]): unknown {
        const createSubscriptionRequest = args[0] as CreateSubscriptionRequestLike;
        let callback = args[1] as ((err: Error | null, subscription?: ClientSubscription) => void) | null;
        const subscription = new ClientSubscriptionImpl(this, createSubscriptionRequest);

        subscription.on("error", (err) => {
            if (callback) {
                callback(err);
                callback = null;
            }
        });
        subscription.on("started", () => {
            assert(subscription.session === this, "expecting a session here");
            if (callback) {
                callback(null, subscription);
                callback = null;
            }
        });
        return undefined;
    }

    public deleteSubscriptions(
        options: DeleteSubscriptionsRequestLike,
        callback?: ResponseCallback<DeleteSubscriptionsResponse>
    ): unknown {
        return this._defaultRequest(DeleteSubscriptionsRequest, DeleteSubscriptionsResponse, options, callback);
    }

    public setTriggering(request: SetTriggeringRequestOptions, callback?: ResponseCallback<SetTriggeringResponse>): unknown {
        return this._defaultRequest(SetTriggeringRequest, SetTriggeringResponse, request, callback);
    }

    /**
     */
    public transferSubscriptions(
        options: TransferSubscriptionsRequestLike,
        callback?: ResponseCallback<TransferSubscriptionsResponse>
    ): unknown {
        return this._defaultRequest(TransferSubscriptionsRequest, TransferSubscriptionsResponse, options, callback);
    }

    public createMonitoredItems(
        options: CreateMonitoredItemsRequestLike,
        callback: ResponseCallback<CreateMonitoredItemsResponse>
    ): void;
    public createMonitoredItems(options: CreateMonitoredItemsRequestLike): Promise<CreateMonitoredItemsResponse>;
    public createMonitoredItems(
        options: CreateMonitoredItemsRequestLike,
        callback?: ResponseCallback<CreateMonitoredItemsResponse>
    ): unknown {
        return this._defaultRequest(CreateMonitoredItemsRequest, CreateMonitoredItemsResponse, options, callback);
    }

    public modifyMonitoredItems(
        options: ModifyMonitoredItemsRequestLike,
        callback?: ResponseCallback<ModifyMonitoredItemsResponse>
    ): unknown {
        return this._defaultRequest(ModifyMonitoredItemsRequest, ModifyMonitoredItemsResponse, options, callback);
    }

    /**
     *
     */
    public modifySubscription(
        options: ModifySubscriptionRequestLike,
        callback?: ResponseCallback<ModifySubscriptionResponse>
    ): unknown {
        return this._defaultRequest(ModifySubscriptionRequest, ModifySubscriptionResponse, options, callback);
    }

    public setMonitoringMode(
        options: SetMonitoringModeRequestLike,
        callback?: ResponseCallback<SetMonitoringModeResponse>
    ): unknown {
        return this._defaultRequest(SetMonitoringModeRequest, SetMonitoringModeResponse, options, callback);
    }

    /**
     */
    public publish(options: PublishRequest, callback: (err: Error | null, response?: PublishResponse) => void): void {
        this._defaultRequest(PublishRequest, PublishResponse, options, callback);
    }

    /**
     *
     */
    public republish(options: RepublishRequest, callback: (err: Error | null, response?: RepublishResponse) => void): void {
        this._defaultRequest(RepublishRequest, RepublishResponse, options, callback);
    }

    /**
     *
     */
    public deleteMonitoredItems(
        options: DeleteMonitoredItemsRequestLike,
        callback: (err: Error | null, response?: DeleteMonitoredItemsResponse) => void
    ): void {
        this._defaultRequest(DeleteMonitoredItemsRequest, DeleteMonitoredItemsResponse, options, callback);
    }

    /**
     *
     */
    public setPublishingMode(publishingEnabled: boolean, subscriptionId: SubscriptionId): Promise<StatusCode>;
    public setPublishingMode(publishingEnabled: boolean, subscriptionIds: SubscriptionId[]): Promise<StatusCode[]>;
    public setPublishingMode(
        publishingEnabled: boolean,
        subscriptionId: SubscriptionId,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void;
    public setPublishingMode(
        publishingEnabled: boolean,
        subscriptionIds: SubscriptionId[],
        callback: (err: Error | null, statusCodes?: StatusCode[]) => void
    ): void;
    /**
     * @internal
     */
    public setPublishingMode(...args: unknown[]): unknown {
        const publishingEnabled = args[0] as boolean;
        const isArray = Array.isArray(args[1]);
        const subscriptionIds: SubscriptionId[] = isArray ? (args[1] as SubscriptionId[]) : [args[1] as SubscriptionId];
        const callback = args[2] as (err: Error | null, statusCode?: StatusCode[] | StatusCode) => void;

        assert(typeof callback === "function");
        assert(publishingEnabled === true || publishingEnabled === false);

        const options = new SetPublishingModeRequest({
            publishingEnabled,
            subscriptionIds
        });

        return this._defaultRequest(
            SetPublishingModeRequest,
            SetPublishingModeResponse,
            options,
            (err: Error | null, response?: SetPublishingModeResponse) => {
                /* c8 ignore next */
                if (err) {
                    return callback(err);
                }
                /* c8 ignore next */
                if (!response) {
                    return callback(new Error("Internal Error"));
                }
                response.results = response.results || /* c8 ignore next */ [];
                callback(err, isArray ? response.results : response.results[0]);
            }
        );
    }

    /**
     *
     */
    public translateBrowsePath(browsePath: BrowsePath, callback: ResponseCallback<BrowsePathResult>): void;
    public translateBrowsePath(browsesPath: BrowsePath[], callback: ResponseCallback<BrowsePathResult[]>): void;
    public async translateBrowsePath(browsePath: BrowsePath): Promise<BrowsePathResult>;
    public async translateBrowsePath(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]>;

    /**
     * @internal
     * @param args
     */
    public translateBrowsePath(...args: unknown[]): unknown {
        const isArray = Array.isArray(args[0]);
        const browsePaths: BrowsePath[] = isArray ? (args[0] as BrowsePath[]) : [args[0] as BrowsePath];

        const callback = args[1] as (err: Error | null, results?: BrowsePathResult[] | BrowsePathResult | Response) => void;
        assert(typeof callback === "function");

        const request = new TranslateBrowsePathsToNodeIdsRequest({ browsePaths });

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err, response);
            }
            /* c8 ignore next */
            if (!response || !(response instanceof TranslateBrowsePathsToNodeIdsResponse)) {
                return callback(new Error("Internal Error"));
            }
            response.results = response.results || /* c8 ignore next */ [];

            callback(null, isArray ? response.results : response.results[0]);
        });
    }

    public channelId(): number {
        const secureChannel = this._client?._secureChannel;
        return secureChannel?.isOpened() ? secureChannel.channelId : -1;
    }
    public isChannelValid(): boolean {
        /* c8 ignore next */
        if (!this._client) {
            debugLog(chalk.red("Warning SessionClient is null ?"));
        }

        return !!this._client?._secureChannel?.isOpened();
    }

    public performMessageTransaction(request: Request, callback: (err: Error | null, response?: Response) => void): void {
        if (!this._client) {
            // session may have been closed by user ... but is still in used !!
            callback(new Error("Session has been closed and should not be used to perform a transaction anymore"));
            return;
        }
        if (
            request instanceof PublishRequest ||
            request instanceof ActivateSessionRequest ||
            request instanceof CloseSessionRequest
        ) {
            this._performMessageTransaction(request, callback);
            return;
        }

        if (this._reconnecting.pendingTransactions.length > 0) {
            /* c8 ignore next */
            if (this._reconnecting.pendingTransactions.length > 10) {
                if (!pendingTransactionMessageDisplayed) {
                    pendingTransactionMessageDisplayed = true;
                    warningLog(
                        "[NODE-OPCUA-W21]",
                        "Pending transactions: ",
                        this._reconnecting.pendingTransactions.map((a) => a.request.constructor.name).join(" ")
                    );
                    warningLog(
                        "[NODE-OPCUA-W22]",
                        chalk.yellow(
                            "Warning : your opcua client is sending multiple requests simultaneously to the server",
                            request.constructor.name
                        ),
                        "\n",
                        chalk.yellow(" please fix your application code")
                    );
                }
            } else if (this._reconnecting.pendingTransactions.length > 3) {
                debugLog(
                    chalk.yellow(
                        "Warning : your client is sending multiple requests simultaneously to the server",
                        request.constructor.name
                    )
                );
            }
            this._reconnecting.pendingTransactions.push({ request, callback });
            return;
        }
        this.#reprocessRequest(0, request, callback);
    }
    #reprocessRequest(attemptCount: number, request: Request, callback: (err: Error | null, response?: Response) => void): void {
        attemptCount > 0 &&
            warningLog("reprocessRequest => ", request.constructor.name, this._reconnecting.pendingTransactions.length);
        this._performMessageTransaction(request, (err: null | Error, response?: Response) => {
            if (err?.message.match(/BadSessionIdInvalid/) && request.constructor.name !== "ActivateSessionRequest") {
                warningLog(
                    "Transaction on Invalid Session ",
                    request.constructor.name,
                    err.message,
                    "isReconnecting?=",
                    this.isReconnecting,
                    "q=",
                    this._reconnecting.pendingTransactions.length
                );
                request.requestHeader.requestHandle = requestHandleNotSetValue;
                if (this.isReconnecting) {
                    this.once("session_restored", () => {
                        warningLog("redoing", request.constructor.name, this.isReconnecting);
                        this.#reprocessRequest(attemptCount + 1, request, callback);
                    });
                } else {
                    this.#_recreate_session_and_reperform_transaction(request, callback);
                }
                return;
            }
            callback(err, response);
            const length = this._reconnecting.pendingTransactions.length; // record length before callback is called !
            if (length > 0) {
                debugLog("reprocessRequest => ", this._reconnecting.pendingTransactions.length, " transaction(s) left in queue");
                const pending = this._reconnecting.pendingTransactions.shift();
                if (pending) {
                    this.#reprocessRequest(0, pending.request, pending.callback);
                }
            }
        });
    }

    /**
     * record that the server has answered.
     *
     * A transaction that failed on a timeout or on a broken channel comes back with no response
     * at all and must not refresh lastResponseReceivedTime, or the keep-alive manager would never
     * notice that the server is gone (see #1569). A ServiceFault does count - the round trip
     * completed - but the channel reports it as an Error carrying the decoded fault on
     * err.response, so the response argument alone does not tell the two cases apart.
     *
     * @internal
     */
    public noteServerAnswer(err: Error | null, response?: Response): void {
        if (response || (err as ServiceFaultAnnotatedError)?.response) {
            this.lastResponseReceivedTime = new Date();
        }
    }

    public _performMessageTransaction(request: Request, callback: (err: Error | null, response?: Response) => void): void {
        assert(typeof callback === "function");

        /* c8 ignore next */
        if (!this._client) {
            // session may have been closed by user ... but is still in used !!
            callback(new Error("Session has been closed and should not be used to perform a transaction anymore"));
            return;
        }

        if (!this.isChannelValid()) {
            // the secure channel is broken, may be the server has crashed or the network cable has been disconnected
            // for a long time
            // we may need to queue this transaction, as a secure token may be being reprocessed
            debugLog(chalk.bgWhite.red("!!! Performing transaction on invalid channel !!! ", request.constructor.name));
            callback(new Error("Invalid Channel BadConnectionClosed"));
            return;
        }

        // is this stuff useful?
        if (request.requestHeader) {
            if (!this.authenticationToken) {
                throw new Error("internal error: authenticationToken should be set on an active session");
            }
            request.requestHeader.authenticationToken = this.authenticationToken;
        }

        this.lastRequestSentTime = new Date();

        this._client.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            this.noteServerAnswer(err, response);

            if (err) {
                return callback(annotateWithDiagnostics(err, response));
            }

            /* c8 ignore next */
            if (!response) {
                return callback(new Error("internal Error"));
            }

            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
                const serviceResultError = new Error(
                    " ServiceResult is " +
                        response.responseHeader.serviceResult.toString() +
                        " request was " +
                        request.constructor.name
                );
                return callback(annotateWithDiagnostics(serviceResultError, response), response);
            }
            return callback(null, response);
        });
    }

    /**
     *  evaluate the remaining time for the session
     *
     *
     * evaluate the time in milliseconds that the session will live
     * on the server end from now.
     * The remaining live time is calculated based on when the last message was sent to the server
     * and the session timeout.
     *
     * * In normal operation , when server and client communicates on a regular
     *   basis, evaluateRemainingLifetime will return a number slightly below
     *   session.timeout
     *
     * * when the client and server cannot communicate due to a network issue
     *   (or a server crash), evaluateRemainingLifetime returns the estimated number
     *   of milliseconds before the server (if not crash) will keep  the session alive
     *   on its end to allow a automatic reconnection with session.
     *
     * * When evaluateRemainingLifetime returns zero , this mean that
     *   the session has probably ended on the server side and will have to be recreated
     *   from scratch in case of a reconnection.
     *
     * @return the number of milliseconds before session expires
     */
    public evaluateRemainingLifetime(): number {
        const now = Date.now();
        const expiryTime = this.lastRequestSentTime.getTime() + this.timeout;
        return Math.max(0, expiryTime - now);
    }

    public _terminatePublishEngine(): void {
        if (this._publishEngine) {
            this._publishEngine.terminate();
            this._publishEngine = null;
        }
    }

    /**
     *
     */
    public close(callback: ErrorCallback): void;

    public close(deleteSubscription: boolean, callback: ErrorCallback): void;

    public async close(deleteSubscription?: boolean): Promise<void>;

    /**
     * @internal
     * @param args
     */
    public close(...args: unknown[]): unknown {
        if (args.length === 1) {
            return this.close(true, args[0] as ErrorCallback);
        }

        const deleteSubscription = args[0];
        const callback = args[1] as ErrorCallback;

        assert(typeof callback === "function");
        assert(typeof deleteSubscription === "boolean");

        /* c8 ignore next */
        if (!this._client) {
            debugLog("ClientSession#close : warning, client is already closed");
            return callback(); // already close ?
        }
        assert(this._client);

        this._terminatePublishEngine();
        this._client.closeSession(this, deleteSubscription as boolean, (err?: Error) => {
            debugLog("session Close err ", err ? err.message : "null");
            callback();
        });
        return undefined;
    }

    /**

     * @return {Boolean}
     */
    public hasBeenClosed(): boolean {
        return isNullOrUndefined(this._client) || this._closed || this._closeEventHasBeenEmitted;
    }

    public async call(methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;
    public async call(methodToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;
    public call(methodToCall: CallMethodRequestLike, callback: ResponseCallback<CallMethodResult>): void;
    public call(methodsToCall: CallMethodRequestLike[], callback: ResponseCallback<CallMethodResult[]>): void;
    /**
     * @internal
     * @param args
     */
    public call(...args: unknown[]): unknown {
        const isArray = Array.isArray(args[0]);
        const methodsToCall: CallMethodRequestLike[] = isArray
            ? (args[0] as CallMethodRequestLike[])
            : [args[0] as CallMethodRequestLike];
        assert(Array.isArray(methodsToCall));

        const callback = args[1] as ResponseCallback<CallMethodResult[] | CallMethodResult>;

        // Note : The client has no explicit address space and therefore will struggle to
        //        access the method arguments signature.
        //        There are two methods that can be considered:
        //           - get the object definition by querying the server
        //           - load a fake address space to have some thing to query on our end
        // const request = this._client.factory.constructObjectId("CallRequest",{ methodsToCall: methodsToCall});
        const request = new CallRequest({ methodsToCall });

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }

            /* c8 ignore next */
            if (!response || !(response instanceof CallResponse)) {
                return callback(new Error("internal error"));
            }
            const results: CallMethodResult[] = response.results || [];
            response.results = results;

            promoteOpaqueStructureForCall(this, results)
                .then(() => {
                    callback(null, isArray ? results : results[0]);
                })
                .catch((err) => {
                    callback(err);
                });
        });
    }

    /**

     * @param subscriptionId {UInt32} the subscription Id to return
     * @param callback {Function}
     * @param callback.err {Error}
     * @param callback.monitoredItems the monitored Items
     * @param callback.monitoredItems the monitored Items
     */

    public async getMonitoredItems(subscriptionId: SubscriptionId): Promise<MonitoredItemData>;
    public getMonitoredItems(subscriptionId: SubscriptionId, callback: ResponseCallback<MonitoredItemData>): void;
    public getMonitoredItems(...args: unknown[]): unknown {
        const subscriptionId = args[0] as SubscriptionId;
        const callback = args[1] as ResponseCallback<MonitoredItemData>;
        // <UAObject NodeId="i=2253"  BrowseName="Server">
        // <UAMethod NodeId="i=11492" BrowseName="GetMonitoredItems"
        //                                         ParentNodeId="i=2253" MethodDeclarationId="i=11489">
        // <UAMethod NodeId="i=11489" BrowseName="GetMonitoredItems" ParentNodeId="i=2004">
        const methodsToCall = new CallMethodRequest({
            inputArguments: [
                // BaseDataType
                { dataType: DataType.UInt32, value: subscriptionId }
            ],
            methodId: coerceNodeId("ns=0;i=11492"), // MethodIds.Server_GetMonitoredItems;
            objectId: coerceNodeId("ns=0;i=2253") // ObjectId.Server
        });

        return this.call(methodsToCall, (err?: Error | null, result?: CallMethodResult) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }

            /* c8 ignore next */
            if (!result) {
                return callback(new Error("internal error"));
            }

            /* c8 ignore next */
            if (result.statusCode.isNot(StatusCodes.Good)) {
                callback(new Error(result.statusCode.toString()));
            } else {
                result.outputArguments = result.outputArguments || [];

                assert(result.outputArguments.length === 2);
                const data = {
                    clientHandles: result.outputArguments[1].value,
                    serverHandles: result.outputArguments[0].value //
                };

                // Note some server might return null array
                // let make sure we have Uint32Array and not a null pointer
                data.serverHandles = data.serverHandles || /* c8 ignore next */ emptyUint32Array;
                data.clientHandles = data.clientHandles || /* c8 ignore next */ emptyUint32Array;

                assert(data.serverHandles instanceof Uint32Array);
                assert(data.clientHandles instanceof Uint32Array);
                callback(null, data);
            }
        });
    }

    /**
     *
     */
    public async getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;
    public getArgumentDefinition(methodId: MethodId, callback: ResponseCallback<ArgumentDefinition>): void;
    /**
     * @internal
     */
    public getArgumentDefinition(...args: unknown[]): unknown {
        const methodId = args[0] as MethodId;
        const callback = args[1] as ResponseCallback<ArgumentDefinition>;
        assert(typeof callback === "function");
        return getArgumentDefinitionHelper(this, methodId)
            .then((result) => {
                callback?.(null, result);
            })
            .catch((err) => {
                callback(err);
            });
    }

    public async registerNodes(nodesToRegister: NodeIdLike[]): Promise<NodeId[]>;
    public registerNodes(nodesToRegister: NodeIdLike[], callback: (err: Error | null, registeredNodeIds?: NodeId[]) => void): void;
    public registerNodes(...args: unknown[]): unknown {
        const nodesToRegister = args[0] as NodeIdLike[];
        const callback = args[1] as (err: Error | null, registeredNodeIds?: NodeId[]) => void;

        assert(typeof callback === "function");
        assert(Array.isArray(nodesToRegister));

        const request = new RegisterNodesRequest({
            nodesToRegister: nodesToRegister.map((n) => this.resolveNodeId(n))
        });

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }
            /* c8 ignore next */
            if (!response || !(response instanceof RegisterNodesResponse)) {
                return callback(new Error("Internal Error"));
            }

            response.registeredNodeIds = response.registeredNodeIds || /* c8 ignore next */ [];

            callback(null, response.registeredNodeIds);
        });
    }

    public async unregisterNodes(nodesToUnregister: NodeIdLike[]): Promise<void>;
    public unregisterNodes(nodesToUnregister: NodeIdLike[], callback: (err?: Error) => void): void;
    public unregisterNodes(...args: unknown[]): unknown {
        const nodesToUnregister = args[0] as NodeIdLike[];
        const callback = args[1] as (err?: Error) => void;

        assert(typeof callback === "function");
        assert(Array.isArray(nodesToUnregister));

        const request = new UnregisterNodesRequest({
            nodesToUnregister: nodesToUnregister.map((n) => this.resolveNodeId(n))
        });

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }
            /* c8 ignore next */
            if (!response || !(response instanceof UnregisterNodesResponse)) {
                return callback(new Error("Internal Error"));
            }
            callback();
        });
    }

    public async queryFirst(queryFirstRequest: QueryFirstRequestLike): Promise<QueryFirstResponse>;

    public queryFirst(queryFirstRequest: QueryFirstRequestLike, callback: ResponseCallback<QueryFirstResponse>): void;
    public queryFirst(...args: unknown[]): unknown {
        const queryFirstRequest = args[0] as QueryFirstRequestLike;
        const callback = args[1] as ResponseCallback<QueryFirstResponse>;

        assert(typeof callback === "function");
        const request = new QueryFirstRequest(queryFirstRequest);

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }
            /* c8 ignore next */
            if (!response || !(response instanceof QueryFirstResponse)) {
                return callback(new Error("internal error"));
            }
            callback(null, response);
        });
    }

    public startKeepAliveManager(keepAliveInterval?: number): void {
        if (this._keepAliveManager) {
            //  "keepAliveManger already started"
            return;
        }
        this._keepAliveManager = new ClientSessionKeepAliveManager(this);

        this._keepAliveManager.on("failure", () => {
            /**
             * raised when a keep-alive request has failed on the session, may be the session has timeout
             * unexpectedly on the server side, may be the connection is broken.
             * @event keepalive_failure
             */
            this.emit("keepalive_failure");
        });
        this._keepAliveManager.on("keepalive", (state, count) => {
            /**
             * @event keepalive
             */
            this.emit("keepalive", state, count);
        });
        this._keepAliveManager.start(keepAliveInterval);
    }

    public stopKeepAliveManager(): void {
        if (this._keepAliveManager) {
            this._keepAliveManager.stop();
            this._keepAliveManager = undefined;
        }
    }

    public dispose(): void {
        assert(this._closeEventHasBeenEmitted);
        this._terminatePublishEngine();
        this.stopKeepAliveManager();
        this.removeAllListeners();
        //
        if (this._reconnecting.pendingTransactions.length !== 0) {
            warningLog("dispose when pendingTransactions is not empty ");
        }
    }

    public toString(): string {
        const now = Date.now();
        const lap1 = now - this.lastRequestSentTime.getTime();
        const lap2 = now - this.lastResponseReceivedTime.getTime();
        const timeoutDelay = this.timeout - lap1;

        const timeoutInfo =
            timeoutDelay < 0
                ? chalk.red(` expired since ${-timeoutDelay / 1000} seconds`)
                : chalk.green(` timeout in ${timeoutDelay / 1000} seconds`);

        let str = "";
        str += ` name..................... ${this.name}`;
        str += `\n sessionId................ ${this.sessionId.toString()}`;
        str += `\n authenticationToken...... ${this.authenticationToken ? this.authenticationToken?.toString() : ""}`;
        str += `\n timeout.................. ${this.timeout}ms${timeoutInfo}`;
        str += `\n serverNonce.............. ${this.serverNonce ? this.serverNonce?.toString("hex") : ""}`;
        str += `\n serverCertificate........ ${buffer_ellipsis(this.serverCertificate)}`;
        str += `\n serverSignature.......... ${this.serverSignature}`;
        str += `\n lastRequestSentTime...... ${new Date(this.lastRequestSentTime).toISOString()}  (${lap1})`;
        str += `\n lastResponseReceivedTime. ${new Date(this.lastResponseReceivedTime).toISOString()} (${lap2})`;
        str += `\n isReconnecting........... ${this.isReconnecting}`;
        str += `\n isValidChannel........... ${this.isChannelValid()} has been closed  ${this.hasBeenClosed()}`;
        str += `\n channelId................ ${this.channelId()}`;
        str += `\n remaining life time...... ${this.evaluateRemainingLifetime()}`;
        str += `\n subscription count....... ${this.subscriptionCount}`;
        if (this._client?._secureChannel) {
            if (this._client._secureChannel.activeSecurityToken) {
                str += `\n reviseTokenLifetime...... ${this._client._secureChannel.activeSecurityToken.revisedLifetime}`;
            }
        }
        if (this._keepAliveManager) {
            str += `\n keepAlive ................ ${this._keepAliveManager}`;
            str += `\n keepAlive checkInterval.. ${this._keepAliveManager.checkInterval} ms`;
            str += `\n (defaultTransportTimeout).${ClientSecureChannelLayer.defaultTransportTimeout} ms`;
            str += `\n session timeout           ${this.timeout} ms`;
        }
        return str;
    }

    public getBuiltInDataType(nodeId: NodeId): Promise<DataType>;
    public getBuiltInDataType(nodeId: NodeId, callback: (err: Error | null, dataType?: DataType) => void): void;
    public getBuiltInDataType(...args: unknown[]): unknown {
        const nodeId = args[0] as NodeId;
        const callback = args[1] as (err: Error | null, dataType?: DataType) => void;
        return getBuiltInDataType(this, nodeId)
            .then((dataType: DataType) => callback(null, dataType))
            .catch(callback);
    }

    public async readNamespaceArray(): Promise<string[]>;
    public readNamespaceArray(callback: (err: Error | null, namespaceArray?: string[]) => void): void;
    public readNamespaceArray(...args: unknown[]): unknown {
        const callback = args[0] as (err: Error | null, namespaceArray?: string[]) => void;
        readNamespaceArray(this)
            .then((namespaceArray) => callback(null, namespaceArray))
            .catch((err) => {
                callback(err);
            });
        return undefined;
    }

    public getNamespaceIndex(namespaceUri: string): number {
        assert(this.$$namespaceArray, "please make sure that readNamespaceArray has been called");
        if (!this.$$namespaceArray) {
            throw new Error("please make sure that readNamespaceArray has been called");
        }
        return this.$$namespaceArray.indexOf(namespaceUri);
    }

    // ---------------------------------------- Alarm & condition stub
    public disableCondition(): void {
        /** empty */
    }

    public enableCondition(): void {
        /** empty */
    }

    public addCommentCondition(
        conditionId: NodeIdLike,
        eventId: Buffer,
        comment: LocalizedTextLike,
        callback: Callback<StatusCode>
    ): void;
    public addCommentCondition(conditionId: NodeIdLike, eventId: Buffer, comment: LocalizedTextLike): Promise<StatusCode>;
    public addCommentCondition(
        _conditionId: NodeIdLike,
        _eventId: Buffer,
        _comment: LocalizedTextLike,
        _callback?: Callback<StatusCode>
    ): unknown {
        /** empty */
        return undefined;
    }

    public confirmCondition(
        conditionId: NodeIdLike,
        eventId: Buffer,
        comment: LocalizedTextLike,
        callback: Callback<StatusCode>
    ): void;
    public confirmCondition(conditionId: NodeIdLike, eventId: Buffer, comment: LocalizedTextLike): Promise<StatusCode>;
    public confirmCondition(
        _conditionId: NodeIdLike,
        _eventId: Buffer,
        _comment: LocalizedTextLike,
        _callback?: Callback<StatusCode>
    ): unknown {
        /** empty */
        return undefined;
    }

    public acknowledgeCondition(
        conditionId: NodeId,
        eventId: Buffer,
        comment: LocalizedTextLike,
        callback: Callback<StatusCode>
    ): void;
    public acknowledgeCondition(conditionId: NodeId, eventId: Buffer, comment: LocalizedTextLike): Promise<StatusCode>;
    public acknowledgeCondition(
        _conditionId: NodeId,
        _eventId: Buffer,
        _comment: LocalizedTextLike,
        _callback?: Callback<StatusCode>
    ): unknown {
        /** empty */
        return undefined;
    }

    /**
     * @deprecated
     * @private
     */
    public findMethodId(nodeId: NodeIdLike, methodName: string, callback: ResponseCallback<NodeId>): void;
    public findMethodId(nodeId: NodeIdLike, methodName: string): Promise<NodeId>;
    public findMethodId(_nodeId: NodeIdLike, _methodName: string, _callback?: ResponseCallback<NodeId>): unknown {
        /** empty */
        return undefined;
    }

    public _callMethodCondition(
        _methodName: string,
        _conditionId: NodeIdLike,
        _eventId: Buffer,
        _comment: LocalizedTextLike,
        _callback: Callback<StatusCode>
    ): void {
        /** empty */
    }

    public async extractNamespaceDataType(): Promise<ExtraDataTypeManager> {
        return getExtraDataTypeManager(this);
    }
    public async getExtensionObjectConstructor(dataTypeNodeId: NodeId): Promise<AnyConstructorFunc> {
        return getExtensionObjectConstructor(this, dataTypeNodeId);
    }
    /**
     * construct a Extension object from a DataType and a pojo
     * @param dataType
     * @param pojo
     */
    public async constructExtensionObject(dataType: NodeId, pojo: Record<string, unknown>): Promise<ExtensionObject> {
        const Constructor = await this.getExtensionObjectConstructor(dataType);
        return new Constructor(pojo);
    }

    private _defaultRequest<TRequestOptions, TResponse extends Response>(
        requestClass: new (options: TRequestOptions) => Request,
        _responseClass: unknown,
        options: TRequestOptions,
        callback?: (err: Error | null, response?: TResponse) => void
    ): unknown {
        assert(typeof callback === "function");
        if (!callback) {
            throw new Error("_defaultRequest: expecting a callback function here");
        }

        const request: Request = options instanceof requestClass ? options : new requestClass(options);

        /* c8 ignore next */
        if (doDebug) {
            (request as unknown as { trace?: string }).trace = new Error("").stack;
        }

        /* c8 ignore next */
        if (this._closeEventHasBeenEmitted) {
            debugLog("ClientSession#_defaultRequest => session has been closed !!", request.toString());
            setImmediate(() => {
                callback(new Error("ClientSession is closed !"));
            });
            return undefined;
        }

        return this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            if (this._closeEventHasBeenEmitted) {
                debugLog(
                    "ClientSession#_defaultRequest ... err =",
                    err ? err.message : "null",
                    response ? response.toString() : " null"
                );
            }
            /* c8 ignore next */
            if (err) {
                debugLog("Client session : performMessageTransaction error = ", err.message);
                // let intercept interesting error message
                if (err.message.match(/BadSessionClosed/)) {
                    // the session has been closed by Server
                    // probably due to timeout issue
                    // let's print some statistics
                    const now = Date.now();

                    /* c8 ignore next */
                    if (doDebug) {
                        debugLog(chalk.bgWhite.red(" server send BadSessionClosed !"));
                        debugLog(chalk.bgWhite.red(" request was               "), request.toString());
                        debugLog(" timeout.................. ", this.timeout);
                        debugLog(
                            " lastRequestSentTime...... ",
                            new Date(this.lastRequestSentTime).toISOString(),
                            now - this.lastRequestSentTime.getTime()
                        );
                        debugLog(
                            " lastResponseReceivedTime. ",
                            new Date(this.lastResponseReceivedTime).toISOString(),
                            now - this.lastResponseReceivedTime.getTime()
                        );
                    }

                    //  DO NOT TERMINATE SESSION, as we will need a publishEngine when we
                    //  reconnect this._terminatePublishEngine();

                    // biome-ignore lint/correctness/noConstantCondition: deliberate debug on/off toggle, not dead code
                    if (false) {
                        // ER 10.2019
                        /**
                         * send when the session has been closed by the server ( probably due to inactivity and timeout)
                         * @event session_closed
                         */
                        this.emitCloseEvent(StatusCodes.BadSessionClosed);
                    }
                }
                return callback(err, response as TResponse | undefined);
            }
            callback(null, response as TResponse | undefined);
        });
    }
    #_recreate_session_and_reperform_transaction(request: Request, callback: (err: Error | null, response?: Response) => void) {
        warningLog("attempt to recreate session to reperform a transaction ", request.constructor.name);
        if (this.recursive_repair_detector >= 1) {
            warningLog("recreate_session_and_reperform_transaction => Already in Progress");
            return callback(new Error("Cannot recreate session"));
        }
        if (!this._client) {
            return callback(new Error("Cannot recreate session: session has no client"));
        }
        this.recursive_repair_detector += 1;
        warningLog(chalk.red("----------------> Repairing Client Session as Server believes it is invalid now "));
        repair_client_session(this._client, this, (err?: Error) => {
            this.recursive_repair_detector -= 1;
            if (err) {
                warningLog(chalk.red("----------------> session Repaired has failed with error", err.message));
                return callback(err);
            }
            warningLog(chalk.red("----------------> session Repaired, now redoing original transaction "));
            this._performMessageTransaction(request, callback);
        });
    }
}

async function promoteOpaqueStructureForCallMethodResult(
    session: IBasicSessionAsync2,
    callMethodResult: CallMethodResult
): Promise<void> {
    if (!callMethodResult?.outputArguments || callMethodResult.outputArguments.length === 0) {
        return;
    }
    await promoteOpaqueStructure(
        session,
        callMethodResult.outputArguments.map((a) => ({ value: a }))
    );
}

function countOpaqueStructures(callMethodResults: CallMethodResult[]): number {
    const x = (a: Variant[] | null): PseudoDataValue[] => {
        if (a === null) return [] as PseudoDataValue[];
        return a.map((value) => {
            return { value: value };
        });
    };
    const opaqueStructureCount = callMethodResults.reduce((prev, callMethodResult) => {
        return prev + extractDataValueToPromote(x(callMethodResult.outputArguments)).length;
    }, 0);
    return opaqueStructureCount;
}

async function promoteOpaqueStructureForCall(session: IBasicSessionAsync2, callMethodResults: CallMethodResult[]): Promise<void> {
    const opaqueStructureCount = countOpaqueStructures(callMethodResults);
    if (0 === opaqueStructureCount) return;

    // construct dataTypeManager if not already present
    await getExtraDataTypeManager(session);

    const promises: Promise<void>[] = callMethodResults.map(async (x: CallMethodResult) =>
        promoteOpaqueStructureForCallMethodResult(session, x)
    );
    await Promise.all(promises);
}

import { withCallback } from "thenify-ex";

const opts = { multiArgs: false };

ClientSessionImpl.prototype.browse = withCallback(ClientSessionImpl.prototype.browse, opts);
ClientSessionImpl.prototype.browseNext = withCallback(ClientSessionImpl.prototype.browseNext, opts);
ClientSessionImpl.prototype.readVariableValue = withCallback(ClientSessionImpl.prototype.readVariableValue, opts);
ClientSessionImpl.prototype.readHistoryValue = withCallback(ClientSessionImpl.prototype.readHistoryValue, opts);
ClientSessionImpl.prototype.readAggregateValue = withCallback(ClientSessionImpl.prototype.readAggregateValue, opts);
ClientSessionImpl.prototype.historyRead = withCallback(ClientSessionImpl.prototype.historyRead, opts);
ClientSessionImpl.prototype.write = withCallback(ClientSessionImpl.prototype.write, opts);
ClientSessionImpl.prototype.writeSingleNode = withCallback(ClientSessionImpl.prototype.writeSingleNode, opts);
ClientSessionImpl.prototype.readAllAttributes = withCallback(ClientSessionImpl.prototype.readAllAttributes, opts);
ClientSessionImpl.prototype.read = withCallback(ClientSessionImpl.prototype.read, opts);
ClientSessionImpl.prototype.createSubscription = withCallback(ClientSessionImpl.prototype.createSubscription, opts);
ClientSessionImpl.prototype.createSubscription2 = withCallback(ClientSessionImpl.prototype.createSubscription2, opts);
ClientSessionImpl.prototype.deleteSubscriptions = withCallback(ClientSessionImpl.prototype.deleteSubscriptions, opts);
ClientSessionImpl.prototype.transferSubscriptions = withCallback(ClientSessionImpl.prototype.transferSubscriptions, opts);
ClientSessionImpl.prototype.createMonitoredItems = withCallback(ClientSessionImpl.prototype.createMonitoredItems, opts);
ClientSessionImpl.prototype.modifyMonitoredItems = withCallback(ClientSessionImpl.prototype.modifyMonitoredItems, opts);
ClientSessionImpl.prototype.modifySubscription = withCallback(ClientSessionImpl.prototype.modifySubscription, opts);
ClientSessionImpl.prototype.setTriggering = withCallback(ClientSessionImpl.prototype.setTriggering, opts);
ClientSessionImpl.prototype.setMonitoringMode = withCallback(ClientSessionImpl.prototype.setMonitoringMode, opts);
ClientSessionImpl.prototype.publish = withCallback(ClientSessionImpl.prototype.publish, opts);
ClientSessionImpl.prototype.republish = withCallback(ClientSessionImpl.prototype.republish, opts);
ClientSessionImpl.prototype.deleteMonitoredItems = withCallback(ClientSessionImpl.prototype.deleteMonitoredItems, opts);
ClientSessionImpl.prototype.setPublishingMode = withCallback(ClientSessionImpl.prototype.setPublishingMode, opts);
ClientSessionImpl.prototype.translateBrowsePath = withCallback(ClientSessionImpl.prototype.translateBrowsePath, opts);
ClientSessionImpl.prototype.performMessageTransaction = withCallback(ClientSessionImpl.prototype.performMessageTransaction, opts);
ClientSessionImpl.prototype.close = withCallback(ClientSessionImpl.prototype.close, opts);
ClientSessionImpl.prototype.call = withCallback(ClientSessionImpl.prototype.call, opts);
ClientSessionImpl.prototype.getMonitoredItems = withCallback(ClientSessionImpl.prototype.getMonitoredItems, opts);
ClientSessionImpl.prototype.getArgumentDefinition = withCallback(ClientSessionImpl.prototype.getArgumentDefinition, opts);
ClientSessionImpl.prototype.queryFirst = withCallback(ClientSessionImpl.prototype.queryFirst, opts);
ClientSessionImpl.prototype.registerNodes = withCallback(ClientSessionImpl.prototype.registerNodes, opts);
ClientSessionImpl.prototype.unregisterNodes = withCallback(ClientSessionImpl.prototype.unregisterNodes, opts);
ClientSessionImpl.prototype.readNamespaceArray = withCallback(ClientSessionImpl.prototype.readNamespaceArray, opts);
ClientSessionImpl.prototype.getBuiltInDataType = withCallback(ClientSessionImpl.prototype.getBuiltInDataType, opts);
ClientSessionImpl.prototype.changeUser = withCallback(ClientSessionImpl.prototype.changeUser, opts);
