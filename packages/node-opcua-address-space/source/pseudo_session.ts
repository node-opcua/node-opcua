/**
 * @module node-opcua-address-space
 */

import { promisify } from "node:util";
import type { ContinuationPoint, IAddressSpace, ISessionContext, UAVariable } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { randomGuid } from "node-opcua-basic-types";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { make_errorLog } from "node-opcua-debug";
import { NodeId, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import {
    type ArgumentDefinition,
    type BrowseDescriptionLike,
    type CallMethodRequestLike,
    getArgumentDefinitionHelper,
    type IBasicSession,
    type MethodId,
    type ResponseCallback
} from "node-opcua-pseudo-session";
import { BrowseDescription, BrowseResult } from "node-opcua-service-browse";
import { CallMethodRequest, CallMethodResult } from "node-opcua-service-call";
import type { BrowsePath, BrowsePathResult } from "node-opcua-service-translate-browse-path";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import type { BrowseDescriptionOptions, ReadValueIdOptions, WriteValueOptions } from "node-opcua-types";

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
            return callback?.(err);
        }
        // handle continuation points
        results = results.map((result: BrowseResult, _index) => {
            assert(!result.continuationPoint);
            // c8 ignore next
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
        callback?.(null, results);
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
        .map((continuationPoint: ContinuationPoint, _index: number) => {
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
    callback?.(null, results);
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
    public browse(
        nodesToBrowse: BrowseDescriptionLike | BrowseDescriptionLike[],
        callback?: ResponseCallback<BrowseResult> | ResponseCallback<BrowseResult[]>
        // biome-ignore lint/suspicious/noConfusingVoidType: implementation must satisfy both the void (callback) and Promise<T> (thenify-wrapped) overloads; biome's suggested undefined-in-union fix breaks the "not all code paths return a value" check
    ): void | Promise<BrowseResult> | Promise<BrowseResult[]> {
        const isArray = Array.isArray(nodesToBrowse);
        if (!isArray) {
            const callbackSingle = callback as ResponseCallback<BrowseResult> | undefined;
            this.browse([nodesToBrowse as BrowseDescriptionLike], (err, results) => {
                callbackSingle?.(err, results ? results[0] : undefined);
            });
            return;
        }
        const callbackArray = callback as ResponseCallback<BrowseResult[]> | undefined;
        const browseAll = (nodesToBrowse: BrowseDescriptionOptions[], callack: ResponseCallback<BrowseResult[]>) => {
            const results: BrowseResult[] = [];
            for (const browseDescription of nodesToBrowse as BrowseDescriptionOptions[]) {
                browseDescription.referenceTypeId = resolveNodeId(browseDescription.referenceTypeId || NodeId.nullNodeId);
                const _browseDescription = coerceBrowseDescription(browseDescription);
                const nodeId = resolveNodeId(_browseDescription.nodeId);
                const r = this[$addressSpace].browseSingleNode(nodeId, _browseDescription, this[$context]);
                results.push(r);
            }
            callack?.(null, results);
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
                callbackArray
            );
        });
    }

    public read(nodeToRead: ReadValueIdOptions, callback: ResponseCallback<DataValue>): void;
    public read(nodesToRead: ReadValueIdOptions[], callback: ResponseCallback<DataValue[]>): void;
    public read(nodeToRead: ReadValueIdOptions): Promise<DataValue>;
    public read(nodesToRead: ReadValueIdOptions[]): Promise<DataValue[]>;
    public read(
        nodesToRead: ReadValueIdOptions[] | ReadValueIdOptions,
        callback?: ResponseCallback<DataValue> | ResponseCallback<DataValue[]>
        // biome-ignore lint/suspicious/noConfusingVoidType: implementation must satisfy both the void (callback) and Promise<T> (thenify-wrapped) overloads; biome's suggested undefined-in-union fix breaks the "not all code paths return a value" check
    ): void | Promise<DataValue> | Promise<DataValue[]> {
        const isArray = Array.isArray(nodesToRead);
        if (!isArray) {
            nodesToRead = [nodesToRead as ReadValueIdOptions];
        }
        const _nodesToRead = nodesToRead as ReadValueIdOptions[];
        const context = this[$context];

        const readV = async (nodeToRead: ReadValueIdOptions): Promise<DataValue> => {
            if (!nodeToRead.nodeId) {
                return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
            }
            const obj = this[$addressSpace].findNode(nodeToRead.nodeId);
            if (!obj) {
                return new DataValue({ statusCode: StatusCodes.BadNodeIdUnknown });
            }
            // refresh the variable value if the attribute to read is the Value attribute
            if (obj.nodeClass === NodeClass.Variable && nodeToRead.attributeId === AttributeIds.Value) {
                return await (obj as UAVariable).readValueAsync(context);
            }
            assert(!!nodeToRead.nodeId, "expecting a nodeId");
            if (!nodeToRead.attributeId) {
                throw new Error("expecting a attributeId");
            }
            const attributeId = nodeToRead.attributeId;
            const indexRange = nodeToRead.indexRange;
            const dataEncoding = nodeToRead.dataEncoding;
            const dataValue = obj.readAttribute(context, attributeId, indexRange, dataEncoding);
            return dataValue;
        };
        Promise.all(_nodesToRead.map(async (nodeToRead: ReadValueIdOptions) => await readV(nodeToRead)))
            .then((dataValues) => {
                if (isArray) {
                    (callback as ResponseCallback<DataValue[]> | undefined)?.(null, dataValues);
                } else {
                    (callback as ResponseCallback<DataValue> | undefined)?.(null, dataValues[0]);
                }
            })
            .catch((err) => callback?.(err));
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
        callback?: ResponseCallback<BrowseResult> | ResponseCallback<BrowseResult[]>
        // biome-ignore lint/suspicious/noConfusingVoidType: implementation must satisfy both the void (callback) and Promise<T> (thenify-wrapped) overloads; biome's suggested undefined-in-union fix breaks the "not all code paths return a value" check
    ): void | Promise<BrowseResult> | Promise<BrowseResult[]> {
        setImmediate(() => {
            if (continuationPoints instanceof Buffer) {
                const callbackSingle = callback as ResponseCallback<BrowseResult> | undefined;
                this.browseNext([continuationPoints], releaseContinuationPoints, (err, _results) => {
                    if (err) {
                        callbackSingle?.(err);
                        return;
                    }
                    callbackSingle?.(null, _results?.[0]);
                });
                return;
            }
            innerBrowseNext(
                { continuationPointManager: this.continuationPointManager },
                continuationPoints as Buffer[],
                releaseContinuationPoints,
                callback as ResponseCallback<BrowseResult[]> | undefined
            );
        });
    }

    // call service ----------------------------------------------------------------------------------------------------
    public call(methodToCall: CallMethodRequestLike, callback: ResponseCallback<CallMethodResult>): void;
    public call(methodsToCall: CallMethodRequestLike[], callback: ResponseCallback<CallMethodResult[]>): void;
    public call(methodToCall: CallMethodRequestLike): Promise<CallMethodResult>;
    public call(methodsToCall: CallMethodRequestLike[]): Promise<CallMethodResult[]>;
    public call(
        methodsToCall: CallMethodRequestLike | CallMethodRequestLike[],
        callback?: ResponseCallback<CallMethodResult> | ResponseCallback<CallMethodResult[]>
        // biome-ignore lint/suspicious/noConfusingVoidType: implementation must satisfy both the void (callback) and Promise<T> (thenify-wrapped) overloads; biome's suggested undefined-in-union fix breaks the "not all code paths return a value" check
    ): void | Promise<CallMethodResult> | Promise<CallMethodResult[]> {
        const isArray = Array.isArray(methodsToCall);
        if (!isArray) {
            methodsToCall = [methodsToCall as CallMethodRequestLike];
        }
        Promise.all(
            (methodsToCall as CallMethodRequestLike[]).map(async (methodToCall) => {
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
            })
        )
            .then((callMethodResults) => {
                if (isArray) {
                    (callback as ResponseCallback<CallMethodResult[]> | undefined)?.(null, callMethodResults);
                } else {
                    (callback as ResponseCallback<CallMethodResult> | undefined)?.(null, callMethodResults[0]);
                }
            })
            .catch((err) => {
                callback?.(err);
            });
    }

    public getArgumentDefinition(methodId: MethodId): Promise<ArgumentDefinition>;
    public getArgumentDefinition(methodId: MethodId, callback: ResponseCallback<ArgumentDefinition>): void;
    public getArgumentDefinition(
        methodId: MethodId,
        callback?: ResponseCallback<ArgumentDefinition>
        // biome-ignore lint/suspicious/noConfusingVoidType: implementation must satisfy both the void (callback) and Promise<T> (thenify-wrapped) overloads; biome's suggested undefined-in-union fix breaks the "not all code paths return a value" check
    ): void | Promise<ArgumentDefinition> {
        getArgumentDefinitionHelper(this, methodId)
            .then((result) => {
                callback?.(null, result);
            })
            .catch((err: Error) => {
                callback?.(err);
            });
    }

    public translateBrowsePath(browsePaths: BrowsePath[], callback: ResponseCallback<BrowsePathResult[]>): void;
    public translateBrowsePath(browsePath: BrowsePath, callback: ResponseCallback<BrowsePathResult>): void;
    public translateBrowsePath(browsePath: BrowsePath): Promise<BrowsePathResult>;
    public translateBrowsePath(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]>;
    public translateBrowsePath(
        browsePaths: BrowsePath[] | BrowsePath,
        callback?: ResponseCallback<BrowsePathResult> | ResponseCallback<BrowsePathResult[]>
        // biome-ignore lint/suspicious/noConfusingVoidType: implementation must satisfy both the void (callback) and Promise<T> (thenify-wrapped) overloads; biome's suggested undefined-in-union fix breaks the "not all code paths return a value" check
    ): void | Promise<BrowsePathResult> | Promise<BrowsePathResult[]> {
        const isArray = Array.isArray(browsePaths);
        if (!isArray) {
            browsePaths = [browsePaths as BrowsePath];
        }
        const browsePathResults = (browsePaths as BrowsePath[]).map((browsePath: BrowsePath) => {
            return this[$addressSpace].browsePath(browsePath);
        });
        if (isArray) {
            (callback as ResponseCallback<BrowsePathResult[]> | undefined)?.(null, browsePathResults);
        } else {
            (callback as ResponseCallback<BrowsePathResult> | undefined)?.(null, browsePathResults[0]);
        }
    }
    public write(nodeToWrite: WriteValueOptions, callback: ResponseCallback<StatusCode>): void;
    public write(nodesToWrite: WriteValueOptions[], callback: ResponseCallback<StatusCode[]>): void;
    public write(nodeToWrite: WriteValueOptions): Promise<StatusCode>;
    public write(nodesToWrite: WriteValueOptions[]): Promise<StatusCode[]>;
    public write(
        nodesToWrite: WriteValueOptions[] | WriteValueOptions,
        callback?: ResponseCallback<StatusCode> | ResponseCallback<StatusCode[]>
        // biome-ignore lint/suspicious/noConfusingVoidType: implementation must satisfy both the void (callback) and Promise<T> (thenify-wrapped) overloads; biome's suggested undefined-in-union fix breaks the "not all code paths return a value" check
    ): void | Promise<StatusCode> | Promise<StatusCode[]> {
        const isArray = Array.isArray(nodesToWrite);
        const _nodesToWrite: WriteValueOptions[] = !isArray ? [nodesToWrite] : nodesToWrite;
        const context = this[$context];
        setImmediate(() => {
            const statusCodesPromises = _nodesToWrite.map((nodeToWrite: WriteValueOptions) => {
                assert(!!nodeToWrite.attributeId, "expecting a attributeId");

                if (!nodeToWrite.nodeId) {
                    return StatusCodes.BadNodeIdUnknown;
                }
                const obj = this[$addressSpace].findNode(nodeToWrite.nodeId);
                if (!obj) {
                    return StatusCodes.BadNodeIdUnknown;
                }
                try {
                    return promisify(obj.writeAttribute).call(obj, context, nodeToWrite);
                } catch (_err) {
                    return StatusCodes.BadInternalError;
                }
            });
            Promise.all(statusCodesPromises)
                .then((statusCodes) => {
                    if (isArray) {
                        (callback as ResponseCallback<StatusCode[]> | undefined)?.(null, statusCodes as StatusCode[]);
                    } else {
                        (callback as ResponseCallback<StatusCode> | undefined)?.(null, statusCodes[0]);
                    }
                })
                .catch((err) => {
                    callback?.(err);
                });
        });
    }
}

import { withCallback } from "thenify-ex";

PseudoSession.prototype.read = withCallback(PseudoSession.prototype.read);
PseudoSession.prototype.write = withCallback(PseudoSession.prototype.write);
PseudoSession.prototype.browse = withCallback(PseudoSession.prototype.browse);
PseudoSession.prototype.browseNext = withCallback(PseudoSession.prototype.browseNext);
PseudoSession.prototype.getArgumentDefinition = withCallback(PseudoSession.prototype.getArgumentDefinition);
PseudoSession.prototype.call = withCallback(PseudoSession.prototype.call);
PseudoSession.prototype.translateBrowsePath = withCallback(PseudoSession.prototype.translateBrowsePath);
