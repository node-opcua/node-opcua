/**
 * @module node-opcua-address-space
 */
import * as async from "async";
import { promisify } from "util";

import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { NodeId, resolveNodeId, NodeIdType } from "node-opcua-nodeid";
import {
    ArgumentDefinition,
    BrowseDescriptionLike,
    CallMethodRequestLike,
    getArgumentDefinitionHelper,
    IBasicSession,
    MethodId,
    ResponseCallback
} from "node-opcua-pseudo-session";
import {
    BrowseDescription,
    BrowseDescriptionOptions,
    BrowseNextResponse,
    BrowseRequest,
    BrowseResponse,
    BrowseResult
} from "node-opcua-service-browse";
import { CallMethodRequest, CallMethodResult, CallMethodResultOptions } from "node-opcua-service-call";
import { BrowsePath, BrowsePathResult } from "node-opcua-service-translate-browse-path";
import { StatusCodes, StatusCode } from "node-opcua-status-code";
import { NodeClass, AttributeIds } from "node-opcua-data-model";
import { MessageSecurityMode, ReadValueId, WriteValueOptions, WriteValue, ReadValueIdOptions } from "node-opcua-types";
import { randomGuid } from "node-opcua-basic-types";

import { AddressSpace } from "./address_space_ts";
import { ContinuationPointManager } from "./continuation_points/continuation_point_manager";
import { callMethodHelper } from "./helpers/call_helpers";
import { SessionContext } from "./session_context";
import { UAVariable } from "../src/ua_variable";
import { make_errorLog } from "node-opcua-debug";


const errorLog = make_errorLog("PseudoSession");
/**
 * Pseudo session is an helper object that exposes the same async methods
 * than the ClientSession. It can be used on a server address space.
 *
 * Code reused !
 * The primary benefit of this object  is that its makes advanced OPCUA
 * operations that uses browse, translate, read, write etc similar
 * whether we work inside a server or through a client session.
 *
 * @param addressSpace {AddressSpace}
 * @constructor
 */
export class PseudoSession implements IBasicSession {
    public requestedMaxReferencesPerNode: number = 0;
    private _sessionId: NodeId = new NodeId(NodeIdType.GUID, randomGuid());
    private readonly addressSpace: AddressSpace;
    private readonly continuationPointManager: ContinuationPointManager;
    private readonly context: SessionContext;

    constructor(addressSpace: AddressSpace, context?: SessionContext) {
        this.addressSpace = addressSpace;
        const self = this;
        this.context = context || SessionContext.defaultContext;
        this.continuationPointManager = new ContinuationPointManager();
    }

    public getSessionId(): NodeId {
        return this._sessionId;
    }
    public browse(nodeToBrowse: BrowseDescriptionLike, callback: ResponseCallback<BrowseResult>): void;
    public browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;
    public browse(nodeToBrowse: BrowseDescriptionLike): Promise<BrowseResult>;
    public browse(nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
    public browse(nodesToBrowse: BrowseDescriptionLike | BrowseDescriptionLike[], callback?: ResponseCallback<any>): any {
        setImmediate(() => {
            const isArray = Array.isArray(nodesToBrowse);
            if (!isArray) {
                nodesToBrowse = [nodesToBrowse as BrowseDescriptionLike];
            }
            let results: BrowseResult[] = [];
            for (let browseDescription of nodesToBrowse as any[]) {
                browseDescription.referenceTypeId = resolveNodeId(browseDescription.referenceTypeId);
                browseDescription = new BrowseDescription(browseDescription);
                const nodeId = resolveNodeId(browseDescription.nodeId);
                const r = this.addressSpace.browseSingleNode(nodeId, browseDescription, this.context);
                results.push(r);
            }

            // handle continuation points
            results = results.map((result: BrowseResult) => {
                assert(!result.continuationPoint);
                const truncatedResult = this.continuationPointManager.register(
                    this.requestedMaxReferencesPerNode,
                    result.references || []
                );
                assert(truncatedResult.statusCode === StatusCodes.Good);
                truncatedResult.statusCode = result.statusCode;
                return new BrowseResult(truncatedResult);
            });
            callback!(null, isArray ? results : results[0]);
        });
    }

    public read(nodeToRead: ReadValueIdOptions, callback: ResponseCallback<DataValue>): void;
    public read(nodesToRead: ReadValueIdOptions[], callback: ResponseCallback<DataValue[]>): void;
    public read(nodeToRead: ReadValueIdOptions): Promise<DataValue>;
    public read(nodesToRead: ReadValueIdOptions[]): Promise<DataValue[]>;
    public read(nodesToRead: any, callback?: ResponseCallback<any>): any {
        const isArray = Array.isArray(nodesToRead);
        if (!isArray) {
            nodesToRead = [nodesToRead];
        }

        const context =  this.context;
        
        setImmediate(() => {
            async.map(
                nodesToRead,
                (nodeToRead: ReadValueId, innerCallback: any) => {
                    const obj = this.addressSpace.findNode(nodeToRead.nodeId);
                    if (!obj || obj.nodeClass !== NodeClass.Variable || nodeToRead.attributeId !== AttributeIds.Value) {
                        return innerCallback();
                    }
                    (obj as UAVariable).readValueAsync(context, innerCallback);
                },
                (err) => {
                    const dataValues = nodesToRead.map((nodeToRead: ReadValueIdOptions) => {
                        assert(!!nodeToRead.nodeId, "expecting a nodeId");
                        assert(!!nodeToRead.attributeId, "expecting a attributeId");

                        const nodeId = nodeToRead.nodeId!;
                        const attributeId = nodeToRead.attributeId!;
                        const indexRange = nodeToRead.indexRange;
                        const dataEncoding = nodeToRead.dataEncoding;
                        const obj = this.addressSpace.findNode(nodeId);
                        if (!obj) {
                            return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
                        }
                        const context = this.context;
                        const dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
                        return dataValue;
                    });

                    callback!(null, isArray ? dataValues : dataValues[0]);
                }
            );
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

    public browseNext(continuationPoint: Buffer, releaseContinuationPoints: boolean): Promise<BrowseResult>;

    public browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean): Promise<BrowseResult[]>;
    public browseNext(continuationPoints: Buffer | Buffer[], releaseContinuationPoints: boolean, callback?: any): any {
        setImmediate(() => {
            if (continuationPoints instanceof Buffer) {
                return this.browseNext([continuationPoints], releaseContinuationPoints, (err, _results) => {
                    if (err) {
                        return callback!(err);
                    }
                    callback!(null, _results![0]);
                });
                return;
            }
            let results: any;
            if (releaseContinuationPoints) {
                // releaseContinuationPoints = TRUE
                //   passed continuationPoints shall be reset to free resources in
                //   the Server. The continuation points are released and the results
                //   and diagnosticInfos arrays are empty.
                results = continuationPoints.map((continuationPoint: any) => {
                    return this.continuationPointManager.cancel(continuationPoint);
                });
            } else {
                // let extract data from continuation points

                // releaseContinuationPoints = FALSE
                //   passed continuationPoints shall be used to get the next set of
                //   browse information.
                results = continuationPoints.map((continuationPoint: any) => {
                    return this.continuationPointManager.getNext(continuationPoint);
                });
            }
            results = results.map((r: any) => new BrowseResult(r));

            callback!(null, results);
        });
    }

    // call service ----------------------------------------------------------------------------------------------------
    public call(methodToCall: CallMethodRequestLike, callback: ResponseCallback<CallMethodResult>): void;
    public call(methodsToCall: CallMethodRequestLike[], callback: ResponseCallback<CallMethodResult[]>): void;
    public call(methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;
    public call(methodsToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;
    public call(methodsToCall: CallMethodRequestLike | CallMethodRequestLike[], callback?: ResponseCallback<any>): any {
        const isArray = Array.isArray(methodsToCall);
        if (!isArray) {
            methodsToCall = [methodsToCall as CallMethodRequestLike];
        }

        async.map(
            methodsToCall as CallMethodRequestLike[],
            (methodToCall, innerCallback: (err: Error | null, result?: CallMethodResult) => void) => {
                const callMethodRequest = new CallMethodRequest(methodToCall);

                callMethodHelper(
                    this.context,
                    this.addressSpace,
                    callMethodRequest,
                    (err: Error | null, result?: CallMethodResultOptions) => {
                        let callMethodResult: CallMethodResult;
                        if (err) {
                            errorLog("Internal Error = ", err);
                            callMethodResult = new CallMethodResult({
                                statusCode: StatusCodes.BadInternalError
                            });
                        } else {
                            callMethodResult = new CallMethodResult(result);
                        }
                        innerCallback(null, callMethodResult);
                    }
                );
            },
            (err?: Error | null, callMethodResults?: any) => {
                callback!(null, isArray ? callMethodResults! : callMethodResults![0]);
            }
        );
    }

    public getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;
    public getArgumentDefinition(methodId: MethodId, callback: ResponseCallback<ArgumentDefinition>): void;
    public getArgumentDefinition(methodId: MethodId, callback?: ResponseCallback<ArgumentDefinition>): any {
        return getArgumentDefinitionHelper(this, methodId, callback!);
    }

    public translateBrowsePath(browsePaths: BrowsePath[], callback: ResponseCallback<BrowsePathResult[]>): void;
    public translateBrowsePath(browsePath: BrowsePath, callback: ResponseCallback<BrowsePathResult>): void;
    public translateBrowsePath(browsePath: BrowsePath): Promise<BrowsePathResult>;
    public translateBrowsePath(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]>;
    public translateBrowsePath(browsePaths: BrowsePath[] | BrowsePath, callback?: any): any {
        const isArray = Array.isArray(browsePaths);
        if (!isArray) {
            browsePaths = [browsePaths as BrowsePath];
        }
        const browsePathResults = (browsePaths as BrowsePath[]).map((browsePath: BrowsePath) => {
            return this.addressSpace.browsePath(browsePath);
        });
        callback!(null, isArray ? browsePathResults : browsePathResults[0]);
    }
    public write(nodeToWrite: WriteValueOptions, callback: ResponseCallback<StatusCode>): void;
    public write(nodesToWrite: WriteValueOptions[], callback: ResponseCallback<StatusCode[]>): void;
    public write(nodeToWrite: WriteValueOptions): Promise<StatusCode>;
    public write(nodesToWrite: WriteValueOptions[]): Promise<StatusCode[]>;
    public write(nodesToWrite: any, callback?: ResponseCallback<any>): any {
        const isArray = Array.isArray(nodesToWrite);
        if (!isArray) {
            nodesToWrite = [nodesToWrite];
        }
        const context = this.context;
        setImmediate(() => {
            const statusCodesPromises: Promise<StatusCode>[] = nodesToWrite.map((nodeToWrite: WriteValue) => {
                assert(!!nodeToWrite.nodeId, "expecting a nodeId");
                assert(!!nodeToWrite.attributeId, "expecting a attributeId");

                const nodeId = nodeToWrite.nodeId!;
                const obj = this.addressSpace.findNode(nodeId);
                if (!obj) {
                    return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
                }
                return promisify(obj.writeAttribute).call(obj, context, nodeToWrite);
            });
            Promise.all(statusCodesPromises).then((statusCodes: StatusCodes[]) => {
                callback!(null, isArray ? statusCodes : statusCodes[0]);
            });
        });
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
PseudoSession.prototype.read = thenify.withCallback(PseudoSession.prototype.read);
PseudoSession.prototype.write = thenify.withCallback(PseudoSession.prototype.write);
PseudoSession.prototype.browse = thenify.withCallback(PseudoSession.prototype.browse);
PseudoSession.prototype.browseNext = thenify.withCallback(PseudoSession.prototype.browseNext);
PseudoSession.prototype.getArgumentDefinition = thenify.withCallback(PseudoSession.prototype.getArgumentDefinition);
PseudoSession.prototype.call = thenify.withCallback(PseudoSession.prototype.call);
PseudoSession.prototype.translateBrowsePath = thenify.withCallback(PseudoSession.prototype.translateBrowsePath);
