import * as async from "async";
import chalk from "chalk";
import { EventEmitter } from "events";
import * as _ from "underscore";
import * as util from "util";

import { assert } from "node-opcua-assert";
import { BrowseDescriptionLike, ReadValueIdLike, ResponseCallback } from "node-opcua-client/dist";
import { ReferenceTypeIds, VariableIds } from "node-opcua-constants";
import {
    AttributeIds,
    BrowseDirection,
    LocalizedText,
    makeResultMask,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { make_debugLog } from "node-opcua-debug";
import { makeNodeId, NodeId, NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { BrowseDescription, BrowseResult, ReferenceDescription } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { lowerFirstLetter } from "node-opcua-utils";
import { Variant } from "node-opcua-variant";

const debugLog = make_debugLog(__filename);

//                         "ReferenceType | IsForward | BrowseName | NodeClass | DisplayName | TypeDefinition"
const resultMask = makeResultMask("ReferenceType | IsForward | BrowseName | DisplayName | NodeClass | TypeDefinition");

function make_node_attribute_key(nodeId: NodeId, attributeId: AttributeIds): string {
    return nodeId.toString() + "_" + attributeId.toString();
}

//
// some server do not expose the ReferenceType Node in their address space
// ReferenceType are defined by the OPCUA standard and can be prepopulated in the crawler.
// Pre-populating the ReferenceType node in the crawler will also reduce the network traffic.
//
/*=
 *
 * @param arr
 * @param maxNode
 * @private
 * @return {*}
 */
function _fetch_elements(arr: any[], maxNode: number) {
    assert(_.isArray(arr));
    assert(arr.length > 0);
    const highLimit = (maxNode <= 0) ? arr.length : maxNode;
    const tmp = arr.splice(0, highLimit);
    assert(tmp.length > 0);
    return tmp;
}

const pendingBrowseName = new QualifiedName({name: "pending"});

function w(s: string, l: number): string {
    return (s + "                                                                ").substr(0, l);
}

export class CacheNode {

    public nodeId: NodeId;
    public browseName: QualifiedName;
    public references: ReferenceDescription[];
    public nodeClass: NodeClass;
    public typeDefinition: any;
    public displayName: LocalizedText;

    constructor(nodeId: NodeId) {
        /**
         * @property nodeId
         * @type NodeId
         */
        this.nodeId = nodeId;
        /**
         * @property browseName
         * @type     QualifiedName
         */
        this.browseName = pendingBrowseName;
        /**
         * @property references
         * @type ReferenceDescription[]
         */
        this.references = [];

        this.nodeClass = NodeClass.Unspecified;

        this.typeDefinition = "";

        this.displayName = new LocalizedText({});
    }

    public toString(): string {
        let str = w(this.nodeId.toString(), 20);
        str += " " + w(this.browseName.toString(), 30);
        str += " typeDef : " + w((this.typeDefinition ? this.typeDefinition.toString() : ""), 30);
        str += " nodeClass : " + w((this.nodeClass ? this.nodeClass.toString() : ""), 12);
        return str;
    }
}

const referencesNodeId = resolveNodeId("References");
// const hierarchicalReferencesId = resolveNodeId("HierarchicalReferences");
const hasTypeDefinitionNodeId = resolveNodeId("HasTypeDefinition");

function dedup_reference(references: ReferenceDescription[]) {
    const results = [];
    const dedup: any = {};
    for (const reference of  references) {
        const key = reference.referenceTypeId.toString() + reference.nodeId.toString();
        if (dedup[key]) {
            debugLog(" Warning => Duplicated reference found  !!!! please contact the server vendor");
            debugLog(reference.toString());
            continue;
        }
        dedup[key] = reference;
        results.push(reference);
    }
    return results;
}

interface TaskCrawl {
    param: {
        cacheNode: CacheNode;
        userData: UserData;
    };
    func: (task: TaskCrawl, callback: Callback) => void;
}

interface Task2 {
    param: {
        childCacheNode?: any;
        parentNode?: CacheNode;
        reference?: ReferenceDescription;
    };
    func: (task: Task2, callback: Callback) => void;
}

interface TaskProcessBrowseResponse {
    param: {
        objectsToBrowse: TaskBrowseNode[];
        browseResults: BrowseResult[];
    };
    func: (task: TaskProcessBrowseResponse, callback: Callback) => void;
}

interface TaskExtraReference {
    param: {
        childCacheNode: CacheNode,
        parentNode: CacheNode,
        reference: any,
        userData: UserData
    };
    func: (task: TaskExtraReference, callback: Callback) => void;
}

interface TaskReconstruction {
    data: any;
    func: (task: TaskReconstruction, callback: Callback) => void;
}

type Task = TaskCrawl | Task2 | TaskProcessBrowseResponse | TaskExtraReference;

type Callback = () => void;
type ErrorCallback = (err?: Error) => void;

function _setExtraReference(task: TaskExtraReference, callback: ErrorCallback) {

    const param = task.param;
    assert(param.userData.setExtraReference);
    param.userData.setExtraReference!(
        param.parentNode,
        param.reference,
        param.childCacheNode,
        param.userData);
    callback();
}

function remove_cycle(
    object: any,
    innerCallback: (err: Error | null, object?: any) => void
) {

    const visitedNodeIds: any = {};

    function hasBeenVisited(e: any) {
        const key1 = e.nodeId.toString();
        return visitedNodeIds[key1];
    }

    function setVisited(e: any) {
        const key1 = e.nodeId.toString();
        return visitedNodeIds[key1] = e;
    }

    function mark_array(arr: any[]) {
        if (!arr) {
            return;
        }
        assert(_.isArray(arr));

        for (const e of arr) {

            if (hasBeenVisited(e)) {
                return;
            } else {
                setVisited(e);
                explorerObject(e);
            }
        }
    }

    function explorerObject(obj: any) {
        mark_array(obj.organizes);
        mark_array(obj.hasComponent);
        mark_array(obj.hasNotifier);
        mark_array(obj.hasProperty);
    }

    explorerObject(object);
    innerCallback(null, object);
}

interface UserData {
    onBrowse: (crawler: NodeCrawler, cacheNode: CacheNode, userData: UserData) => void;
    setExtraReference?: (parentNode: CacheNode, reference: any, childCacheNode: CacheNode, userData: UserData) => void;

}

interface NodeCrawlerEvents {
    on(event: "browsed", handler: (cacheNode: CacheNode, userData: UserData) => void): void;
}

export interface NodeCrawlerClientSession {
    read(nodesToRead: ReadValueIdLike[], callback: ResponseCallback<DataValue[]>): void;

    browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;

}

interface TaskBrowseNode {
    action: (object: CacheNode) => void;
    cacheNode: CacheNode;
    nodeId: NodeId;
    referenceTypeId: NodeId;
}

type ReadNodeAction =  (value: any) => void;

interface TaskReadNode {
    nodeToRead: {
        attributeId: AttributeIds;
        nodeId: NodeId;
    };
    action: ReadNodeAction;
}

// tslint:disable:max-classes-per-file
/**
 * @class NodeCrawler
 * @param session
 * @constructor
 */
export class NodeCrawler extends EventEmitter implements NodeCrawlerEvents {

    public static follow(crawler: NodeCrawler, cacheNode: CacheNode, userData: UserData) {
        for (const reference of cacheNode.references) {
            crawler.followReference(cacheNode, reference, userData);
        }
    }

    public maxNodesPerRead: number = 0;
    public maxNodesPerBrowse: number = 0;
    public startTime: Date = new Date();
    public readCounter: number = 0;
    public browseCounter: number = 0;
    public transactionCounter: number = 0;
    private readonly session: NodeCrawlerClientSession;
    private readonly browseNameMap: any;
    private readonly taskQueue: async.AsyncQueue<Task>;
    private readonly pendingReadTasks: TaskReadNode[];
    private readonly pendingBrowseTasks: TaskBrowseNode[];
    private readonly _objectCache: any;
    private readonly _objMap: any;
    private _crawled: any;
    private _visitedNode: any;

    constructor(session: NodeCrawlerClientSession) {

        super();

        this.session = session;
        // verify that session object provides the expected methods (browse/read)
        assert(_.isFunction(session.browse));
        assert(_.isFunction(session.read));

        this.browseNameMap = {};
        this._objectCache = {};
        this._objMap = {};

        this._initialize_referenceTypeId();

        this.pendingReadTasks = [];
        this.pendingBrowseTasks = [];

        this.taskQueue = async.queue((task: Task, callback: Callback) => {
            // use process next tick to relax the stack frame
            debugLog(" executing Task ", task.toString());

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
    
    public dispose() {
        assert(this.pendingReadTasks.length === 0);
        assert(this.pendingBrowseTasks.length === 0);
        /*
                this.session = null;
                this.browseNameMap = null;
                this._objectCache = null;
                this._objectToBrowse = null;
                this._objMap = null;
        */
        this.pendingReadTasks.length = 0;
        this.pendingBrowseTasks.length = 0;

    }

    /**
     * @method crawl
     *
     * @param nodeId
     * @param userData
     * @param endCallback
     */
    public crawl(
        nodeId: NodeIdLike,
        userData: UserData,
        endCallback: ErrorCallback
    ) {
        nodeId = resolveNodeId(nodeId) as NodeId;
        assert(_.isFunction(endCallback));
        this._readOperationalLimits((err?: Error) => {
            if (err) {
                return endCallback(err);
            }
            this._inner_crawl(nodeId as NodeId, userData, endCallback);
        });
    }

    /**
     *
     * @param nodeId
     * @param callback
     */
    public read(nodeId: NodeIdLike, callback: (err: Error | null, obj?: any) => void) {

        try {
            nodeId = resolveNodeId(nodeId);
        } catch (err) {
            return callback(err);
        }

        const key = nodeId.toString();

        // check if object has already been crawled
        if (this._objMap.hasOwnProperty(key)) {
            const object = this._objMap[key];
            return callback(null, object);
        }

        const userData: UserData = {
            onBrowse: NodeCrawler.follow
        };

        this.crawl(nodeId, userData, (err) => {

            if (err) {
                return callback(err);
            }

            if (this._objectCache.hasOwnProperty(key)) {

                const cacheNode = this._objectCache[key];
                assert(cacheNode.browseName.name !== "pending");

                this.simplify_object(this._objMap, cacheNode, callback);

            } else {
                callback(new Error("Cannot find nodeId" + key));
            }
        });
    }

    /**
     * @internal
     * @private
     */
    public _inner_crawl(
        nodeId: NodeId,
        userData: UserData,
        endCallback: ErrorCallback
    ) {
        assert(_.isObject(userData));
        assert(_.isFunction(endCallback));
        assert(!this._visitedNode);
        assert(!this._crawled);

        this._visitedNode = {};
        this._crawled = {};

        let hasEnded = false;

        this.taskQueue.drain = () => {

            debugLog("taskQueue is empty !!", this.taskQueue.length());

            if (!hasEnded) {
                hasEnded = true;
                this._visitedNode = null;
                this._crawled = null;
                this.emit("end");
                endCallback();
            }
        };

        let cacheNode = this._getCacheNode(nodeId);
        if (!cacheNode) {
            cacheNode = this._createCacheNode(nodeId);
        }

        assert(cacheNode.nodeId.toString() === nodeId.toString());

        // ----------------------- Read missing essential information about node
        // such as nodeClass, typeDefinition browseName, displayName
        // this sequence is only necessary on the top node being crawled,
        // as browseName,displayName,nodeClass will be provided by ReferenceDescription later on for child nodes
        //
        async.parallel({

            task1: (callback: ErrorCallback) => {
                this._defer_readNode(
                    cacheNode.nodeId,
                    AttributeIds.BrowseName,

                    (err: Error | null, value?: any) => {
                        if (err) {
                            return callback(err);
                        }
                        assert(value instanceof QualifiedName);
                        cacheNode.browseName = value;
                        setImmediate(callback);
                    });
            },

            task2: (callback: ErrorCallback) => {
                this._defer_readNode(
                    cacheNode.nodeId,
                    AttributeIds.NodeClass,

                    (err: Error | null, value?: any) => {
                        if (err) {
                            return callback(err);
                        }
                        cacheNode.nodeClass = value;
                        setImmediate(callback);
                    });
            },

            task3: (callback: ErrorCallback) => {
                this._defer_readNode(
                    cacheNode.nodeId,
                    AttributeIds.DisplayName,

                    (err: Error | null, value?: any) => {
                        if (err) {
                            return callback(err);
                        }
                        assert(value instanceof LocalizedText);
                        cacheNode.displayName = value;
                        setImmediate(callback);
                    });
            },

            task4: (callback: ErrorCallback) => {
                this._resolve_deferred_readNode(callback);
            }

        }, (results: any) => {
            this._add_crawl_task(cacheNode, userData);
        });
    }

    public _add_crawl_task(cacheNode: CacheNode, userData: any) {

        assert(userData);
        assert(_.isObject(this));
        assert(_.isObject(this._crawled));

        const key = cacheNode.nodeId.toString();
        if (this._crawled.hasOwnProperty(key)) {
            return;
        }
        this._crawled[key] = 1;

        const task: TaskCrawl = {
            func: NodeCrawler.prototype._crawl_task,
            param: {
                cacheNode,
                userData
            },
        };
        this._push_task("_crawl task", task);

    }

    public followReference(
        parentNode: CacheNode,
        reference: ReferenceDescription,
        userData: any
    ) {

        assert(reference instanceof ReferenceDescription);

        const crawler = this;

        let childCacheNodeRef = crawler._getCacheNode(reference.referenceTypeId);
        if (!childCacheNodeRef) {
            childCacheNodeRef = crawler._createCacheNode(reference.referenceTypeId);
            crawler._add_crawl_task(childCacheNodeRef, userData);
        }

        let childCacheNode = crawler._getCacheNode(reference.nodeId);
        if (!childCacheNode) {
            childCacheNode = crawler._createCacheNode(reference.nodeId);
            childCacheNode.browseName = reference.browseName;
            childCacheNode.displayName = reference.displayName;
            childCacheNode.typeDefinition = reference.typeDefinition;
            childCacheNode.nodeClass = reference.nodeClass as NodeClass;
            crawler._add_crawl_task(childCacheNode, userData);
        } else {

            if (userData.setExtraReference) {

                const task: TaskExtraReference = {
                    func: _setExtraReference,
                    param: {
                        childCacheNode,
                        parentNode,
                        reference,
                        userData
                    },
                };
                crawler._push_task("setExtraRef", task);
            }
        }
    }

    private simplify_object(
        objMap: any,
        object: any,
        finalCallback: (err: Error | null, obj?: any) => void
    ) {

        assert(_.isFunction(finalCallback));

        const queue = async.queue(
            (task: TaskReconstruction, innerCallback: Callback) => {
                setImmediate(() => {
                    assert(_.isFunction(task.func));
                    task.func(task.data, innerCallback);
                });
            }, 1);

        // tslint:disable:no-empty
        this._add_for_reconstruction(queue, objMap, object, () => {
        });

        const key1 = object.nodeId.toString();
        queue.drain = () => {
            const object1: any = this._objMap[key1];
            remove_cycle(object1, finalCallback);
        };
    }

    private _add_for_reconstruction(
        queue: any,
        objMap: any,
        object: any,
        extraFunc: (err: Error | null, obj?: any) => void
    ) {
        assert(_.isFunction(extraFunc));
        assert(typeof object.nodeId.toString() === "string");

        const task: TaskReconstruction = {
            data: object,
            func: (data, callback: ErrorCallback) => {
                this._reconstruct_manageable_object(queue, objMap, data, (err: Error | null, obj?: any) => {
                    extraFunc(err, obj);
                    callback(err || undefined);
                });
            }
        };
        queue.push(task);
    }

    private _reconstruct_manageable_object(
        queue: any,
        objMap: any,
        object: any,
        callback: (err: Error | null, obj?: any
        ) => void) {

        assert(_.isFunction(callback));
        assert(object);
        assert(object.nodeId);

        const key2 = object.nodeId.toString();
        if (objMap.hasOwnProperty(key2)) {
            return callback(null, objMap[key2]);
        }
        /* reconstruct a more manageable object
         * var obj = {
         *    browseName: "Objects",
         *    organises : [
         *       {
         *            browseName: "Server",
         *            hasComponent: [
         *            ]
         *            hasProperty: [
         *            ]
         *       }
         *    ]
         * }
         */
        const obj: any = {
            browseName: object.browseName.name,
            nodeId: object.nodeId.toString()
        };

        // Append nodeClass
        if (object.nodeClass) {
            obj.nodeClass = object.nodeClass.toString();
        }
        if (object.dataType) {
            obj.dataType = object.dataType.toString();
            obj.dataTypeName = object.dataTypeName;
        }
        if (object.dataValue) {
            if (object.dataValue instanceof Array || object.dataValue.length > 10) {
                // too much verbosity here
            } else {
                obj.dataValue = object.dataValue.toString();
            }
        }
        objMap[key2] = obj;

        const referenceMap = obj;

        object.references = object.references || [];

        object.references.map((ref: ReferenceDescription) => {

            assert(ref);
            const refIndex = ref.referenceTypeId.toString();

            const referenceType = this._objectCache[refIndex];

            if (!referenceType) {
                debugLog(chalk.red("Unknown reference type " + refIndex));
                debugLog(util.inspect(object, {colors: true, depth: 10}));
            }
            const reference = this._objectCache[ref.nodeId.toString()];
            if (!reference) {
                debugLog(ref.nodeId.toString(),
                    "bn=", ref.browseName.toString(),
                    "class =", ref.nodeClass.toString(),
                    ref.typeDefinition.toString());
                debugLog("#_reconstruct_manageable_object: Cannot find reference",
                    ref.nodeId.toString(), "in cache");
            }
            // Extract nodeClass so it can be appended
            reference.nodeClass = (ref as any).$nodeClass;

            const refName = lowerFirstLetter(referenceType.browseName.name);

            if (refName === "hasTypeDefinition") {
                obj.typeDefinition = reference.browseName.name;
            } else {
                if (!referenceMap[refName]) {
                    referenceMap[refName] = [];
                }
                this._add_for_reconstruction(queue, objMap, reference, (err: Error | null, mobject: any) => {
                    if (!err) {
                        referenceMap[refName].push(mobject);
                    }
                });
            }
        });
        callback(null, obj);

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

        debugLog("_resolve_deferred_readNode = ", this.pendingReadTasks.length);

        const selectedPendingReadTasks = _fetch_elements(this.pendingReadTasks, this.maxNodesPerRead);

        const nodesToRead = selectedPendingReadTasks.map((e) => e.nodeToRead);

        this.readCounter += nodesToRead.length;
        this.transactionCounter++;

        this.session.read(nodesToRead, (err: Error | null, dataValues?: DataValue[]) => {

            if (err) {
                return callback(err || undefined);
            }
            for (const pair of _.zip(selectedPendingReadTasks, dataValues)) {
                const readTask: TaskReadNode = pair[0];
                const dataValue: DataValue = pair[1];
                assert(dataValue.hasOwnProperty("statusCode"));
                if (dataValue.statusCode.equals(StatusCodes.Good)) {
                    if (dataValue.value === null) {
                        readTask.action(null);
                    } else {
                        readTask.action(dataValue.value.value);
                    }
                } else {
                    readTask.action({name: dataValue.statusCode.toString()});
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

        debugLog("_resolve_deferred_browseNode = ", this.pendingBrowseTasks.length);

        const objectsToBrowse = _fetch_elements(this.pendingBrowseTasks, this.maxNodesPerBrowse);

        const nodesToBrowse = objectsToBrowse.map((e: any) => {

            assert(e.hasOwnProperty("referenceTypeId"));

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

        this.session.browse(nodesToBrowse, (err: Error | null, browseResults?: BrowseResult[]) => {

            if (err) {
                debugLog("session.browse err:", err);
                return callback(err || undefined);
            }

            assert(browseResults!.length === nodesToBrowse.length);

            browseResults = browseResults || [];

            const task: TaskProcessBrowseResponse = {
                func: NodeCrawler.prototype._process_browse_response_task,
                param: {
                    browseResults,
                    objectsToBrowse,
                },
            };
            this._unshift_task("process browseResults", task);
            callback();
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
        assert(_.isFunction(task.func));
        assert(task.func.length === 2);
        this.taskQueue.unshift(task);
        debugLog("unshift task", name);

    }

    /**
     * @method _push_task
     * add a task at the bottom of the queue (low priority)
     * @param name {string}
     * @param task
     * @private
     */
    private _push_task(name: string, task: Task) {
        assert(_.isFunction(task.func));
        assert(task.func.length === 2);
        debugLog("pushing task", name);
        this.taskQueue.push(task);
    }

    /***
     * @method _emit_on_crawled
     * @param cacheNode
     * @param userData
     * @private
     */
    private _emit_on_crawled(cacheNode: CacheNode, userData: UserData) {
        const self = this;
        self.emit("browsed", cacheNode, userData);
    }

    private _crawl_task(task: TaskCrawl, callback: Callback) {

        const cacheNode = task.param.cacheNode;
        const nodeId = task.param.cacheNode.nodeId;
        const key = nodeId.toString();

        if (this._visitedNode.hasOwnProperty(key)) {
            debugLog("skipping already visited", key);
            callback();
            return; // already visited
        }
        // mark as visited to avoid infinite recursion
        this._visitedNode[key] = true;

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

        this._defer_browse_node(
            cacheNode,
            referencesNodeId,
            browseNodeAction
        );
        callback();
    }

    private _initialize_referenceTypeId() {

        const appendPrepopulatedReference = (browseName: string) => {
            const nodeId = makeNodeId((ReferenceTypeIds as any)[browseName], 0);
            assert(nodeId);
            const cacheNode = this._createCacheNode(nodeId);
            cacheNode.browseName = new QualifiedName({name: browseName});
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
        appendPrepopulatedReference("HasTypeDefinition");
        appendPrepopulatedReference("HasChild");
        appendPrepopulatedReference("HasProperty");
        appendPrepopulatedReference("HasComponent");
        appendPrepopulatedReference("HasHistoricalConfiguration");
        appendPrepopulatedReference("HasSubtype");
        appendPrepopulatedReference("Organizes");
        appendPrepopulatedReference("HasEventSource");

    }

    private _readOperationalLimits(callback: ErrorCallback) {

        const n1 = makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerRead);
        const n2 = makeNodeId(VariableIds.Server_ServerCapabilities_OperationLimits_MaxNodesPerBrowse);
        const nodesToRead = [
            {nodeId: n1, attributeId: AttributeIds.Value},
            {nodeId: n2, attributeId: AttributeIds.Value}
        ];
        this.transactionCounter++;
        this.session.read(nodesToRead, (err: Error | null, dataValues?: DataValue[]): void => {
            if (err) {
                return callback(err);
            }
            dataValues = dataValues!;

            if (dataValues[0].statusCode.equals(StatusCodes.Good)) {
                this.maxNodesPerRead = dataValues[0].value.value;
            }
            // ensure we have a sensible maxNodesPerRead value in case the server doesn't specify one
            this.maxNodesPerRead = this.maxNodesPerRead || 500;

            if (dataValues[1].statusCode.equals(StatusCodes.Good)) {
                this.maxNodesPerBrowse = dataValues[1].value.value;
            }
            // ensure we have a sensible maxNodesPerBrowse value in case the server doesn't specify one
            this.maxNodesPerBrowse = this.maxNodesPerBrowse || 500;

            callback();
        });
    }

    private set_cache_NodeAttribute(nodeId: NodeId, attributeId: AttributeIds, value: any) {
        const key = make_node_attribute_key(nodeId, attributeId);
        this.browseNameMap[key] = value;
    }

    private has_cache_NodeAttribute(nodeId: NodeId, attributeId: AttributeIds) {
        const key = make_node_attribute_key(nodeId, attributeId);
        return this.browseNameMap.hasOwnProperty(key);
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
        attributeId: AttributeIds,
        callback: (err: Error | null, dataValue?: DataValue) => void
    ) {

        nodeId = resolveNodeId(nodeId);
        const key = make_node_attribute_key(nodeId, attributeId);
        if (this.has_cache_NodeAttribute(nodeId, attributeId)) {
            callback(null, this.get_cache_NodeAttribute(nodeId, attributeId));
        } else {
            this.browseNameMap[key] = "?";
            this.pendingReadTasks.push({
                action: (dataValue: DataValue) => {
                    this.set_cache_NodeAttribute(nodeId, attributeId, dataValue);
                    callback(null, dataValue);
                },
                nodeToRead: {
                    attributeId,
                    nodeId,
                },

            });
        }
    }

    private _resolve_deferred(
        comment: string,
        collection: any[],
        method: (a: any, callback: Callback) => void
    ) {

        debugLog("_resolve_deferred ", comment, collection.length);

        if (collection.length > 0) {
            this._push_task("adding operation " + comment, {
                func: (task: Task, callback: Callback) => {
                    method.call(this, callback);
                },
                param: {},
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

    private _createCacheNode(nodeId: NodeId) {
        const key = resolveNodeId(nodeId).toString();
        let cacheNode = this._objectCache[key];
        if (cacheNode) {
            throw new Error("NodeCrawler#_createCacheNode :" +
                " cache node should not exist already : " + nodeId.toString());
        }
        cacheNode = new CacheNode(nodeId);
        assert(!this._objectCache.hasOwnProperty(key));
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
            action: (object: CacheNode) => {
                assert(object === cacheNode);
                assert(_.isArray(object.references));
                assert(cacheNode.browseName.name !== "pending");
                actionOnBrowse(null, cacheNode);
            },
            cacheNode,
            nodeId: cacheNode.nodeId,
            referenceTypeId,

        });
    }

    /**
     * @method _process_single_browseResult
     * @param _objectToBrowse
     * @param browseResult {BrowseResult}
     * @private
     */
    private _process_single_browseResult(
        _objectToBrowse: any,
        browseResult: BrowseResult
    ) {

        assert(browseResult.continuationPoint === null, "NodeCrawler doesn't support continuation point yet");

        const cacheNode = _objectToBrowse.cacheNode;

        // note : some OPCUA may expose duplicated reference, they need to be filtered out
        // dedup reference

        cacheNode.references = dedup_reference(browseResult.references!);

        const tmp = browseResult.references!.filter((x) => sameNodeId(x.referenceTypeId, hasTypeDefinitionNodeId));

        if (tmp.length) {
            cacheNode.typeDefinition = tmp[0].nodeId;
        }

        async.parallel({

                task1: (callback: ErrorCallback) => {
                    if (cacheNode.browseName !== pendingBrowseName) {
                        return callback();
                    }
                    this._defer_readNode(
                        cacheNode.nodeId,
                        AttributeIds.BrowseName,
                        (err?: Error | null, browseName?: any) => {
                            cacheNode.browseName = browseName;
                            callback();
                        });
                },

                task2: (callback: ErrorCallback) => {
                    if (cacheNode.displayName) {
                        return callback();
                    }
                    this._defer_readNode(
                        cacheNode.nodeId,
                        AttributeIds.DisplayName,
                        (err?: Error | null, value?: any) => {
                            if (err) {
                                return callback(err);
                            }
                            if (!(value instanceof LocalizedText)) {
                                debugLog(cacheNode.toString());
                            }
                            assert(value instanceof LocalizedText);
                            cacheNode.displayName = value;
                            setImmediate(callback);
                        });
                },

                task3: (callback: ErrorCallback) => {
                    // only if nodeClass is Variable
                    if (cacheNode.nodeClass !== NodeClass.Variable) {
                        return callback();
                    }
                    // read dataType and DataType if node is a variable
                    this._defer_readNode(
                        cacheNode.nodeId,
                        AttributeIds.DataType,
                        (err: Error | null, dataType?: any) => {

                            if (!(dataType instanceof NodeId)) {
                                return callback();
                            }
                            cacheNode.dataType = dataType;
                            callback();
                        });
                },

                task4: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.Variable) {
                        return callback();
                    }
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.Value, (err, value) => {
                        cacheNode.dataValue = value;
                        callback();
                    });
                },

                task5: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.Variable) {
                        return callback();
                    }
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.MinimumSamplingInterval, (err, value) => {
                        cacheNode.minimumSamplingInterval = value;
                        callback();
                    });
                },

                task6: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.Variable) {
                        return callback();
                    }
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.AccessLevel, (err, value) => {
                        cacheNode.accessLevel = value;
                        callback();
                    });
                },

                task7: (callback: ErrorCallback) => {
                    if (cacheNode.nodeClass !== NodeClass.Variable) {
                        return callback();
                    }
                    this._defer_readNode(cacheNode.nodeId, AttributeIds.UserAccessLevel, (err, value) => {
                        cacheNode.userAccessLevel = value;
                        callback();
                    });
                }

            }, () => {
                _objectToBrowse.action(cacheNode);
            }
        );
    }

    private _process_browse_response_task(
        task: TaskProcessBrowseResponse,
        callback: Callback
    ) {

        const objectsToBrowse = task.param.objectsToBrowse;
        const browseResults = task.param.browseResults;
        for (const pair of _.zip(objectsToBrowse, browseResults)) {
            const objectToBrowse = pair[0];
            const browseResult = pair[1];
            assert(browseResult instanceof BrowseResult);
            this._process_single_browseResult(objectToBrowse, browseResult);
        }
        setImmediate(callback);
    }
}
