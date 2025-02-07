/**
 * @module node-opcua-address-space
 */
import { promisify } from "util";
import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { make_errorLog } from "node-opcua-debug";
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
import { BrowseDescription, BrowseResult } from "node-opcua-service-browse";
import { CallMethodRequest, CallMethodResult, CallMethodResultOptions } from "node-opcua-service-call";
import { BrowsePath, BrowsePathResult } from "node-opcua-service-translate-browse-path";
import { StatusCodes, StatusCode } from "node-opcua-status-code";
import { NodeClass, AttributeIds } from "node-opcua-data-model";
import { WriteValueOptions, ReadValueIdOptions, BrowseDescriptionOptions } from "node-opcua-types";
import { randomGuid } from "node-opcua-basic-types";

import { IAddressSpace, UAVariable, ISessionContext, ContinuationPoint } from "node-opcua-address-space-base";

import { ContinuationPointManager } from "./continuation_points/continuation_point_manager";
import { callMethodHelper } from "./helpers/call_helpers";
import { SessionContext } from "./session_context";

const errorLog = make_errorLog("PseudoSession");

function coerceBrowseDescription(browseDescription: BrowseDescriptionLike): BrowseDescription {
    if (typeof browseDescription === "string") {
        return coerceBrowseDescription({
            nodeId: resolveNodeId(browseDescription)
        });
    } else if (browseDescription instanceof BrowseDescription) {
        return browseDescription;
    } else {
        return new BrowseDescription(browseDescription);
    }
}
export interface InnerBrowseEngine {
    requestedMaxReferencesPerNode: number;
    maxBrowseContinuationPoints: number;
    continuationPointManager: ContinuationPointManager;
    context: ISessionContext;
    browseAll: (nodesToBrowse: BrowseDescriptionOptions[], callback: ResponseCallback<BrowseResult[]>) => void;
}

export function innerBrowse(
    engine: InnerBrowseEngine,
    nodesToBrowse: BrowseDescriptionOptions[],
    callback?: ResponseCallback<BrowseResult[]>
): void {
    engine.browseAll(nodesToBrowse, (err, results) => {
        if (err || !results) {
            return callback!(err);
        }
        // handle continuation points
        results = results.map((result: BrowseResult, index) => {
            assert(!result.continuationPoint);
            // istanbul ignore next
            if (!engine.continuationPointManager) {
                return new BrowseResult({ statusCode: StatusCodes.BadNoContinuationPoints });
            }

            if (engine.continuationPointManager.hasReachedMaximum(engine.maxBrowseContinuationPoints)) {
                return new BrowseResult({ statusCode: StatusCodes.BadNoContinuationPoints });
            }

            const truncatedResult = engine.continuationPointManager.registerReferences(
                engine.requestedMaxReferencesPerNode,
                result.references || [],
                { continuationPoint: null }
            );
            let { statusCode } = truncatedResult;
            const { continuationPoint, values } = truncatedResult;
            assert(statusCode.isGood() || statusCode.equals(StatusCodes.GoodNoData));
            statusCode = result.statusCode;
            return new BrowseResult({
                statusCode,
                continuationPoint,
                references: values
            });
        });
        callback!(null, results);
    });
}

export interface InnerBrowseNextEngine {
    continuationPointManager: ContinuationPointManager;
}
export function innerBrowseNext(
    engine: InnerBrowseNextEngine,
    continuationPoints: Buffer[],
    releaseContinuationPoints: boolean,
    callback?: ResponseCallback<BrowseResult[]>
): void {
    const results = continuationPoints
        .map((continuationPoint: ContinuationPoint, index: number) => {
            return engine.continuationPointManager.getNextReferences(0, {
                continuationPoint,
                releaseContinuationPoints
            });
        })
        .map(
            (r) =>
                new BrowseResult({
                    statusCode: r.statusCode,
                    continuationPoint: r.continuationPoint,
                    references: r.values
                })
        );
    callback!(null, results);
}

const $addressSpace = Symbol("addressSpace");
const $context = Symbol("context");
/**
 * Pseudo session is an helper object that exposes the same async methods
 * than the ClientSession. It can be used on a server address space.
 *
 * Code reused !
 * The primary benefit of this object  is that its makes advanced OPCUA
 * operations that uses browse, translate, read, write etc similar
 * whether we work inside a server or through a client session.
 *
 */
export class PseudoSession implements IBasicSession {
    public requestedMaxReferencesPerNode = 0;
    public maxBrowseContinuationPoints = 0; // 0=no limits
    private _sessionId: NodeId = new NodeId(NodeIdType.GUID, randomGuid());
    private readonly [$addressSpace]: IAddressSpace;
    private readonly continuationPointManager: ContinuationPointManager;
    private readonly [$context]: ISessionContext;

    constructor(addressSpace: IAddressSpace, context?: ISessionContext) {
        this[$addressSpace] = addressSpace;
        this[$context] = context || SessionContext.defaultContext;
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
        const isArray = Array.isArray(nodesToBrowse);
        if (!isArray) {
            return this.browse([nodesToBrowse as BrowseDescriptionLike], (err, results) => {
                return callback!(err, results ? results[0] : undefined);
            });
        }
        const browseAll = (nodesToBrowse: BrowseDescriptionOptions[], callack: ResponseCallback<BrowseResult[]>) => {
            const results: BrowseResult[] = [];
            for (const browseDescription of nodesToBrowse as BrowseDescriptionOptions[]) {
                browseDescription.referenceTypeId = resolveNodeId(browseDescription.referenceTypeId!);
                const _browseDescription = coerceBrowseDescription(browseDescription);
                const nodeId = resolveNodeId(_browseDescription.nodeId);
                const r = this[$addressSpace].browseSingleNode(nodeId, _browseDescription, this[$context]);
                results.push(r);
            }
            callack!(null, results);
        };

        setImmediate(() => {
            innerBrowse(
                {
                    browseAll,
                    context: this[$context],
                    continuationPointManager: this.continuationPointManager,
                    requestedMaxReferencesPerNode: this.requestedMaxReferencesPerNode,
                    maxBrowseContinuationPoints: this.maxBrowseContinuationPoints
                },
                nodesToBrowse as BrowseDescriptionOptions[],
                callback
            );
        });
    }

    public read(nodeToRead: ReadValueIdOptions, callback: ResponseCallback<DataValue>): void;
    public read(nodesToRead: ReadValueIdOptions[], callback: ResponseCallback<DataValue[]>): void;
    public read(nodeToRead: ReadValueIdOptions): Promise<DataValue>;
    public read(nodesToRead: ReadValueIdOptions[]): Promise<DataValue[]>;
    public read(nodesToRead: ReadValueIdOptions[] | ReadValueIdOptions, callback?: ResponseCallback<any>): any {
        const isArray = Array.isArray(nodesToRead);
        if (!isArray) {
            nodesToRead = [nodesToRead as ReadValueIdOptions];
        }
        const _nodesToRead = nodesToRead as ReadValueIdOptions[];
        const context = this[$context];

        const readV = async (nodeToRead: ReadValueIdOptions): Promise<DataValue> => {
            const obj = this[$addressSpace].findNode(nodeToRead.nodeId!);
            if (!obj) {
                return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
            }
            // refresh the variable value if the attribute to read is the Value attribute
            if (obj.nodeClass === NodeClass.Variable && nodeToRead.attributeId == AttributeIds.Value) {
               return await (obj as UAVariable).readValueAsync(context);
            }
            assert(!!nodeToRead.nodeId, "expecting a nodeId");
            assert(!!nodeToRead.attributeId, "expecting a attributeId");
            const attributeId = nodeToRead.attributeId!;
            const indexRange = nodeToRead.indexRange;
            const dataEncoding = nodeToRead.dataEncoding;
            const dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
            return dataValue;
        };
        Promise.all(_nodesToRead.map(async (nodeToRead: ReadValueIdOptions) => await readV(nodeToRead)))
            .then((dataValues) => callback!(null, isArray ? dataValues : dataValues[0]))
            .catch((err) => callback!(err));
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
    public browseNext(
        continuationPoints: Buffer | Buffer[],
        releaseContinuationPoints: boolean,
        callback?: ResponseCallback<any>
    ): any {
        setImmediate(() => {
            if (continuationPoints instanceof Buffer) {
                return this.browseNext([continuationPoints], releaseContinuationPoints, (err, _results) => {
                    if (err) {
                        return callback!(err);
                    }
                    callback!(null, _results![0]);
                });
            }
            innerBrowseNext(
                { continuationPointManager: this.continuationPointManager },
                continuationPoints as Buffer[],
                releaseContinuationPoints,
                callback
            );
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
        Promise.all((methodsToCall as CallMethodRequestLike[]).map(async (methodToCall) => {
            const callMethodRequest = new CallMethodRequest(methodToCall);
            try {
                const result = await callMethodHelper(this[$context], this[$addressSpace], callMethodRequest);
                return new CallMethodResult(result);
            } catch (err) {
                errorLog("Internal Error = ", err);
                return new CallMethodResult({
                    statusCode: StatusCodes.BadInternalError
                });
            }
        }))
            .then((callMethodResults) => {
                callback!(null, isArray ? callMethodResults : callMethodResults[0]);
            })
            .catch((err) => {
                callback!(err);
            });
    }

    public getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;
    public getArgumentDefinition(methodId: MethodId, callback: ResponseCallback<ArgumentDefinition>): void;
    public getArgumentDefinition(methodId: MethodId, callback?: ResponseCallback<ArgumentDefinition>): any {
        getArgumentDefinitionHelper(this, methodId)
            .then((result) => {
                callback!(null, result);
            })
            .catch((err: Error) => {
                callback!(err);
            });
    }

    public translateBrowsePath(browsePaths: BrowsePath[], callback: ResponseCallback<BrowsePathResult[]>): void;
    public translateBrowsePath(browsePath: BrowsePath, callback: ResponseCallback<BrowsePathResult>): void;
    public translateBrowsePath(browsePath: BrowsePath): Promise<BrowsePathResult>;
    public translateBrowsePath(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]>;
    public translateBrowsePath(browsePaths: BrowsePath[] | BrowsePath, callback?: ResponseCallback<any>): any {
        const isArray = Array.isArray(browsePaths);
        if (!isArray) {
            browsePaths = [browsePaths as BrowsePath];
        }
        const browsePathResults = (browsePaths as BrowsePath[]).map((browsePath: BrowsePath) => {
            return this[$addressSpace].browsePath(browsePath);
        });
        callback!(null, isArray ? browsePathResults : browsePathResults[0]);
    }
    public write(nodeToWrite: WriteValueOptions, callback: ResponseCallback<StatusCode>): void;
    public write(nodesToWrite: WriteValueOptions[], callback: ResponseCallback<StatusCode[]>): void;
    public write(nodeToWrite: WriteValueOptions): Promise<StatusCode>;
    public write(nodesToWrite: WriteValueOptions[]): Promise<StatusCode[]>;
    public write(nodesToWrite: WriteValueOptions[] | WriteValueOptions, callback?: ResponseCallback<any>): any {
        const isArray = nodesToWrite instanceof Array;
        const _nodesToWrite: WriteValueOptions[] = !isArray ? [nodesToWrite] : nodesToWrite;
        const context = this[$context];
        setImmediate(() => {
            const statusCodesPromises = _nodesToWrite.map((nodeToWrite: WriteValueOptions) => {
                assert(!!nodeToWrite.nodeId, "expecting a nodeId");
                assert(!!nodeToWrite.attributeId, "expecting a attributeId");

                const nodeId = nodeToWrite.nodeId!;
                const obj = this[$addressSpace].findNode(nodeId);
                if (!obj) {
                    return StatusCodes.BadNodeIdUnknown;
                }
                try {
                    return promisify(obj.writeAttribute).call(obj, context, nodeToWrite);
                } catch (err) {
                    return StatusCodes.BadInternalError;
                }
            });
            Promise.all(statusCodesPromises)
                .then((statusCodes) => {
                    callback!(null, isArray ? statusCodes : statusCodes[0]);
                })
                .catch((err) => {
                    callback!(err);
                });
        });
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
import { withCallback } from "thenify-ex";
PseudoSession.prototype.read = withCallback(PseudoSession.prototype.read);
PseudoSession.prototype.write = withCallback(PseudoSession.prototype.write);
PseudoSession.prototype.browse = withCallback(PseudoSession.prototype.browse);
PseudoSession.prototype.browseNext = withCallback(PseudoSession.prototype.browseNext);
PseudoSession.prototype.getArgumentDefinition = withCallback(PseudoSession.prototype.getArgumentDefinition);
PseudoSession.prototype.call = withCallback(PseudoSession.prototype.call);
PseudoSession.prototype.translateBrowsePath = withCallback(PseudoSession.prototype.translateBrowsePath);
