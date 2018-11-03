/**
 * @module node-opcua-client-private
 */
import chalk from "chalk";
import { EventEmitter } from "events";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { DateTime, UInt8 } from "node-opcua-basic-types";
import { ReferenceTypeIds, StatusCodes } from "node-opcua-constants";
import { Certificate, Nonce } from "node-opcua-crypto";
import {
    AttributeNameById,
    BrowseDirection,
    LocalizedTextLike,
    makeResultMask
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { coerceNodeId, makeNodeId, NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { ErrorCallback, SignatureData } from "node-opcua-secure-channel";
import {
    BrowseDescription, BrowseDescriptionOptions, BrowseRequest, BrowseResponse, BrowseResult
} from "node-opcua-service-browse";
import {
    CallMethodRequest, CallMethodRequestOptions, CallMethodResult, CallRequest, CallResponse
} from "node-opcua-service-call";
import { EndpointDescription } from "node-opcua-service-endpoints";
import {
    HistoryReadRequest, HistoryReadRequestOptions, HistoryReadResponse, HistoryReadResult, ReadRawModifiedDetails
} from "node-opcua-service-history";
import {
    QueryFirstRequest, QueryFirstRequestOptions, QueryFirstResponse, QueryNextRequest, QueryNextResponse
} from "node-opcua-service-query";
import {
    AttributeIds, ReadRequest,
    ReadResponse, ReadValueId, ReadValueIdOptions, TimestampsToReturn
} from "node-opcua-service-read";
import {
    RegisterNodesRequest,
    RegisterNodesResponse,
    UnregisterNodesRequest,
    UnregisterNodesResponse
} from "node-opcua-service-register-node";
import {
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsRequestOptions,
    CreateMonitoredItemsResponse,
    CreateSubscriptionRequest,
    CreateSubscriptionRequestOptions,
    CreateSubscriptionResponse,
    DeleteMonitoredItemsRequest,
    DeleteMonitoredItemsRequestOptions,
    DeleteMonitoredItemsResponse,
    DeleteSubscriptionsRequest,
    DeleteSubscriptionsRequestOptions,
    DeleteSubscriptionsResponse,
    ModifyMonitoredItemsRequest,
    ModifyMonitoredItemsRequestOptions,
    ModifyMonitoredItemsResponse,
    ModifySubscriptionRequest,
    ModifySubscriptionRequestOptions,
    ModifySubscriptionResponse,
    PublishRequest,
    PublishResponse,
    RepublishRequest,
    RepublishResponse,
    SetMonitoringModeRequest,
    SetMonitoringModeRequestOptions,
    SetMonitoringModeResponse,
    SetPublishingModeRequest,
    SetPublishingModeResponse,
    TransferSubscriptionsRequest, TransferSubscriptionsRequestOptions, TransferSubscriptionsResponse,

} from "node-opcua-service-subscription";
import {
    BrowsePath, BrowsePathResult,
    TranslateBrowsePathsToNodeIdsRequest,
    TranslateBrowsePathsToNodeIdsResponse
} from "node-opcua-service-translate-browse-path";
import {
    WriteRequest, WriteResponse, WriteValue, WriteValueOptions
} from "node-opcua-service-write";
import { StatusCode } from "node-opcua-status-code";
import { getFunctionParameterNames, isNullOrUndefined, lowerFirstLetter } from "node-opcua-utils";
import { DataType, Variant, VariantLike, VariantOptions } from "node-opcua-variant";

import { ClientSessionKeepAliveManager } from "../client_session_keepalive_manager";
import { ClientSubscription } from "../client_subscription";
import { Request, Response } from "../common";
import { ClientSidePublishEngine } from "./client_publish_engine";

import { OPCUAClientBase } from "../client_base";
import {
    ArgumentDefinition,
    BrowseDescriptionLike, CallMethodRequestLike,
    ClientSession,
    CreateMonitoredItemsRequestLike,
    CreateSubscriptionOptions,
    CreateSubscriptionRequestLike, DeleteMonitoredItemsRequestLike,
    DeleteSubscriptionsRequestLike, MethodId,
    ModifyMonitoredItemsRequestLike,
    ModifySubscriptionRequestLike, MonitoredItemData,
    NodeAttributes, QueryFirstRequestLike, ReadValueIdLike,
    SetMonitoringModeRequestLike, SubscriptionId,
    TransferSubscriptionsRequestLike,
    WriteValueLike
} from "../client_session";
import { ClientSubscriptionImpl } from "./client_subscription_impl";
import { OPCUAClientImpl } from "./opcua_client_impl";

export type ResponseCallback<T> = (err: Error | null, response?: T) => void;

const resultMask = makeResultMask("ReferenceType");

const helpAPIChange = process.env.DEBUG && process.env.DEBUG.match(/API/);
const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = debugLog;

function coerceBrowseDescription(data: any): BrowseDescription {
    if (typeof data === "string" || data instanceof NodeId) {
        return coerceBrowseDescription({
            browseDirection: BrowseDirection.Both,
            includeSubtypes: true,
            nodeClassMask: 0,
            nodeId: data,
            resultMask: 63
        });
    } else {
        data.nodeId = resolveNodeId(data.nodeId);
        data.referenceTypeId = data.referenceTypeId ? resolveNodeId(data.referenceTypeId) : null;
        return new BrowseDescription(data);
    }
}

function coerceReadValueId(node: any): ReadValueId {

    if (typeof node === "string" || node instanceof NodeId) {
        return new ReadValueId({
            attributeId: AttributeIds.Value,
            dataEncoding: undefined, // {namespaceIndex: 0, name: undefined}
            indexRange: undefined,
            nodeId: resolveNodeId(node),
        });

    } else {
        assert(node instanceof Object);
        return new ReadValueId(node);
    }
}

const keys = Object.keys(AttributeIds).filter(
    (k: any) => (AttributeIds as any)[k] !== AttributeIds.INVALID);

const attributeNames: string[] = ((): string[] => {
    const r = [];
    for (let i = 1; i <= 22; i++) {
        r.push(AttributeNameById[i]);
    }
    return r;
})();

function composeResult(nodes: any[], nodesToRead: ReadValueIdLike[], dataValues: DataValue[]): NodeAttributes[] {

    assert(nodesToRead.length === dataValues.length);
    let c = 0;
    const results = [];
    let dataValue;
    let k;
    let nodeToRead;

    for (const node of nodes) {

        const data: NodeAttributes = {
            nodeId: resolveNodeId(node),
            statusCode: StatusCodes.BadNodeIdUnknown,
        };

        let addedProperty = 0;

        for (const key of attributeNames) {
            dataValue = dataValues[c];
            nodeToRead = nodesToRead[c];
            c++;
            if (dataValue.statusCode.equals(StatusCodes.Good)) {
                k = lowerFirstLetter(key);
                data[k] = dataValue.value ? dataValue.value.value : null;
                addedProperty += 1;
            }
        }

        if (addedProperty > 0) {
            data.statusCode = StatusCodes.Good;
        } else {
            data.statusCode = StatusCodes.BadNodeIdUnknown;
        }
        results.push(data);
    }

    return results;
}

function __findBasicDataType(
    session: ClientSession,
    dataTypeId: NodeId,
    callback: (err: Error | null, dataType?: DataType) => void
) {

    assert(dataTypeId instanceof NodeId);

    if (dataTypeId.value <= 25) {
        // we have a well-known DataType
        const dataTypeName = DataType[dataTypeId.value];
        callback(null, dataTypeId.value as DataType);
    } else {

        // let's browse for the SuperType of this object
        const nodeToBrowse = new BrowseDescription({
            browseDirection: BrowseDirection.Inverse,
            includeSubtypes: false,
            nodeId: dataTypeId,
            referenceTypeId: makeNodeId(ReferenceTypeIds.HasSubtype),
            resultMask
        });

        session.browse(nodeToBrowse, (err: Error | null, browseResult?: BrowseResult) => {

            if (err) {
                return callback(err);
            }

            if (!browseResult) {
                return callback(new Error("Internal Error"));
            }

            browseResult.references = browseResult.references || [];
            const baseDataType = browseResult.references[0].nodeId;
            return __findBasicDataType(session, baseDataType, callback);
        });
    }
}

const emptyUint32Array = new Uint32Array(0);

/**
 * @class ClientSession
 * @param client {OPCUAClientImpl}
 * @constructor
 * @private
 */
export class ClientSessionImpl extends EventEmitter implements ClientSession {

    public timeout: number;
    public authenticationToken?: NodeId;
    public requestedMaxReferencesPerNode: number;
    public sessionId: NodeId;
    public lastRequestSentTime: Date;
    public lastResponseReceivedTime: Date;
    public serverCertificate: Certificate;
    public serverNonce?: Nonce;
    public name = "";
    public serverSignature?: SignatureData; // todo : remove ?
    public serverEndpoints: any[] = [];
    public _client: any;
    public _closed: boolean;

    /**
     * @internal
     */
    public _closeEventHasBeenEmitted: boolean;
    private _publishEngine: ClientSidePublishEngine | null;
    private _keepAliveManager?: ClientSessionKeepAliveManager;
    private _namespaceArray?: any;

    constructor(client: any) {

        super();

        this.serverCertificate = Buffer.alloc(0);

        this.sessionId = NodeId.nullNodeId;

        this._closeEventHasBeenEmitted = false;
        this._client = client;
        this._publishEngine = null;
        this._closed = false;
        this.requestedMaxReferencesPerNode = 10000;
        this.lastRequestSentTime = new Date(1, 1, 1970);
        this.lastResponseReceivedTime = new Date(1, 1, 1970);
        this.timeout = 0;

    }

    /**
     * the endpoint on which this session is operating
     * @property endpoint
     * @type {EndpointDescription}
     */
    get endpoint(): EndpointDescription {
        return this._client.endpoint;
    }

    get subscriptionCount(): number {
        return this._publishEngine ? this._publishEngine.subscriptionCount : 0;
    }

    get isReconnecting() {
        return this._client ? this._client.isReconnecting : false;
    }

    public getPublishEngine(): ClientSidePublishEngine {

        if (!this._publishEngine) {

            this._publishEngine = new ClientSidePublishEngine(this);
        }
        return this._publishEngine!;
    }

    /**
     * @method browse
     * @async
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
     *   ``` javascript
     *    const browseDescriptions = [
     *      {
     *          nodeId: "ObjectsFolder",
     *          referenceTypeId: "Organizes",
     *          browseDirection: BrowseDirection.Inverse,
     *          includeSubtypes: true,
     *          nodeClassMask: 0,
     *          resultMask: 63
     *      },
     *      // {...}
     *    ]
     *    session.browse(browseDescriptions,function(err, browseResults) {
     *
     *    });
     *    ```
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
    public browse(...args: any[]): any {

        const arg0 = args[0];
        const isArray = _.isArray(arg0);
        const callback: any = args[1];
        assert(_.isFunction(callback));

        assert(_.isFinite(this.requestedMaxReferencesPerNode));

        const nodesToBrowse: BrowseDescription[] =
            (isArray ? arg0 : [arg0 as BrowseDescription]).map(coerceBrowseDescription);

        const request = new BrowseRequest({
            nodesToBrowse,
            requestedMaxReferencesPerNode: this.requestedMaxReferencesPerNode,
        });

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            if (err) {
                return callback(err);
            }

            if (!response || !(response instanceof BrowseResponse)) {
                return callback(new Error("Internal Error"));
            }

            const results: BrowseResult[] = response.results ? response.results : [];

            if (this.requestedMaxReferencesPerNode > 0) {

                for (let i = 0; i < results.length; i++) {

                    const r = results[i];

                    /* istanbul ignore next */
                    if (r.references && r.references.length > this.requestedMaxReferencesPerNode) {
                        warningLog(chalk.yellow("warning") + " BrowseResponse : server didn't take into" +
                            " account our requestedMaxReferencesPerNode ");
                        warningLog("        this.requestedMaxReferencesPerNode= " + this.requestedMaxReferencesPerNode);
                        warningLog("        got " + r.references.length + "for " + nodesToBrowse[i].nodeId.toString());
                        warningLog("        continuationPoint ", r.continuationPoint);
                    }
                }
            }
            for (const r of results) {
                r.references = r.references || [];
            }

            // detect unsupported case :
            // todo implement proper support for r.continuationPoint
            for (const r of results) {

                if (r.continuationPoint !== null) {
                    warningLog(chalk.yellow(" warning:"), " BrowseResponse : server didn't send all references " +
                        "and has provided a continuationPoint. Unfortunately we do not support this yet");
                    warningLog("           this.requestedMaxReferencesPerNode = ", this.requestedMaxReferencesPerNode);
                    warningLog("           continuationPoint ", r.continuationPoint);
                }
            }
            assert(results[0] instanceof BrowseResult);
            return callback(null, isArray ? results : results[0]);
        });
    }

    /**
     * @method readVariableValue
     * @async
     *
     * @example
     *
     *     session.readVariableValue("ns=2;s=Furnace_1.Temperature",function(err,dataValue) {
     *        if(err) { return callback(err); }
     *        if (dataValue.statusCode === opcua.StatusCodes.Good) {
     *        }
     *        console.log(dataValue.toString());
     *        callback();
     *     });
     *
     * @example
     *
     *   session.readVariableValue(["ns=0;i=2257","ns=0;i=2258"],function(err,dataValues) {
     *      if (!err) {
     *         console.log(dataValues[0].toString());
     *         console.log(dataValues[1].toString());
     *      }
     *   });
     *
     * @example
     *     const dataValues = await session.readVariableValue(["ns=1;s=Temperature","ns=1;s=Pressure"]);
     */
    public readVariableValue(nodeId: NodeIdLike, callback: ResponseCallback<DataValue>): void;

    public readVariableValue(nodeIds: NodeIdLike[], callback: ResponseCallback<DataValue[]>): void;

    public async readVariableValue(nodeId: NodeIdLike): Promise<DataValue>;

    public async readVariableValue(nodeIds: NodeIdLike[]): Promise<DataValue[]>;
    /**
     * @internal
     * @param args
     */
    public readVariableValue(...args: any []): any {

        const callback = args[1];
        assert(_.isFunction(callback));

        const isArray = _.isArray(args[0]);

        const nodes = isArray ? args[0] : [args[0]];

        const nodesToRead = nodes.map(coerceReadValueId);

        const request = new ReadRequest({
            nodesToRead,
            timestampsToReturn: TimestampsToReturn.Neither
        });

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }

            if (!(response instanceof ReadResponse)) {
                return callback(new Error("Internal Error"));
            }

            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
                return callback(new Error(response.responseHeader.serviceResult.toString()));
            }

            if (!response.results) {
                response.results = [];
            }

            assert(nodes.length === response.results.length);

            callback(null, isArray ? response.results : response.results[0]);
        });
    }

    /**
     * @method readHistoryValue
     * @async
     *
     * @example
     *
     *     session.readHistoryValue(
     *                 "ns=5;s=Simulation Examples.Functions.Sine1",
     *                 "2015-06-10T09:00:00.000Z",
     *                 "2015-06-10T09:01:00.000Z", function(err,dataValues) {
     *
     *                 });
     *
     * @param nodes   the read value id
     * @param start   the starttime in UTC format
     * @param end     the endtime in UTC format
     */
    public readHistoryValue(
        nodes: ReadValueIdLike[],
        start: DateTime,
        end: DateTime,
        callback: (err: Error | null, results?: HistoryReadResult[]) => void): void;
    public async readHistoryValue(
      nodes: ReadValueIdLike[],
      start: DateTime,
      end: DateTime
    ): Promise<HistoryReadResult[]>;

    public readHistoryValue(
        node: ReadValueIdLike,
        start: DateTime,
        end: DateTime,
        callback: (err: Error | null, results?: HistoryReadResult) => void): void;
    public async readHistoryValue(
      nodes: ReadValueIdLike,
      start: DateTime,
      end: DateTime
    ): Promise<HistoryReadResult>;

    public readHistoryValue(...args: any[]): any {

        const start = args[1];
        const end = args[2];
        const callback = args[3];
        assert(_.isFunction(callback));

        const arg0 = args[0];
        const isArray = _.isArray(arg0);

        const nodes = isArray ? arg0 : [arg0];

        const nodesToRead = [];
        const historyReadDetails = [];

        for (const node of nodes) {
            nodesToRead.push({
                continuationPoint: undefined,
                dataEncoding: undefined, // {namespaceIndex: 0, name: undefined},
                indexRange: undefined,
                nodeId: resolveNodeId(node),
            });
        }

        const readRawModifiedDetails = new ReadRawModifiedDetails({
            endTime: end,
            isReadModified: false,
            numValuesPerNode: 0,
            returnBounds: true,
            startTime: start,
        });

        const request = new HistoryReadRequest({
            historyReadDetails: readRawModifiedDetails,
            nodesToRead,
            releaseContinuationPoints: false,
            timestampsToReturn: TimestampsToReturn.Both,
        });

        request.nodesToRead = request.nodesToRead || [];

        assert(nodes.length === request.nodesToRead.length);
        this.performMessageTransaction(request, (err: Error | null, response) => {

            if (err) {
                return callback(err);
            }
            if (!response || !(response instanceof HistoryReadResponse)) {
                return callback(new Error("Internal Error"));
            }

            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
                return callback(new Error(response.responseHeader.serviceResult.toString()));
            }

            response.results = response.results || [];

            assert(nodes.length === response.results.length);

            callback(null, isArray ? response.results : response.results[0]);
        });
    }

    /**
     *
     * @method write
     * @param nodesToWrite {WriteValue[]}  - the array of value to write. One or more elements.
     * @param {Function} callback -   the callback function
     * @param callback.err {object|null} the error if write has failed or null if OK
     * @param callback.statusCodes {StatusCode[]} - an array of status code of each write
     * @async
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
     * @method write
     * @param nodeToWrite {WriteValue}  - the value to write
     * @param callback -   the callback function
     * @param callback.err {object|null} the error if write has failed or null if OK
     * @param callback.statusCode {StatusCodes} - the status code of the write
     * @async
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
     * @method write
     * @param nodeToWrite {WriteValue}  - the value to write
     * @return {Promise<StatusCode>}
     * @async
     *
     * @example
     *   session.write(nodeToWrite).then(function(statusCode) { });
     *
     * @example
     *   const statusCode = await session.write(nodeToWrite);
     *
     * @method write
     * @param nodesToWrite {Array<WriteValue>}  - the value to write
     * @return {Promise<Array<StatusCode>>}
     * @async
     *
     * @example
     *   session.write(nodesToWrite).then(function(statusCodes) { });
     *
     * @example
     *   const statusCodes = await session.write(nodesToWrite);
     */
    public write(nodeToWrite: WriteValueLike, callback: ResponseCallback<StatusCode>): void;

    public write(nodesToWrite: WriteValueLike[], callback: ResponseCallback<StatusCode[]>): void;

    public async write(nodesToWrite: WriteValueLike[]): Promise<StatusCode[]>;

    public async write(nodeToWrite: WriteValueLike): Promise<StatusCode>;

    /**
     * @internal
     * @param args
     */
    public write(...args: any[]): any {

        const arg0 = args[0];
        const isArray = _.isArray(arg0);
        const nodesToWrite = isArray ? arg0 : [arg0];

        const callback = args[1];
        assert(_.isFunction(callback));

        const request = new WriteRequest({nodesToWrite});

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            /* istanbul ignore next */
            if (err) {
                return callback(err, response);
            }
            if (!response || !(response instanceof WriteResponse)) {
                return callback(new Error("Internal Error"));
            }

            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {
                return callback(new Error(response.responseHeader.serviceResult.toString()));
            }
            response.results = response.results || [];
            assert(nodesToWrite.length === response.results.length);
            callback(null, isArray ? response.results : response.results[0]);
        });
    }

    /**
     *
     * @method writeSingleNode
     * @async
     * @param nodeId  {NodeId}  - the node id of the node to write
     * @param value   {Variant} - the value to write
     * @param callback   {Function}
     * @param callback.err {object|null} the error if write has failed or null if OK
     * @param callback.statusCode {StatusCode} - the status code of the write
     *
     * @method writeSingleNode
     * @async
     * @param nodeId  {NodeId}  - the node id of the node to write
     * @param value   {Variant} - the value to write
     * @return {Promise<StatusCode>} - the status code of the write
     *
     */
    public writeSingleNode(nodeId: NodeIdLike, value: VariantLike, callback: ResponseCallback<StatusCode>): void;

    public writeSingleNode(nodeId: NodeIdLike, value: VariantLike): Promise<StatusCode>;

    public writeSingleNode(...args: any[]): any {

        const nodeId = args[0];
        const value = args[1];
        const callback = args[2];

        assert(_.isFunction(callback));

        const nodeToWrite = new WriteValue({
            attributeId: AttributeIds.Value,
            indexRange: undefined,
            nodeId: resolveNodeId(nodeId),
            value: new DataValue({value})
        });

        this.write(nodeToWrite, (err, statusCode) => {

            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            assert(statusCode);
            callback(null, statusCode);
        });
    }

    /**
     * @method readAllAttributes
     *
     * @example
     *
     *
     *    ``` javascript
     *    session.readAllAttributes("ns=2;s=Furnace_1.Temperature",function(err,data) {
     *       if(data.statusCode === StatusCode.Good) {
     *          console.log(" nodeId      = ",data.nodeId.toString());
     *          console.log(" browseName  = ",data.browseName.toString());
     *          console.log(" description = ",data.description.toString());
     *          console.log(" value       = ",data.value.toString()));
     *
     *       }
     *    });
     *    ```
     *
     * @async
     * @param nodes  array of nodeId to read
     * @param node  nodeId to read
     * @param callback
     */
    public readAllAttributes(node: NodeIdLike, callback: (err: Error | null, data?: NodeAttributes) => void): void;

    public readAllAttributes(nodes: NodeIdLike[], callback: (err: Error | null, data?: NodeAttributes[]) => void): void;

    public readAllAttributes(...args: any[]): void {

        const arg0 = args[0];
        const callback = args[1];
        assert(_.isFunction(callback));

        const isArray = _.isArray(arg0);

        const nodes = isArray ? arg0 : [arg0];

        const nodesToRead: ReadValueIdOptions[] = [];

        for (const node of nodes) {
            const nodeId = resolveNodeId(node);
            if (!nodeId) {
                throw new Error("cannot coerce " + node + " to a valid NodeId");
            }
            for (let attributeId = 1; attributeId <= 22; attributeId++) {
                nodesToRead.push({
                    attributeId,
                    dataEncoding: undefined,
                    indexRange: undefined,
                    nodeId,
                });
            }
        }

        this.read(nodesToRead, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return callback(err);
            }
            if (!dataValues) {
                return callback(new Error("Internal Error"));
            }

            const results = composeResult(nodes, nodesToRead, dataValues);
            callback(err, isArray ? results : results[0]);
        });

    }

    /**
     * @method read (form1)
     * @param nodeToRead               {ReadValueId}
     * @param nodeToRead.nodeId        {NodeId|string}
     * @param nodeToRead.attributeId   {AttributeIds}
     * @param [maxAge]                 {Number}
     * @param callback                 {Function}                - the callback function
     * @param callback.err             {Error|null}              - the error or null if the transaction was OK}
     * @param callback.dataValue       {DataValue}
     * @async
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
     * @method read (form2)
     * @param nodesToRead               {Array<ReadValueId>} - an array of nodeId to read or a ReadValueId
     * @param [maxAge]                 {Number}
     * @param callback                 {Function}                - the callback function
     * @param callback.err             {Error|null}              - the error or null if the transaction was OK}
     * @param callback.dataValues       {Array<DataValue>}
     * @async
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
     * @method read_form3
     * @param nodeToRead               {ReadValueId}
     * @param nodeToRead.nodeId        {NodeId|string}
     * @param nodeToRead.attributeId   {AttributeIds}
     * @param [maxAge]                 {Number}
     * @return {Promise<DataValue>}
     * @async
     *
     *
     * @method read_form4
     * @param nodesToRead               {Array<ReadValueId>}
     * @param [maxAge]                  {Number}
     * @return {Promise<Array<DataValue>>}
     * @async
     *
     */
    public read(nodeToRead: ReadValueIdLike, maxAge: number, callback: ResponseCallback<DataValue>): void;

    public read(nodesToRead: ReadValueIdLike[], maxAge: number, callback: ResponseCallback<DataValue[]>): void;

    public read(nodeToRead: ReadValueIdLike, callback: ResponseCallback<DataValue>): void;

    public read(nodesToRead: ReadValueIdLike[], callback: ResponseCallback<DataValue[]>): void;

    public read(nodeToRead: ReadValueIdLike, maxAge?: number): Promise<DataValue>;

    public read(nodeToRead: ReadValueIdLike[], maxAge?: number): Promise<DataValue[]>;

    /**
     * @internal
     * @param args
     */
    public read(...args: any[]): any {

        if (args.length === 2) {
            return this.read(args[0], 0, args[1]);
        }
        assert(args.length === 3);

        const isArray = _.isArray(args[0]);

        const nodesToRead = isArray ? args[0] : [args[0]];

        assert(_.isArray(nodesToRead));

        const maxAge = args[1];

        const callback = args[2];
        assert(_.isFunction(callback));

        if (helpAPIChange) {
            // the read method deprecation detection and warning
            if (!(getFunctionParameterNames(callback)[1] === "dataValues"
                || getFunctionParameterNames(callback)[1] === "dataValue")) {
                warningLog(chalk.red("ERROR ClientSession#read  API has changed !!, please fix the client code"));
                warningLog(chalk.red("   replace ..:"));
                warningLog(chalk.cyan("   session.read(nodesToRead,function(err,nodesToRead,results) {}"));
                warningLog(chalk.red("   with .... :"));
                warningLog(chalk.cyan("   session.read(nodesToRead,function(err,dataValues) {}"));
                warningLog("");
                warningLog(chalk.yellow("please make sure to refactor your code and check that " +
                    "the second argument of your callback function is named"),
                    chalk.cyan("dataValue" + (isArray ? "s" : "")));
                warningLog(chalk.cyan("to make this exception disappear"));
                throw new Error("ERROR ClientSession#read  API has changed !!, please fix the client code");
            }
        }

        // coerce nodeIds
        for (const node of nodesToRead) {
            node.nodeId = resolveNodeId(node.nodeId);
        }

        const request = new ReadRequest({
            maxAge,
            nodesToRead,
            timestampsToReturn: TimestampsToReturn.Both
        });

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            /* istanbul ignore next */
            if (err) {
                return callback(err, response);
            }
            if (!response || !(response instanceof ReadResponse)) {
                return callback(new Error("Internal Error"));
            }

            response.results = response.results || [];

            return callback(null, isArray ? response.results : response.results[0]);

        });
    }

    public emitCloseEvent(statusCode: StatusCode): void {

        if (!this._closeEventHasBeenEmitted) {
            debugLog("ClientSession#emitCloseEvent");
            this._closeEventHasBeenEmitted = true;
            this.emit("session_closed", statusCode);
        }
    }

    /**
     * @method createSubscription
     * @async
     *
     * @example:
     *
     *    ``` javascript
     *    session.createSubscription(request,function(err,response) {} );
     *    ```
     *
     * @param options {CreateSubscriptionRequest}
     * @param options.requestedPublishingInterval {Duration}
     * @param options.requestedLifetimeCount {Counter}
     * @param options.requestedMaxKeepAliveCount {Counter}
     * @param options.maxNotificationsPerPublish {Counter}
     * @param options.publishingEnabled {Boolean}
     * @param options.priority {Byte}
     * @param callback {Function}
     * @param callback.err {Error|null}   - the Error if the async method has failed
     * @param callback.response {CreateSubscriptionResponse} - the response
     */

    public createSubscription(
        options: CreateSubscriptionRequestLike,
        callback: (err: Error | null, response?: CreateSubscriptionResponse) => void) {

        assert(_.isFunction(callback));

        const request = new CreateSubscriptionRequest(options);

        this.performMessageTransaction(request, (err, response) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            /* istanbul ignore next */
            if (!(response instanceof CreateSubscriptionResponse)) {
                return callback(new Error("Internal Error"));
            }
            callback(null, response);
        });
    }

    /**
     * @method createSubscription2
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
    public async createSubscription2(
        createSubscriptionRequest: CreateSubscriptionRequestLike): Promise<ClientSubscription>;
    public createSubscription2(
        createSubscriptionRequest: CreateSubscriptionRequestLike,
        callback: (err: Error | null, subscription?: ClientSubscription) => void
    ): void;
    public createSubscription2(...args: any[]): any {

        const createSubscriptionRequest = args[0] as CreateSubscriptionRequestLike;
        const callback = args[1];
        const subscription = new ClientSubscriptionImpl(this, createSubscriptionRequest);

        // tslint:disable-next-line:no-empty
        subscription.on("error", () => {

        });
        subscription.on("started", () => {
            assert(subscription.session === this, "expecting a session here");
            callback(null, subscription);
        });
    }

    /**
     * @method deleteSubscriptions
     * @async
     * @example:
     *
     *     session.deleteSubscriptions(request,function(err,response) {} );
     */
    public deleteSubscriptions(
        options: DeleteSubscriptionsRequestLike,
        callback: (err: Error | null, response?: DeleteSubscriptionsResponse) => void
    ) {
        this._defaultRequest(DeleteSubscriptionsRequest, DeleteSubscriptionsResponse, options, callback);
    }

    /**
     * @method transferSubscriptions
     * @async
     */
    public transferSubscriptions(
        options: TransferSubscriptionsRequestLike,
        callback: (err: Error | null, response?: TransferSubscriptionsResponse) => void
    ) {
        this._defaultRequest(
            TransferSubscriptionsRequest,
            TransferSubscriptionsResponse,
            options, callback);
    }

    /**
     *
     * @method createMonitoredItems
     * @async
     * @param callback.response {CreateMonitoredItemsResponse} - the response
     */
    public createMonitoredItems(
        options: CreateMonitoredItemsRequestLike,
        callback: (err: Error | null, response?: CreateMonitoredItemsResponse) => void
    ) {
        this._defaultRequest(
            CreateMonitoredItemsRequest,
            CreateMonitoredItemsResponse,
            options, callback);
    }

    /**
     *
     * @method modifyMonitoredItems
     * @async
     */
    public modifyMonitoredItems(
        options: ModifyMonitoredItemsRequestLike,
        callback: (err: Error | null, response?: ModifyMonitoredItemsResponse) => void
    ) {
        this._defaultRequest(
            ModifyMonitoredItemsRequest,
            ModifyMonitoredItemsResponse,
            options, callback);
    }

    /**
     *
     * @method modifySubscription
     * @async
     * @param options {ModifySubscriptionRequest}
     * @param callback {Function}
     * @param callback.err {Error|null}   - the Error if the async method has failed
     * @param callback.response {ModifySubscriptionResponse} - the response
     */
    public modifySubscription(
        options: ModifySubscriptionRequestLike,
        callback: (err: Error | null, response?: ModifySubscriptionResponse) => void
    ) {
        this._defaultRequest(
            ModifySubscriptionRequest,
            ModifySubscriptionResponse,
            options, callback);
    }

    public setMonitoringMode(
        options: SetMonitoringModeRequestLike,
        callback: (err: Error | null, response?: SetMonitoringModeResponse) => void
    ) {
        this._defaultRequest(
            SetMonitoringModeRequest,
            SetMonitoringModeResponse,
            options, callback);
    }

    /**
     *
     * @method publish
     * @async
     * @param options  {PublishRequest}
     * @param callback {Function}
     * @param callback.err {Error|null}   - the Error if the async method has failed
     * @param callback.response {PublishResponse} - the response
     */
    public publish(
        options: PublishRequest,
        callback: (err: Error | null, response?: PublishResponse) => void
    ) {
        this._defaultRequest(
            PublishRequest,
            PublishResponse,
            options, callback);
    }

    /**
     *
     * @method republish
     * @async
     * @param options  {RepublishRequest}
     * @param callback {Function}
     * @param callback.err {Error|null}   - the Error if the async method has failed
     * @param callback.response {RepublishResponse} - the response
     */
    public republish(
        options: RepublishRequest,
        callback: (err: Error | null, response?: RepublishResponse) => void
    ) {
        this._defaultRequest(
            RepublishRequest,
            RepublishResponse,
            options, callback);
    }

    /**
     *
     * @method deleteMonitoredItems
     * @async
     * @param options  {DeleteMonitoredItemsRequest}
     * @param callback {Function}
     * @param callback.err {Error|null}   - the Error if the async method has failed
     */
    public deleteMonitoredItems(
        options: DeleteMonitoredItemsRequestLike,
        callback: (err: Error | null, response?: DeleteMonitoredItemsResponse) => void) {
        this._defaultRequest(
            DeleteMonitoredItemsRequest,
            DeleteMonitoredItemsResponse,
            options, callback);
    }

    /**
     *
     * @method setPublishingMode
     * @async
     */
    public setPublishingMode(
        publishingEnabled: boolean,
        subscriptionId: SubscriptionId
    ): Promise<StatusCode> ;
    public setPublishingMode(
        publishingEnabled: boolean,
        subscriptionIds: SubscriptionId[]
    ): Promise<StatusCode[]> ;
    public setPublishingMode(
        publishingEnabled: boolean,
        subscriptionId: SubscriptionId,
        callback: (err: Error | null, statusCode?: StatusCode) => void
    ): void ;
    public setPublishingMode(
        publishingEnabled: boolean,
        subscriptionIds: SubscriptionId[],
        callback: (err: Error | null, statusCodes?: StatusCode[]) => void
    ): void;
    /**
     * @internal
     */
    public setPublishingMode(...args: any[]): any {
        const publishingEnabled = args[0];
        const isArray = _.isArray(args[1]);
        const subscriptionIds = isArray ? args[1] : [args[1]];
        const callback = args[2];

        assert(_.isFunction(callback));
        assert(publishingEnabled === true || publishingEnabled === false);

        const options = new SetPublishingModeRequest({
            publishingEnabled,
            subscriptionIds
        });

        this._defaultRequest(
            SetPublishingModeRequest,
            SetPublishingModeResponse,
            options, (err: Error | null, response?: SetPublishingModeResponse) => {

                /* istanbul ignore next */
                if (err) {
                    return callback(err);
                }
                if (!response) {
                    return callback(new Error("Internal Error"));
                }
                response.results = response.results || [];
                callback(err, isArray ? response.results : response.results[0]);
            });
    }

    /**
     *
     * @method translateBrowsePath
     * @async
     * @param browsePath {BrowsePath|Array<BrowsePath>}
     * @param callback {Function}
     * @param callback.err {Error|null}
     * @param callback.response {BrowsePathResult|Array<BrowsePathResult>}
     *
     *
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
    public translateBrowsePath(...args: any[]): any {

        const isArray = _.isArray(args[0]);
        const browsePaths = isArray ? args[0] : [args[0]];

        const callback = args[1];
        assert(_.isFunction(callback));

        const request = new TranslateBrowsePathsToNodeIdsRequest({browsePaths});

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            /* istanbul ignore next */
            if (err) {
                return callback(err, response);
            }
            if (!response || !(response instanceof TranslateBrowsePathsToNodeIdsResponse)) {
                return callback(new Error("Internal Error"));
            }
            response.results = response.results || [];

            callback(null, isArray ? response.results : response.results[0]);

        });

    }

    public isChannelValid(): boolean {
        if (!this._client) {
            debugLog(chalk.red("Warning SessionClient is null ?"));
        }
        return (this._client !== null
            && this._client._secureChannel !== null
            && this._client._secureChannel.isOpened());
    }

    public performMessageTransaction(request: Request, callback: (err: Error | null, response?: Response) => void) {

        assert(_.isFunction(callback));
        assert(this._client);

        if (!this.isChannelValid()) {
            // the secure channel is broken, may be the server has crashed or the network cable has been disconnected
            // for a long time
            // we may need to queue this transaction, as a secure token may be being reprocessed
            debugLog(chalk.bgWhite.red("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! "));
            return callback(new Error("Invalid Channel "));
        }

        // is this stuff useful?
        if (request.requestHeader) {
            (request.requestHeader as any).authenticationToken = this.authenticationToken;
        }

        this.lastRequestSentTime = new Date();

        this._client.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            this.lastResponseReceivedTime = new Date();

            /* istanbul ignore next */
            if (err) {
                if (response && response.responseHeader.serviceDiagnostics) {
                    (err as any).serviceDiagnostics = response.responseHeader.serviceDiagnostics;
                }
                if (response && (response as any).diagnosticInfos) {
                    (err as any).diagnosticsInfo = (response as any).diagnosticInfos;
                }
                return callback(err);
            }
            if (!response) {
                return callback(new Error("internal Error"));
            }

            if (response.responseHeader.serviceResult.isNot(StatusCodes.Good)) {

                err = new Error(" ServiceResult is "
                    + response.responseHeader.serviceResult.toString()
                    + " request was " + request.constructor.name);

                if (response && response.responseHeader.serviceDiagnostics) {
                    (err as any).serviceDiagnostics = response.responseHeader.serviceDiagnostics;
                }
                if (response && (response as any).diagnosticInfos) {
                    (err as any).diagnosticsInfo = (response as any).diagnosticInfos;
                }
                return callback(err, response);
            }
            return callback(null, response);
        });
    }

    /**
     * evaluate the time in milliseconds that the session will live
     * on the server end from now. The remaining live time is
     * calculated based on when the last message was sent to the server
     * and the session timeout.
     * * In normal operation , when server and client communicates on a regular
     *   basis, evaluateRemainingLifetime will return a number slightly below
     *   session.timeout
     * * when the client and server cannot communicate due to a network issue
     *   (or a server crash), evaluateRemainingLifetime returns the estimated number
     *   of milliseconds before the server (if not crash) will keep  the session alive
     *   on its end to allow a automatic reconnection with session.
     * * When evaluateRemainingLifetime returns zero , this mean that
     *   the session has probably ended on the server side and will have to be recreated
     *   from scratch in case of a reconnection.
     * @return {number}
     */
    public evaluateRemainingLifetime(): number {
        const now = Date.now();
        const expiryTime = this.lastRequestSentTime.getTime() + this.timeout;
        return Math.max(0, (expiryTime - now));
    }

    public _terminatePublishEngine() {
        if (this._publishEngine) {
            this._publishEngine.terminate();
            this._publishEngine = null;
        }
    }

    /**
     *
     * @method close
     * @async
     * @param [deleteSubscription=true] {Boolean}
     * @param callback {Function}
     */
    public close(callback: ErrorCallback): void;

    public close(deleteSubscription: boolean, callback: ErrorCallback): void ;

    public async close(deleteSubscription?: boolean): Promise<void>;

    /**
     * @internal
     * @param args
     */
    public close(...args: any[]): any {
        if (arguments.length === 1) {
            return this.close(true, args[0]);
        }

        const deleteSubscription = args[0];
        const callback = args[1];

        assert(_.isFunction(callback));
        assert(_.isBoolean(deleteSubscription));

        if (!this._client) {
            debugLog("ClientSession#close : warning, client is already closed");
            return callback(); // already close ?
        }
        assert(this._client);

        this._terminatePublishEngine();
        this._client.closeSession(this, deleteSubscription, callback);

    }

    /**
     * @method hasBeenClosed
     * @return {Boolean}
     */
    public hasBeenClosed(): boolean {
        return isNullOrUndefined(this._client) || this._closed || this._closeEventHasBeenEmitted;
    }

    /**
     *
     * @method call
     *
     * @param methodToCall {CallMethodRequest} the call method request
     * @param callback {Function}
     * @param callback.err {Error|null}
     * @param callback.response {CallMethodResult}
     *
     * @example :
     *
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
     *
     * @method call
     *
     * @param methodsToCall {CallMethodRequest[]} the call method request array
     * @param callback {Function}
     * @param callback.err {Error|null}
     * @param callback.response {CallMethodResult[]}
     *
     *
     * @example :
     *
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
     */
    public async call(
        methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;
    public async call(
        methodToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;
    public call(
        methodToCall: CallMethodRequestLike,
        callback: (err: Error | null, result?: CallMethodResult) => void): void;
    public call(
        methodsToCall: CallMethodRequestLike[],
        callback: (err: Error | null, results?: CallMethodResult[]) => void): void;

    /**
     * @internal
     * @param args
     */
    public call(...args: any[]): any {

        const isArray = _.isArray(args[0]);
        const methodsToCall = isArray ? args[0] : [args[0]];
        assert(_.isArray(methodsToCall));

        const callback = args[1];

        // Note : The client has no explicit address space and therefore will struggle to
        //        access the method arguments signature.
        //        There are two methods that can be considered:
        //           - get the object definition by querying the server
        //           - load a fake address space to have some thing to query on our end
        // const request = this._client.factory.constructObjectId("CallRequest",{ methodsToCall: methodsToCall});
        const request = new CallRequest({methodsToCall});

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            if (!response || !(response instanceof CallResponse)) {
                return callback(new Error("internal error"));
            }
            response.results = response.results || [];
            callback(null, isArray ? response.results : response.results[0]);

        });
    }

    /**
     * @method getMonitoredItems
     * @param subscriptionId {UInt32} the subscription Id to return
     * @param callback {Function}
     * @param callback.err {Error}
     * @param callback.monitoredItems the monitored Items
     * @param callback.monitoredItems the monitored Items
     */

    public async getMonitoredItems(
        subscriptionId: SubscriptionId): Promise<MonitoredItemData>;
    public getMonitoredItems(
        subscriptionId: SubscriptionId,
        callback: (err: Error | null, result?: MonitoredItemData) => void): void;
    public getMonitoredItems(...args: any[]): any {
        const subscriptionId = args[0] as SubscriptionId;
        const callback = args[1];
        // <UAObject NodeId="i=2253"  BrowseName="Server">
        // <UAMethod NodeId="i=11492" BrowseName="GetMonitoredItems"
        //                                         ParentNodeId="i=2253" MethodDeclarationId="i=11489">
        // <UAMethod NodeId="i=11489" BrowseName="GetMonitoredItems" ParentNodeId="i=2004">
        const methodsToCall =
            new CallMethodRequest({
                inputArguments: [
                    // BaseDataType
                    {dataType: DataType.UInt32, value: subscriptionId}
                ],
                methodId: coerceNodeId("ns=0;i=11492"), // MethodIds.Server_GetMonitoredItems;
                objectId: coerceNodeId("ns=0;i=2253"),  // ObjectId.Server
            });

        this.call(methodsToCall, (err?: Error | null, result?: CallMethodResult) => {

                /* istanbul ignore next */
                if (err) {
                    return callback(err);
                }
                if (!result) {
                    return callback(new Error("internal error"));
                }

                if (result.statusCode.isNot(StatusCodes.Good)) {

                    callback(new Error(result.statusCode.toString()));

                } else {

                    result.outputArguments = result.outputArguments || [];

                    assert(result.outputArguments.length === 2);
                    const data = {
                        clientHandles: result.outputArguments[1].value,
                        serverHandles: result.outputArguments[0].value, //
                    };

                    // Note some server might return null array
                    // let make sure we have Uint32Array and not a null pointer
                    data.serverHandles = data.serverHandles || emptyUint32Array;
                    data.clientHandles = data.clientHandles || emptyUint32Array;

                    assert(data.serverHandles instanceof Uint32Array);
                    assert(data.clientHandles instanceof Uint32Array);
                    callback(null, data);
                }
            }
        );
    }

    /**
     * @method getArgumentDefinition
     *    extract the argument definition of a method
     * @param methodId the method nodeId to get argument definition from
     * @async
     *
     */
    public async getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;
    public getArgumentDefinition(methodId: MethodId,
                                 callback: (err: Error | null, args?: ArgumentDefinition) => void): void;
    /**
     * @internal
     */
    public getArgumentDefinition(...args: any[]): any {
        const methodId = args[0] as MethodId;
        const callback = args[1];
        assert(_.isFunction(callback));

        const browseDescription = new BrowseDescription({
            browseDirection: BrowseDirection.Forward,
            includeSubtypes: true,
            nodeClassMask: 0, // makeNodeClassMask("Variable"),
            nodeId: methodId,
            referenceTypeId: resolveNodeId("HasProperty"),
            resultMask: makeResultMask("BrowseName")
        });

        this.browse(browseDescription, (err: Error | null, browseResult?: BrowseResult) => {

            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            if (!browseResult) {
                return callback(new Error("Invalid"));
            }

            browseResult.references = browseResult.references || [];

            // xx console.log("xxxx results", util.inspect(results, {colors: true, depth: 10}));
            const inputArgumentRefArray = browseResult.references.filter(
                (r) => r.browseName.name === "InputArguments");

            // note : InputArguments property is optional thus may be missing
            const inputArgumentRef = (inputArgumentRefArray.length === 1) ? inputArgumentRefArray[0] : null;

            const outputArgumentRefArray = browseResult.references.filter(
                (r) => r.browseName.name === "OutputArguments");

            // note : OutputArguments property is optional thus may be missing
            const outputArgumentRef = (outputArgumentRefArray.length === 1) ? outputArgumentRefArray[0] : null;

            let inputArguments: Variant[] = [];
            let outputArguments: Variant[] = [];

            const nodesToRead = [];
            const actions: any[] = [];

            if (inputArgumentRef) {
                nodesToRead.push({
                    attributeId: AttributeIds.Value,
                    nodeId: inputArgumentRef.nodeId,
                });
                actions.push((result: DataValue) => {
                    inputArguments = result.value.value;
                });
            }
            if (outputArgumentRef) {
                nodesToRead.push({
                    attributeId: AttributeIds.Value,
                    nodeId: outputArgumentRef.nodeId,
                });
                actions.push((result: DataValue) => {
                    outputArguments = result.value.value;
                });
            }

            if (nodesToRead.length === 0) {
                return callback(null, {inputArguments, outputArguments});
            }
            // now read the variable
            this.read(nodesToRead, (err1: Error | null, dataValues?: DataValue[]) => {

                /* istanbul ignore next */
                if (err1) {
                    return callback(err1);
                }
                if (!dataValues) {
                    return callback(new Error("Internal Errror"));
                }

                dataValues.forEach((dataValue, index) => {
                    actions[index].call(null, dataValue);
                });

                callback(null, {inputArguments, outputArguments});
            });
        });
    }

    public async registerNodes(nodesToRegister: NodeIdLike[]): Promise<NodeId[]>;
    public registerNodes(
        nodesToRegister: NodeIdLike[],
        callback: (err: Error | null, registeredNodeIds?: NodeId[]) => void
    ): void;
    public registerNodes(...args: any[]): any {

        const nodesToRegister = args[0] as NodeIdLike[];
        const callback = args[1] as (err: Error | null, registeredNodeIds?: NodeId[]) => void;

        assert(_.isFunction(callback));
        assert(_.isArray(nodesToRegister));

        const request = new RegisterNodesRequest({
            nodesToRegister: nodesToRegister.map(resolveNodeId)
        });

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            if (!response || !(response instanceof RegisterNodesResponse)) {
                return callback(new Error("Internal Error"));
            }

            response.registeredNodeIds = response.registeredNodeIds || [];

            callback(null, response.registeredNodeIds);
        });

    }

    public async unregisterNodes(nodesToUnregister: NodeIdLike[]): Promise<void>;
    public unregisterNodes(nodesToUnregister: NodeIdLike[], callback: (err?: Error) => void): void;
    public unregisterNodes(...args: any[]): any {

        const nodesToUnregister = args[0] as NodeIdLike[];
        const callback = args[1] as (err?: Error) => void;

        assert(_.isFunction(callback));
        assert(_.isArray(nodesToUnregister));

        const request = new UnregisterNodesRequest({
            nodesToUnregister: nodesToUnregister.map(resolveNodeId)
        });

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            if (!response || !(response instanceof UnregisterNodesResponse)) {
                return callback(new Error("Internal Error"));
            }
            callback();
        });
    }

    /**
     * @method queryFirst
     * @param queryFirstRequest {queryFirstRequest}
     * @param callback {Function}
     * @param callback.err {Error|null}
     * @param callback.response {queryFirstResponse}
     *
     */

    public async queryFirst(
        queryFirstRequest: QueryFirstRequestLike
    ): Promise<QueryFirstResponse>;

    public queryFirst(
        queryFirstRequest: QueryFirstRequestLike,
        callback: ResponseCallback<QueryFirstResponse>
    ): void;
    public queryFirst(...args: any[]): any {

        const queryFirstRequest = args[0] as QueryFirstRequestLike;
        const callback = args[1] as ResponseCallback<QueryFirstResponse>;

        assert(_.isFunction(callback));
        const request = new QueryFirstRequest(queryFirstRequest);

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }
            if (!response || !(response instanceof QueryFirstResponse)) {
                return callback(new Error("internal error"));
            }
            callback(null, response);
        });
    }

    public startKeepAliveManager() {
        assert(!this._keepAliveManager, "keepAliveManger already started");
        this._keepAliveManager = new ClientSessionKeepAliveManager(this);

        this._keepAliveManager.on("failure", () => {
            this.stopKeepAliveManager();
            /**
             * raised when a keep-alive request has failed on the session, may be the session has timeout
             * unexpectidaly on the server side, may be the connection is broken.
             * @event keepalive_failure
             */
            this.emit("keepalive_failure");
        });
        this._keepAliveManager.on("keepalive", (state) => {
            /**
             * @event keepalive
             */
            this.emit("keepalive", state);
        });
        this._keepAliveManager.start();
    }

    public stopKeepAliveManager() {
        if (this._keepAliveManager) {
            this._keepAliveManager.stop();
            this._keepAliveManager = undefined;
        }
    }

    public dispose() {
        assert(this._closeEventHasBeenEmitted);
        this._terminatePublishEngine();
        this.stopKeepAliveManager();
        this.removeAllListeners();
    }

    public toString(): string {
        const now = Date.now();
        const lap1 = (now - this.lastRequestSentTime.getTime());
        const lap2 = now - this.lastResponseReceivedTime.getTime();

        let str = "";
        str += " name..................... " + this.name;
        str += " sessionId................ " + this.sessionId.toString();
        str += " authenticationToken...... " + this.authenticationToken ? this.authenticationToken!.toString() : "";
        str += " timeout.................. " + this.timeout + "ms";
        str += " serverNonce.............. " + this.serverNonce ? this.serverNonce!.toString("hex") : "";
        str += " serverCertificate........ " + this.serverCertificate.toString("base64");
        // xx console.log(" serverSignature.......... ", this.serverSignature);
        str += " lastRequestSentTime...... " + new Date(this.lastRequestSentTime).toISOString() + lap1;
        str += " lastResponseReceivedTime. " + new Date(this.lastResponseReceivedTime).toISOString() + lap2;

        return str;
    }

    /**
     * @method getBuiltInDataType
     * retrieve the built-in DataType of a Variable, from its DataType attribute
     * useful to determine which DataType to use when constructing a Variant
     * @param nodeId {NodeId} the node id of the variable to query
     * @param callback {Function} the callback function
     * @param callback.err
     * @param callback.result {DataType}
     * @async
     *
     *
     * @example
     *     const session = ...; // ClientSession
     *     const nodeId = opcua.VariableIds.Server_ServerStatus_CurrentTime;
     *     session.getBuildInDataType(nodeId,function(err,dataType) {
     *        assert(dataType === opcua.DataType.DateTime);
     *     });
     *     // or
     *     nodeId = opcua.coerceNodeId("ns=2;s=Scalar_Static_ImagePNG");
     *     session.getBuildInDataType(nodeId,function(err,dataType) {
     *        assert(dataType === opcua.DataType.ByteString);
     *     });
     *
     */
    public async getBuiltInDataType(nodeId: NodeId): Promise<DataType>;
    public getBuiltInDataType(nodeId: NodeId, callback: (err: Error | null, dataType?: DataType) => void): void;
    public getBuiltInDataType(...args: any[]): any {

        const nodeId = args[0];
        const callback = args[1];

        let dataTypeId = null;
        const nodeToRead = {
            attributeId: AttributeIds.DataType,
            nodeId,
        };
        this.read(nodeToRead, 0, (err: Error | null, dataValue?: DataValue) => {
            if (err) {
                return callback(err);
            }
            if (!dataValue) {
                return callback(new Error("Internal Error"));
            }
            if (dataValue.statusCode.isNot(StatusCodes.Good)) {
                return callback(new Error("cannot read DataType Attribute " + dataValue.statusCode.toString()));
            }
            dataTypeId = dataValue.value.value;
            assert(dataTypeId instanceof NodeId);
            __findBasicDataType(this, dataTypeId, callback);
        });

    }

    public resumePublishEngine() {
        assert(this._publishEngine);
        if (this._publishEngine && this._publishEngine.subscriptionCount > 0) {
            this._publishEngine.replenish_publish_request_queue();
        }
    }

    /**
     *
     * @param callback                [Function}
     * @param callback.err            {null|Error}
     * @param callback.namespaceArray {Array<String>}
     */
    public async readNamespaceArray(): Promise<string[]>;
    public readNamespaceArray(callback: (err: Error | null, namespaceArray?: string[]) => void): void;
    public readNamespaceArray(...args: any[]): any {

        const callback = args[0];

        this.read({
            attributeId: AttributeIds.Value,
            nodeId: resolveNodeId("Server_NamespaceArray"),
        }, (err: Error | null, dataValue?: DataValue) => {
            if (err) {
                return callback(err);
            }
            if (!dataValue) {
                return callback(new Error("Internal Error"));
            }
            if (dataValue.statusCode !== StatusCodes.Good) {
                return callback(new Error("readNamespaceArray : " + dataValue.statusCode.toString()));
            }
            assert(dataValue.value.value instanceof Array);
            this._namespaceArray = dataValue.value.value; // keep a cache
            callback(null, this._namespaceArray);
        });
    }

    public getNamespaceIndex(namespaceUri: string): number {
        assert(this._namespaceArray, "please make sure that readNamespaceArray has been called");
        return this._namespaceArray.findIndex(namespaceUri);
    }

    // tslint:disable:no-empty
    public disableCondition(): void {
    }

    // ---------------------------------------- Alarm & condition stub
    public enableCondition(): void {
    }

    public addCommentCondition(
        conditionId: NodeId,
        eventId: Buffer,
        comment: string, callback: ErrorCallback
    ): void {
    }

    public confirmCondition(
        conditionId: NodeId,
        eventId: Buffer,
        comment: LocalizedTextLike,
        callback: ErrorCallback
    ): void {

    }

    public acknowledgeCondition(
        conditionId: NodeId,
        eventId: Buffer,
        comment: LocalizedTextLike,
        callback: ErrorCallback
    ): void {

    }

    public findMethodId(
        nodeId: NodeIdLike,
        methodName: string,
        callback: ResponseCallback<NodeId>
    ): void {
    }

    public _callMethodCondition(
        methodName: string,
        conditionId: NodeIdLike,
        eventId: Buffer,
        comment: LocalizedTextLike,
        callback: (err?: Error) => void
    ): void {
    }

    private _defaultRequest(requestClass: any, responseClass: any, options: any, callback: any) {

        assert(_.isFunction(callback));

        const request = options instanceof requestClass ? options : new requestClass(options);

        /* istanbul ignore next */
        if (doDebug) {
            request.trace = new Error("").stack;
        }

        if (this._closeEventHasBeenEmitted) {
            debugLog("ClientSession#_defaultRequest => session has been closed !!", request.toString());
            setImmediate(() => {
                callback(new Error("ClientSession is closed !"));
            });
            return;
        }

        this.performMessageTransaction(request, (err: Error | null, response?: Response) => {

            if (this._closeEventHasBeenEmitted) {
                debugLog("ClientSession#_defaultRequest ... err =", err, response ? response.toString() : " null");
            }
            /* istanbul ignore next */
            if (err) {
                // let intercept interesting error message
                if (err.message.match(/BadSessionClosed/)) {
                    // the session has been closed by Server
                    // probably due to timeout issue
                    // let's print some statistics
                    const now = Date.now();
                    if (doDebug) {
                        debugLog(chalk.bgWhite.red(" server send BadSessionClosed !"));
                        debugLog(chalk.bgWhite.red(" request was               "), request.toString());
                        debugLog(" timeout.................. ", this.timeout);
                        debugLog(" lastRequestSentTime...... ",
                            new Date(this.lastRequestSentTime).toISOString(),
                            now - this.lastRequestSentTime.getTime());
                        debugLog(" lastResponseReceivedTime. ",
                            new Date(this.lastResponseReceivedTime).toISOString(),
                            now - this.lastResponseReceivedTime.getTime());
                    }

                    //  DO NOT TERMINATE SESSION, as we will need a publishEngine when we
                    //  reconnect this._terminatePublishEngine();

                    /**
                     * send when the session has been closed by the server ( probably due to inactivity and timeout)
                     * @event session_closed
                     */
                    this.emitCloseEvent(StatusCodes.BadSessionClosed);

                }
                return callback(err, response);
            }
            assert(response instanceof responseClass);
            callback(null, response);

        });
    }

}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = {multiArgs: false};

ClientSessionImpl.prototype.browse = thenify.withCallback(ClientSessionImpl.prototype.browse, opts);
ClientSessionImpl.prototype.readVariableValue = thenify.withCallback(ClientSessionImpl.prototype.readVariableValue, opts);
ClientSessionImpl.prototype.readHistoryValue = thenify.withCallback(ClientSessionImpl.prototype.readHistoryValue, opts);
ClientSessionImpl.prototype.write = thenify.withCallback(ClientSessionImpl.prototype.write, opts);
ClientSessionImpl.prototype.writeSingleNode = thenify.withCallback(ClientSessionImpl.prototype.writeSingleNode, opts);
ClientSessionImpl.prototype.readAllAttributes = thenify.withCallback(ClientSessionImpl.prototype.readAllAttributes, opts);
ClientSessionImpl.prototype.read = thenify.withCallback(ClientSessionImpl.prototype.read, opts);
ClientSessionImpl.prototype.createSubscription = thenify.withCallback(ClientSessionImpl.prototype.createSubscription, opts);
ClientSessionImpl.prototype.createSubscription2 = thenify.withCallback(ClientSessionImpl.prototype.createSubscription2, opts);
ClientSessionImpl.prototype.deleteSubscriptions = thenify.withCallback(ClientSessionImpl.prototype.deleteSubscriptions, opts);
ClientSessionImpl.prototype.transferSubscriptions = thenify.withCallback(ClientSessionImpl.prototype.transferSubscriptions, opts);
ClientSessionImpl.prototype.createMonitoredItems = thenify.withCallback(ClientSessionImpl.prototype.createMonitoredItems, opts);
ClientSessionImpl.prototype.modifyMonitoredItems = thenify.withCallback(ClientSessionImpl.prototype.modifyMonitoredItems, opts);
ClientSessionImpl.prototype.modifySubscription = thenify.withCallback(ClientSessionImpl.prototype.modifySubscription, opts);
ClientSessionImpl.prototype.setMonitoringMode = thenify.withCallback(ClientSessionImpl.prototype.setMonitoringMode, opts);
ClientSessionImpl.prototype.publish = thenify.withCallback(ClientSessionImpl.prototype.publish, opts);
ClientSessionImpl.prototype.republish = thenify.withCallback(ClientSessionImpl.prototype.republish, opts);
ClientSessionImpl.prototype.deleteMonitoredItems = thenify.withCallback(ClientSessionImpl.prototype.deleteMonitoredItems, opts);
ClientSessionImpl.prototype.setPublishingMode = thenify.withCallback(ClientSessionImpl.prototype.setPublishingMode, opts);
ClientSessionImpl.prototype.translateBrowsePath = thenify.withCallback(ClientSessionImpl.prototype.translateBrowsePath, opts);
ClientSessionImpl.prototype.performMessageTransaction = thenify.withCallback(ClientSessionImpl.prototype.performMessageTransaction, opts);
ClientSessionImpl.prototype.close = thenify.withCallback(ClientSessionImpl.prototype.close, opts);
ClientSessionImpl.prototype.call = thenify.withCallback(ClientSessionImpl.prototype.call, opts);
ClientSessionImpl.prototype.getMonitoredItems = thenify.withCallback(ClientSessionImpl.prototype.getMonitoredItems, opts);
ClientSessionImpl.prototype.getArgumentDefinition = thenify.withCallback(ClientSessionImpl.prototype.getArgumentDefinition, opts);
ClientSessionImpl.prototype.queryFirst = thenify.withCallback(ClientSessionImpl.prototype.queryFirst, opts);
ClientSessionImpl.prototype.registerNodes = thenify.withCallback(ClientSessionImpl.prototype.registerNodes, opts);
ClientSessionImpl.prototype.unregisterNodes = thenify.withCallback(ClientSessionImpl.prototype.unregisterNodes, opts);
ClientSessionImpl.prototype.readNamespaceArray = thenify.withCallback(ClientSessionImpl.prototype.readNamespaceArray, opts);
