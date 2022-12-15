/**
 * @module node-opcua-client-crawler
 */
import { EventEmitter } from "events";
import * as async from "async";

import { UAReferenceType } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { browseAll, BrowseDescriptionLike, IBasicSession, ReadValueIdOptions, ResponseCallback } from "node-opcua-client";
import { DataTypeDefinition } from "node-opcua-types";
import { ReferenceTypeIds, VariableIds } from "node-opcua-constants";
import {
    AttributeIds,
    BrowseDirection,
    coerceLocalizedText,
    coerceQualifiedName,
    LocalizedText,
    makeResultMask,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { makeNodeId, NodeId, NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { BrowseDescription, BrowseResult, ReferenceDescription } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { ErrorCallback } from "node-opcua-status-code";
import {
    CacheNodeReferenceType,
    CacheNodeVariableType,
    CacheNodeObjectType,
    CacheNodeVariable,
    CacheNode,
    CacheNodeDataType
} from "./cache_node";
import {
    pendingBrowseName,
    TaskExtraReference,
    Task,
    TaskBase,
    TaskBrowseNode,
    TaskBrowseNext,
    EmptyCallback,
    TaskCrawl,
    TaskProcessBrowseResponse,
    dedup_reference
} from "./private";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const doDebug1 = doDebug && false;
const warningLog = make_warningLog(__filename);

//                         "ReferenceType | IsForward | BrowseName | NodeClass | DisplayName | TypeDefinition"
const resultMask = makeResultMask("ReferenceType | IsForward | BrowseName | DisplayName | NodeClass | TypeDefinition");

function zip<T1, T2>(arrA: T1[], arrB: T2[]): [T1, T2][] {
    return arrA.map((value, idx) => [value, arrB[idx]]);
}

function make_node_attribute_key(nodeId: NodeId, attributeId: AttributeIds): string {
    return nodeId.toString() + "_" + AttributeIds[attributeId];
}
function convertToStandardArray(a: number[] | Uint32Array | undefined | null): number[] | undefined {
    if (a === undefined || a === null) {
        return undefined;
    }
    if (a instanceof Array) {
        return a;
    }
    if (a instanceof Buffer) {
        return a;
    }
    try {
        const b: number[] = [];
        for (const x of a) {
            b.push(x);
        }
        return b;
    } catch (err) {
        warningLog(a);
        warningLog("convertToStandardArray error", (err as Error).message);
        return a as unknown as number[];
    }
}

//
// some server do not expose the ReferenceType Node in their address space
// ReferenceType are defined by the OPCUA standard and can be pre-populated in the crawler.
// Pre-populating the ReferenceType node in the crawler will also reduce the network traffic.
//
/*=
 *
 * @param arr
 * @param maxNode
 * @private
 * @return {*}
 */
function _fetch_elements<T>(arr: T[], maxNode: number): T[] {
    assert(Array.isArray(arr));
    assert(arr.length > 0);
    const highLimit = maxNode <= 0 ? arr.length : maxNode;
    const tmp = arr.splice(0, highLimit);
    assert(tmp.length > 0);
    return tmp;
}

type CacheNodeWithAbstractField = CacheNodeReferenceType | CacheNodeVariableType | CacheNodeObjectType;
type CacheNodeWithDataTypeField = CacheNodeVariable | CacheNodeVariableType;
type CacheNodeWithAccessLevelField = CacheNodeVariable;

const referencesNodeId = resolveNodeId("References");
// const hierarchicalReferencesId = resolveNodeId("HierarchicalReferences");
const hasTypeDefinitionNodeId = resolveNodeId("HasTypeDefinition");

function _setExtraReference(task: TaskExtraReference, callback: ErrorCallback) {
    const param = task.param;
    assert(param.userData.setExtraReference);
    param.userData.setExtraReference!(param.parentNode, param.reference, param.childCacheNode, param.userData);
    callback();
}

export interface UserData {
    onBrowse: (crawler: NodeCrawlerBase, cacheNode: CacheNode, userData: UserData) => void;
    setExtraReference?: (parentNode: CacheNode, reference: any, childCacheNode: CacheNode, userData: UserData) => void;
}

interface NodeCrawlerEvents {
    on(event: "browsed", handler: (cacheNode: CacheNode, userData: UserData) => void): void;
}

export interface NodeCrawlerClientSession {
    read(nodesToRead: ReadValueIdOptions[]): Promise<DataValue[]>;
    browse(nodesToBrowse: BrowseDescriptionLike[]): Promise<BrowseResult[]>;
    browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean): Promise<BrowseResult[]>;
}

type ReadNodeAction = (value: any, dataValue: DataValue) => void;

interface TaskReadNode {
    nodeToRead: {
        attributeId: AttributeIds;
        nodeId: NodeId;
    };
    action: ReadNodeAction;
}

function getReferenceTypeId(referenceType: undefined | string | NodeId | UAReferenceType): NodeId | null {
    if (!referenceType) {
        return null;
    }
    /* istanbul ignore next */
    if (referenceType.toString() === "i=45" || referenceType === "HasSubtype") {
        return NodeId.resolveNodeId("i=45");
    } else if (referenceType.toString() === "i=35" || referenceType === "Organizes") {
        return NodeId.resolveNodeId("i=35");
    } else if (referenceType.toString() === "i=47" || referenceType === "HasComponent") {
        return NodeId.resolveNodeId("i=47");
    } else if (referenceType.toString() === "i=46" || referenceType === "HasProperty") {
        return NodeId.resolveNodeId("i=46");
    } else if (referenceType.toString() === NodeId.resolveNodeId("HasEncoding").toString() || referenceType === "HasEncoding") {
        return NodeId.resolveNodeId("HasEncoding");
    } else if (
        referenceType.toString() === NodeId.resolveNodeId("HasDescription").toString() ||
        referenceType === "HasDescription"
    ) {
        return NodeId.resolveNodeId("HasDescription");
    } else if (referenceType.toString() === "i=31" || referenceType === "References") {
        return NodeId.resolveNodeId("i=31");
    } else {
        warningLog("Invalid or Unknown reference Type" + referenceType.toString());
        return null;
    }
}

export type Pojo = Record<string, unknown>;
export type ObjectMap = { [key: string]: Pojo };

// tslint:disable:max-classes-per-file
/**
 * @class NodeCrawlerBase
 * @param session
 * @constructor
 */
export class NodeCrawlerBase extends EventEmitter implements NodeCrawlerEvents {
    public static follow(
        crawler: NodeCrawlerBase,
        cacheNode: CacheNode,
        userData: UserData,
        referenceType?: string | UAReferenceType,
        browseDirection?: BrowseDirection
    ): void {
        const referenceTypeNodeId = getReferenceTypeId(referenceType);

        for (const reference of cacheNode.references) {
            if (browseDirection! === BrowseDirection.Forward && !reference.isForward) {
                continue;
            }
            if (browseDirection! === BrowseDirection.Inverse && reference.isForward) {
                continue;
            }

            if (!referenceTypeNodeId) {
                crawler.followReference(cacheNode, reference, userData);
            } else {
                if (NodeId.sameNodeId(referenceTypeNodeId, reference.referenceTypeId)) {
                    crawler.followReference(cacheNode, reference, userData);
                }
            }
        }
    }

    public maxNodesPerRead = 0;
    public maxNodesPerBrowse = 0;
    public startTime: Date = new Date();
    public readCounter = 0;
    public browseCounter = 0;
    public browseNextCounter = 0;
    public transactionCounter = 0;
    private readonly session: NodeCrawlerClientSession;
    private readonly browseNameMap: ObjectMap;
    private readonly taskQueue: async.QueueObject<TaskBase>;
    private readonly pendingReadTasks: TaskReadNode[];
    private readonly pendingBrowseTasks: TaskBrowseNode[];

    protected readonly _objectCache: { [key: string]: CacheNode };
    private _crawled: Set<string>;
    private _visitedNode: Set<string>;
    private _prePopulatedSet = new WeakSet();

    constructor(session: NodeCrawlerClientSession) {
        super();

        this.session = session;
        // verify that session object provides the expected methods (browse/read)
        this.browseNameMap = {};
        this._objectCache = {};
        this._crawled = new Set<string>();
        this._visitedNode = new Set<string>();

        this._initialize_referenceTypeId();

        this.pendingReadTasks = [];
        this.pendingBrowseTasks = [];

        this.taskQueue = async.queue((task: TaskBase, callback: EmptyCallback) => {
            // use process next tick to relax the stack frame

            /* istanbul ignore next */
            if (doDebug) {
                debugLog(" executing Task ", task.name); // JSON.stringify(task, null, " "));
            }

            setImmediate(() => {
                task.func.call(this, task, () => {
                    this.resolve_deferred_browseNode();
                    this.resolve_deferred_readNode();
                    callback();
                });
            });
        }, 1);

        // MaxNodesPerRead from Server.ServerCapabilities.OperationLimits
        // VariableIds.ServerType_ServerCapabilities_OperationLimits_MaxNodesPerRead
        this.maxNodesPerRead = 0;

        //  MaxNodesPerBrowse from Server.ServerCapabilities.OperationLimits
        //  VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse
        this.maxNodesPerBrowse = 0; // 0 = no limits

        // statistics
        this.startTime = new Date();
        this.readCounter = 0;
        this.browseCounter = 0;
        this.transactionCounter = 0;
    }
    public dispose(): void {
        assert(this.pendingReadTasks.length === 0);
        assert(this.pendingBrowseTasks.length === 0);

        this.pendingReadTasks.length = 0;
        this.pendingBrowseTasks.length = 0;

        assert(this.taskQueue.length() === 0);

        Object.values(this._objectCache).map((cache) => (cache as CacheNode).dispose());
        this.taskQueue.kill();

        (this as any).session = null;
        (this as any).browseNameMap = null;
        (this as any).taskQueue = null;
        (this as any)._objectCache = {};
        (this as any)._crawled = null;
        (this as any)._visitedNode = null;
        (this as any)._prePopulatedSet = null;
    }

    public toString(): string {
        return (
            "" +
            `reads:       ${this.readCounter}\n` +
            `browses:     ${this.browseCounter}  \n` +
            `transaction: ${this.transactionCounter}  \n`
        );
    }

    public crawl(nodeId: NodeIdLike, userData: UserData): Promise<void>;
    public crawl(nodeId: NodeIdLike, userData: UserData, endCallback: ErrorCallback): void;
    public crawl(nodeId: NodeIdLike, userData: UserData, ...args: any[]): any {
        const endCallback = args[0] as ErrorCallback;
        assert(typeof endCallback === "function", "expecting callback");
        nodeId = resolveNodeId(nodeId) as NodeId;
        assert(typeof endCallback === "function");
        this._readOperationalLimits((err?: Error) => {
            /* istanbul ignore next */
            if (err) {
                return endCallback(err);
            }
            this._inner_crawl(nodeId as NodeId, userData, endCallback);
        });
    }

    /**
     * @internal
     * @private
     */
    private _inner_crawl(nodeId: NodeId, userData: UserData, endCallback: ErrorCallback) {
        assert(userData !== null && typeof userData === "object");
        assert(typeof endCallback === "function");

        let hasEnded = false;

        this.taskQueue.drain(() => {
            debugLog("taskQueue is empty !!", this.taskQueue.length());

            if (!hasEnded) {
                hasEnded = true;
                this._visitedNode = new Set<string>();
                this._crawled = new Set<string>();
                this.emit("end");
                endCallback();
            }
        });

        let cacheNode = this._getCacheNode(nodeId);
        if (!cacheNode) {
            cacheNode = this._createCacheNode(nodeId);
        }

        // ----------------------- Read missing essential information about node
        // such as nodeClass, typeDefinition browseName, displayName
        // this sequence is only necessary on the top node being crawled,
        // as browseName,displayName,nodeClass will be provided by ReferenceDescription later on for child nodes
        //
        async.parallel(
            {
                task1: (callback: ErrorCallback) => {
                    this._defer_readNode(
                        cacheNode.nodeId,
                        AttributeIds.BrowseName,

                        (err: Error | null, value?: QualifiedName) => {
                            /* istanbul ignore else */
                            if (err) {
                                return callback(err);
                            }
                            if (!(value instanceof QualifiedName)) {
                                warningLog(" node ", cacheNode.nodeId.toString(), " has a invalid browseName", value);
                                cacheNode.browseName = coerceQualifiedName("<INVALID BROWSE NAME>");
                            } else {
                                cacheNode.browseName = value;
                            }
                            setImmediate(callback);
                        }
                    );
                },

                task2: (callback: ErrorCallback) => {
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.NodeClass, (err: Error | null, value?: NodeClass) => {
                        /* istanbul ignore else */
                        if (err) {
                            return callback(err);
                        }
                        cacheNode.nodeClass = value!;
                        setImmediate(callback);
                    });
                },

                task3: (callback: ErrorCallback) => {
                    this._defer_readNode(
                        cacheNode.nodeId,
                        AttributeIds.DisplayName,

                        (err: Error | null, value?: LocalizedText) => {
                            /* istanbul ignore else */
                            if (err) {
                                return callback(err);
                            }
                            if (!(value instanceof LocalizedText)) {
                                warningLog(" node ", cacheNode.nodeId.toString(), " has a invalid displayName", value);
                                cacheNode.displayName = coerceLocalizedText("<INVALID LOCALIZED NAME>")!;
                            } else {
                                cacheNode.displayName = value;
                            }
                            setImmediate(callback);
                        }
                    );
                },

                task4: (callback: ErrorCallback) => {
                    this._resolve_deferred_readNode(callback);
                }
            },
            (err?: Error | null, data?: any) => {
                this._add_crawl_task(cacheNode, userData);
            }
        );
    }

    private _add_crawl_task(cacheNode: CacheNode, userData: UserData) {
        assert(userData);
        assert(this !== null && typeof this === "object");

        const key = cacheNode.nodeId.toString();

        /* istanbul ignore else */
        if (this._crawled.has(key)) {
            return;
        }
        this._crawled.add(key);

        const task: TaskCrawl = {
            func: NodeCrawlerBase.prototype._crawl_task,
            param: {
                cacheNode,
                userData
            }
        };
        this._push_task("_crawl task", task);
    }

    public followReference(parentNode: CacheNode, reference: ReferenceDescription, userData: UserData): void {
        assert(reference instanceof ReferenceDescription);

        let referenceTypeIdCacheNode = this._getCacheNode(reference.referenceTypeId);
        if (this._prePopulatedSet.has(referenceTypeIdCacheNode)) {
            this._prePopulatedSet.delete(referenceTypeIdCacheNode);
            this._add_crawl_task(referenceTypeIdCacheNode, userData);
        }
        if (!referenceTypeIdCacheNode) {
            referenceTypeIdCacheNode = this._createCacheNode(reference.referenceTypeId);
            referenceTypeIdCacheNode.nodeClass = NodeClass.ReferenceType;
            this._add_crawl_task(referenceTypeIdCacheNode, userData);
        }

        let childCacheNode = this._getCacheNode(reference.nodeId);
        if (!childCacheNode) {
            childCacheNode = this._createCacheNode(reference.nodeId, parentNode, reference);
            childCacheNode.browseName = reference.browseName;
            childCacheNode.displayName = reference.displayName;
            childCacheNode.typeDefinition = reference.typeDefinition;
            childCacheNode.nodeClass = reference.nodeClass as NodeClass;
            assert(childCacheNode.parent === parentNode);
            assert(childCacheNode.referenceToParent === reference);

            this._add_crawl_task(childCacheNode, userData);
        } else {
            if (userData.setExtraReference) {
                const task: TaskExtraReference = {
                    func: _setExtraReference,
                    param: {
                        childCacheNode,
                        parentNode,
                        reference,
                        userData
                    }
                };
                this._push_task("setExtraRef", task);
            }
        }
    }

    /**
     * perform pending read Node operation
     * @method _resolve_deferred_readNode
     * @param callback
     * @private
     * @internal
     */
    private _resolve_deferred_readNode(callback: ErrorCallback): void {
        if (this.pendingReadTasks.length === 0) {
            // nothing to read
            callback();
            return;
        }

        doDebug1 && debugLog("_resolve_deferred_readNode = ", this.pendingReadTasks.length);

        const selectedPendingReadTasks: TaskReadNode[] = _fetch_elements(this.pendingReadTasks, this.maxNodesPerRead);

        const nodesToRead = selectedPendingReadTasks.map((e: TaskReadNode) => e.nodeToRead);

        this.readCounter += nodesToRead.length;
        this.transactionCounter++;

        this.session
            .read(nodesToRead)
            .catch((err: Error) => {
                return callback(err);
            })
            .then((dataValues) => {
                for (const [readTask, dataValue] of zip(selectedPendingReadTasks, dataValues!)) {
                    assert(Object.prototype.hasOwnProperty.call(dataValue, "statusCode"));
                    if (dataValue.statusCode.equals(StatusCodes.Good)) {
                        /* istanbul ignore else */
                        if (dataValue.value === null) {
                            readTask.action(null, dataValue);
                        } else {
                            readTask.action(dataValue.value.value, dataValue);
                        }
                    } else {
                        readTask.action({ name: dataValue.statusCode.toString() }, dataValue);
                    }
                }
                callback();
            });
    }

    private _resolve_deferred_browseNode(callback: ErrorCallback): void {
        if (this.pendingBrowseTasks.length === 0) {
            callback();
            return;
        }

        doDebug1 && debugLog("_resolve_deferred_browseNode = ", this.pendingBrowseTasks.length);

        const objectsToBrowse: TaskBrowseNode[] = _fetch_elements(this.pendingBrowseTasks, this.maxNodesPerBrowse);

        const nodesToBrowse = objectsToBrowse.map((e: TaskBrowseNode) => {
            assert(Object.prototype.hasOwnProperty.call(e, "referenceTypeId"));

            return new BrowseDescription({
                browseDirection: BrowseDirection.Forward,
                includeSubtypes: true,
                nodeId: e.nodeId,
                referenceTypeId: e.referenceTypeId,
                resultMask
            });
        });

        this.browseCounter += nodesToBrowse.length;
        this.transactionCounter++;

        browseAll(this.session as IBasicSession, nodesToBrowse)
            .then((browseResults?: BrowseResult[]) => {
                assert(browseResults!.length === nodesToBrowse.length);
                browseResults = browseResults || [];
                const task: TaskProcessBrowseResponse = {
                    func: NodeCrawlerBase.prototype._process_browse_response_task,
                    param: {
                        browseResults,
                        objectsToBrowse
                    }
                };
                this._unshift_task("process browseResults", task);
                callback();
            })
            .catch((err) => {
                debugLog("session.browse err:", err);
                return callback(err || undefined);
            });
    }
    /**
     * @method _unshift_task
     * add a task on top of the queue (high priority)
     * @param name
     * @param task
     * @private
     */
    private _unshift_task(name: string, task: Task) {
        assert(typeof task.func === "function");
        assert(task.func.length === 2);
        task.name = task.name || name;
        this.taskQueue.unshift(task);
        doDebug1 && debugLog("unshift task", name);
    }

    /**
     * @method _push_task
     * add a task at the bottom of the queue (low priority)
     * @param name
     * @param task
     * @private
     */
    private _push_task(name: string, task: Task) {
        assert(typeof task.func === "function");
        assert(task.func.length === 2);
        doDebug1 && debugLog("pushing task", name);
        task.name = task.name || name;
        this.taskQueue.push(task);
    }

    /***
     * @method _emit_on_crawled
     * @param cacheNode
     * @param userData
     * @private
     */
    private _emit_on_crawled(cacheNode: CacheNode, userData: UserData) {
        this.emit("browsed", cacheNode, userData);
    }

    private _crawl_task(task: TaskCrawl, callback: EmptyCallback) {
        const cacheNode = task.param.cacheNode;
        const nodeId = task.param.cacheNode.nodeId;
        const key = nodeId.toString();

        if (this._visitedNode.has(key)) {
            debugLog("skipping already visited", key);
            callback();
            return; // already visited
        }
        // mark as visited to avoid infinite recursion
        this._visitedNode.add(key);

        const browseNodeAction = (err: Error | null, cacheNode1?: CacheNode) => {
            if (err || !cacheNode1) {
                return;
            }
            for (const reference of cacheNode1.references) {
                // those ones come for free
                if (!this.has_cache_NodeAttribute(reference.nodeId, AttributeIds.BrowseName)) {
                    this.set_cache_NodeAttribute(reference.nodeId, AttributeIds.BrowseName, reference.browseName);
                }
                if (!this.has_cache_NodeAttribute(reference.nodeId, AttributeIds.DisplayName)) {
                    this.set_cache_NodeAttribute(reference.nodeId, AttributeIds.DisplayName, reference.displayName);
                }
                if (!this.has_cache_NodeAttribute(reference.nodeId, AttributeIds.NodeClass)) {
                    this.set_cache_NodeAttribute(reference.nodeId, AttributeIds.NodeClass, reference.nodeClass);
                }
            }
            this._emit_on_crawled(cacheNode1, task.param.userData);
            const userData = task.param.userData;
            if (userData.onBrowse) {
                userData.onBrowse(this, cacheNode1, userData);
            }
        };

        this._defer_browse_node(cacheNode, referencesNodeId, browseNodeAction);
        callback();
    }

    private _initialize_referenceTypeId() {
        const appendPrepopulatedReference = (browseName: string) => {
            const nodeId = makeNodeId((ReferenceTypeIds as any)[browseName], 0);
            assert(nodeId);
            const cacheNode = this._createCacheNode(nodeId);
            cacheNode.browseName = new QualifiedName({ name: browseName });
            cacheNode.nodeClass = NodeClass.ReferenceType;
            this._prePopulatedSet.add(cacheNode);
        };

        //  References
        //  +->(hasSubtype) NonHierarchicalReferences
        //                  +->(hasSubtype) HasTypeDefinition
        //  +->(hasSubtype) HierarchicalReferences
        //                  +->(hasSubtype) HasChild/ChildOf
        //                                  +->(hasSubtype) Aggregates/AggregatedBy
        //                                                  +-> HasProperty/PropertyOf
        //                                                  +-> HasComponent/ComponentOf
        //                                                  +-> HasHistoricalConfiguration/HistoricalConfigurationOf
        //                                 +->(hasSubtype) HasSubtype/HasSupertype
        //                  +->(hasSubtype) Organizes/OrganizedBy
        //                  +->(hasSubtype) HasEventSource/EventSourceOf
        appendPrepopulatedReference("HasSubtype");

        /* istanbul ignore else */
        if (false) {
            appendPrepopulatedReference("HasTypeDefinition");
            appendPrepopulatedReference("HasChild");
            appendPrepopulatedReference("HasProperty");
            appendPrepopulatedReference("HasComponent");
            appendPrepopulatedReference("HasHistoricalConfiguration");
            appendPrepopulatedReference("Organizes");
            appendPrepopulatedReference("HasEventSource");
            appendPrepopulatedReference("HasModellingRule");
            appendPrepopulatedReference("HasEncoding");
            appendPrepopulatedReference("HasDescription");
        }
    }

    private _readOperationalLimits(callback: ErrorCallback) {
        const n1 = makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead);
        const n2 = makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse);
        const nodesToRead = [
            { nodeId: n1, attributeId: AttributeIds.Value },
            { nodeId: n2, attributeId: AttributeIds.Value }
        ];
        this.transactionCounter++;
        this.session
            .read(nodesToRead)
            .then((dataValues): void => {
                dataValues = dataValues!;
                const fix = (self: any, maxNodePerX: string, dataValue: DataValue) => {
                    if (dataValue.statusCode.equals(StatusCodes.Good)) {
                        const value = dataValue.value.value;
                        // if this.maxNodesPerRead has been set (<>0) by the user before call is made,
                        // then it serve as a minimum
                        if (self[maxNodePerX]) {
                            if (value > 0) {
                                self[maxNodePerX] = Math.min(self[maxNodePerX], value);
                            }
                        } else {
                            self[maxNodePerX] = value;
                        }
                    } else {
                        debugLog(
                            "warning: server does not provide a valid dataValue for " + maxNodePerX,
                            dataValue.statusCode.toString()
                        );
                    }
                    // ensure we have a sensible maxNodesPerRead value in case the server doesn't specify one
                    self[maxNodePerX] = self[maxNodePerX] || 100;
                    debugLog(maxNodePerX, " set to ", self[maxNodePerX]);
                };

                fix(this, "maxNodesPerRead", dataValues[0]);
                fix(this, "maxNodesPerBrowse", dataValues[1]);
                callback();
            })
            .catch((err: Error) => {
                callback(err);
            });
    }

    private set_cache_NodeAttribute(nodeId: NodeId, attributeId: AttributeIds, value: any) {
        const key = make_node_attribute_key(nodeId, attributeId);
        this.browseNameMap[key] = value;
    }

    private has_cache_NodeAttribute(nodeId: NodeId, attributeId: AttributeIds) {
        const key = make_node_attribute_key(nodeId, attributeId);
        return Object.prototype.hasOwnProperty.call(this.browseNameMap, key);
    }

    private get_cache_NodeAttribute(nodeId: NodeId, attributeId: AttributeIds) {
        const key = make_node_attribute_key(nodeId, attributeId);
        return this.browseNameMap[key];
    }

    /**
     * request a read operation for a Node+Attribute in the future, provides a callback
     *
     * @method _defer_readNode
     * @param nodeId
     * @param attributeId
     * @param callback
     * @private
     * @internal
     */
    private _defer_readNode(
        nodeId: NodeId,
        attributeId: AttributeIds.Value,
        callback: (err: Error | null, value?: DataValue) => void
    ): void;
    private _defer_readNode(
        nodeId: NodeId,
        attributeId: AttributeIds.DisplayName | AttributeIds.Description | AttributeIds.InverseName,
        callback: (err: Error | null, value?: LocalizedText) => void
    ): void;
    private _defer_readNode(
        nodeId: NodeId,
        attributeId: AttributeIds.BrowseName,
        callback: (err: Error | null, value?: QualifiedName) => void
    ): void;
    private _defer_readNode(
        nodeId: NodeId,
        attributeId: AttributeIds.DataType,
        callback: (err: Error | null, value?: NodeId) => void
    ): void;
    private _defer_readNode(
        nodeId: NodeId,
        attributeId: AttributeIds.IsAbstract | AttributeIds.ContainsNoLoops,
        callback: (err: Error | null, value?: boolean) => void
    ): void;
    private _defer_readNode(
        nodeId: NodeId,
        attributeId: AttributeIds.DataTypeDefinition,
        callback: (err: Error | null, value?: DataTypeDefinition) => void
    ): void;
    private _defer_readNode(
        nodeId: NodeId,
        attributeId: AttributeIds.ArrayDimensions,
        callback: (err: Error | null, value?: number[] | Uint32Array) => void
    ): void;
    private _defer_readNode(
        nodeId: NodeId,
        attributeId:
            | AttributeIds.AccessLevel
            | AttributeIds.ValueRank
            | AttributeIds.UserAccessLevel
            | AttributeIds.MinimumSamplingInterval
            | AttributeIds.NodeClass,
        callback: (err: Error | null, value?: number) => void
    ): void;

    private _defer_readNode(nodeId: NodeId, attributeId: AttributeIds, callback: (err: Error | null, value?: any) => void): void {
        nodeId = resolveNodeId(nodeId);
        const key = make_node_attribute_key(nodeId, attributeId);
        if (this.has_cache_NodeAttribute(nodeId, attributeId)) {
            callback(null, this.get_cache_NodeAttribute(nodeId, attributeId));
        } else {
            //   this.browseNameMap[key] = { "?": 1 };
            this.pendingReadTasks.push({
                action: (value: any, dataValue: DataValue) => {
                    if (attributeId === AttributeIds.Value) {
                        this.set_cache_NodeAttribute(nodeId, attributeId, dataValue);
                        callback(null, dataValue);
                        return;
                    }
                    if (attributeId === AttributeIds.ArrayDimensions) {
                        value = dataValue.statusCode.isNotGood() ? null : value;
                        this.set_cache_NodeAttribute(nodeId, attributeId, value);
                        callback(null, value);
                        return;
                    }
                    if (dataValue.statusCode.isNotGood()) {
                        this.set_cache_NodeAttribute(nodeId, attributeId, dataValue);
                        callback(null, null);
                        return;
                    }
                    if (dataValue.statusCode.isGood()) {
                        this.set_cache_NodeAttribute(nodeId, attributeId, value);
                        callback(null, value);
                    } else {
                        callback(
                            new Error(
                                "Error " +
                                dataValue.statusCode.toString() +
                                " while reading " +
                                nodeId.toString() +
                                " attributeIds " +
                                AttributeIds[attributeId]
                            )
                        );
                    }
                },
                nodeToRead: {
                    attributeId,
                    nodeId
                }
            });
        }
    }

    private _resolve_deferred(comment: string, collection: any[], method: (callback: EmptyCallback) => void) {
        if (collection.length > 0) {
            doDebug1 && debugLog("_resolve_deferred ", comment, collection.length);
            this._push_task("adding operation " + comment, {
                func: (task: Task, callback: EmptyCallback) => {
                    debugLog("executing task", comment);
                    method.call(this, callback);
                },
                param: {}
            });
        }
    }

    private resolve_deferred_readNode() {
        this._resolve_deferred("read_node", this.pendingReadTasks, this._resolve_deferred_readNode);
    }

    private resolve_deferred_browseNode() {
        this._resolve_deferred("browse_node", this.pendingBrowseTasks, this._resolve_deferred_browseNode);
    }

    // ---------------------------------------------------------------------------------------

    private _getCacheNode(nodeId: NodeIdLike): CacheNode {
        const key = resolveNodeId(nodeId).toString();
        return this._objectCache[key];
    }

    private _createCacheNode(nodeId: NodeId, parentNode?: CacheNode, referenceToParent?: ReferenceDescription): CacheNode {
        const key = resolveNodeId(nodeId).toString();
        let cacheNode: CacheNode = this._objectCache[key];

        /* istanbul ignore else */
        if (cacheNode) {
            throw new Error("NodeCrawlerBase#_createCacheNode :" + " cache node should not exist already : " + nodeId.toString());
        }
        const nodeClass = (referenceToParent ? referenceToParent!.nodeClass : NodeClass.Unspecified) as NodeClass;
        switch (nodeClass) {
            case NodeClass.Method:
                cacheNode = new CacheNode(nodeId);
                cacheNode.nodeClass = NodeClass.Method;
                break;
            case NodeClass.Object:
                cacheNode = new CacheNode(nodeId);
                cacheNode.nodeClass = NodeClass.Object;
                break;
            case NodeClass.ObjectType:
                cacheNode = new CacheNode(nodeId);
                cacheNode.nodeClass = NodeClass.ObjectType;
                break;
            case NodeClass.Variable:
                cacheNode = new CacheNodeVariable(nodeId);
                break;
            case NodeClass.VariableType:
                cacheNode = new CacheNodeVariableType(nodeId);
                break;
            default:
                cacheNode = new CacheNode(nodeId);
                cacheNode.nodeClass = nodeClass;
                break;
        }
        cacheNode.parent = parentNode;
        cacheNode.referenceToParent = referenceToParent;
        assert(!Object.prototype.hasOwnProperty.call(this._objectCache, key));
        this._objectCache[key] = cacheNode;
        return cacheNode;
    }

    /**
     * perform a deferred browse
     * instead of calling session.browse directly, this function add the request to a list
     * so that request can be grouped and send in one single browse command to the server.
     *
     * @method _defer_browse_node
     * @private
     *
     */
    private _defer_browse_node(
        cacheNode: CacheNode,
        referenceTypeId: NodeId,
        actionOnBrowse: (err: Error | null, cacheNode?: CacheNode) => void
    ) {
        this.pendingBrowseTasks.push({
            action: (object: CacheNode) => actionOnBrowse(null, cacheNode),
            cacheNode,
            nodeId: cacheNode.nodeId,
            referenceTypeId
        });
    }

    private _process_single_browseResult(_objectToBrowse: TaskBrowseNode, browseResult: BrowseResult) {
        const cacheNode = _objectToBrowse.cacheNode as CacheNode;
        assert(this._visitedNode.has(cacheNode.nodeId.toString()));
        cacheNode.references = cacheNode.references.concat(browseResult.references!);
        this._process_single_browseResult2(_objectToBrowse);
    }

    private _process_single_browseResult2(_objectToBrowse: TaskBrowseNode) {
        const cacheNode = _objectToBrowse.cacheNode as CacheNode;

        // note : some OPCUA may expose duplicated reference, they need to be filtered out
        // dedup reference
        cacheNode.references = dedup_reference(cacheNode, cacheNode.references);

        // extract the reference containing HasTypeDefinition
        const tmp = cacheNode.references.filter((x) => sameNodeId(x.referenceTypeId, hasTypeDefinitionNodeId));
        if (tmp.length) {
            // istanbul ignore next
            if (tmp.length !== 1) {
                warningLog(`node ${cacheNode.nodeId.toString()} ${cacheNode.browseName.toString()} has two typeDefinitions}`);
            }
            // istanbul ignore next
            if (cacheNode.typeDefinition) {
                if (cacheNode.typeDefinition.toString() !== tmp[0].nodeId.toString()) {
                    warningLog(`node ${cacheNode.nodeId.toString()} ${cacheNode.browseName.toString()} has wrong typeDefinitions}`);
                }
            }
            cacheNode.typeDefinition = tmp[0].nodeId;
        }

        async.parallel(
            {
                task1_read_browseName: (callback: ErrorCallback) => {
                    if (cacheNode.browseName !== pendingBrowseName) {
                        // browse name already processed
                        return callback();
                    }
                    this._defer_readNode(
                        cacheNode.nodeId,
                        AttributeIds.BrowseName,
                        (err: Error | null, browseName?: QualifiedName) => {
                            cacheNode.browseName = browseName!;
                            callback();
                        }
                    );
                },
                task2_read_displayName: (callback: ErrorCallback) => {
                    if (cacheNode.displayName) {
                        // display name already processed
                        return callback();
                    }
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.DisplayName, (err: Error | null, value?: LocalizedText) => {
                        if (err) {
                            return callback(err);
                        }
                        cacheNode.displayName = value!;
                        callback();
                    });
                },
                task3_read_description: (callback: ErrorCallback) => {
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.Description, (err: Error | null, value?: LocalizedText) => {
                        if (err) {
                            // description may not be defined and this is OK !
                            return callback();
                        }
                        cacheNode.description = coerceLocalizedText(value)!;
                        callback();
                    });
                },
                task4_variable_dataType: (callback: ErrorCallback) => {
                    // only if nodeClass is Variable || VariableType
                    if (cacheNode.nodeClass !== NodeClass.Variable && cacheNode.nodeClass !== NodeClass.VariableType) {
                        return callback();
                    }
                    const cache = cacheNode as CacheNodeWithDataTypeField;
                    // read dataType and DataType if node is a variable
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.DataType, (err: Error | null, dataType?: NodeId) => {
                        if (!(dataType instanceof NodeId)) {
                            return callback();
                        }
                        cache.dataType = dataType;
                        callback();
                    });
                },
                task5_variable_dataValue: (callback: ErrorCallback) => {
                    // only if nodeClass is Variable || VariableType
                    if (cacheNode.nodeClass !== NodeClass.Variable && cacheNode.nodeClass !== NodeClass.VariableType) {
                        return callback();
                    }
                    const cache = cacheNode as CacheNodeVariable | CacheNodeVariableType;
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.Value, (err: Error | null, value?: DataValue) => {
                        if (!err) {
                            assert(value instanceof DataValue);
                            cache.dataValue = value!;
                        }
                        callback();
                    });
                },
                task6a_variable_arrayDimension: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.Variable && cacheNode.nodeClass !== NodeClass.VariableType) {
                        return callback();
                    }
                    const cache = cacheNode as CacheNodeVariable | CacheNodeVariableType;
                    this._defer_readNode(
                        cacheNode.nodeId,
                        AttributeIds.ArrayDimensions,
                        (err: Error | null, value?: number[] | Uint32Array | null) => {
                            if (!err) {
                                const standardArray = convertToStandardArray(value);
                                cache.arrayDimensions = standardArray;
                            } else {
                                cache.arrayDimensions = undefined; // set explicitly
                            }
                            callback();
                        }
                    );
                },
                task6b_variable_valueRank: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.Variable && cacheNode.nodeClass !== NodeClass.VariableType) {
                        return callback();
                    }
                    const cache = cacheNode as CacheNodeVariable | CacheNodeVariableType;
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.ValueRank, (err: Error | null, value?: number) => {
                        if (!err) {
                            cache.valueRank = value!;
                        }
                        callback();
                    });
                },
                task7_variable_minimumSamplingInterval: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.Variable) {
                        return callback();
                    }
                    const cache = cacheNode as CacheNodeVariable;
                    this._defer_readNode(
                        cacheNode.nodeId,
                        AttributeIds.MinimumSamplingInterval,
                        (err: Error | null, value?: number) => {
                            cache.minimumSamplingInterval = value!;
                            callback();
                        }
                    );
                },
                task8_variable_accessLevel: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.Variable) {
                        return callback();
                    }
                    const cache = cacheNode as CacheNodeWithAccessLevelField;
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.AccessLevel, (err: Error | null, value?: number) => {
                        if (err) {
                            return callback(err);
                        }
                        cache.accessLevel = value!;
                        callback();
                    });
                },
                task9_variable_userAccessLevel: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.Variable) {
                        return callback();
                    }
                    const cache = cacheNode as CacheNodeVariable;
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.UserAccessLevel, (err: Error | null, value?: number) => {
                        if (err) {
                            return callback(err);
                        }
                        cache.userAccessLevel = value!;
                        callback();
                    });
                },
                taskA_referenceType_inverseName: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.ReferenceType) {
                        return callback();
                    }
                    const cache = cacheNode as CacheNodeReferenceType;
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.InverseName, (err: Error | null, value?: LocalizedText) => {
                        if (err) {
                            return callback(err);
                        }
                        cache.inverseName = value!;
                        callback();
                    });
                },
                taskB_isAbstract: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.ReferenceType) {
                        return callback();
                    }
                    const cache = cacheNode as CacheNodeWithAbstractField;
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.IsAbstract, (err: Error | null, value?: boolean) => {
                        if (err) {
                            return callback(err);
                        }
                        cache.isAbstract = value!;
                        callback();
                    });
                },
                taskC_dataTypeDefinition: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.DataType) {
                        return callback();
                    }
                    // dataTypeDefinition is new in 1.04
                    const cache = cacheNode as CacheNodeDataType;
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.DataTypeDefinition, (err, value?: DataTypeDefinition) => {
                        if (err) {
                            // may be we are crawling a 1.03 server => DataTypeDefinition was not defined yet
                            return callback();
                        }
                        cache.dataTypeDefinition = value!;
                        callback();
                    });
                }
            },
            () => {
                _objectToBrowse.action(cacheNode);
            }
        );
    }

    private _process_browse_response_task(task: TaskProcessBrowseResponse, callback: EmptyCallback) {
        const objectsToBrowse = task.param.objectsToBrowse;
        const browseResults = task.param.browseResults;
        for (const [objectToBrowse, browseResult] of zip(objectsToBrowse, browseResults)) {
            assert(browseResult instanceof BrowseResult);
            this._process_single_browseResult(objectToBrowse, browseResult);
        }
        setImmediate(callback);
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
NodeCrawlerBase.prototype.crawl = thenify.withCallback(NodeCrawlerBase.prototype.crawl);
