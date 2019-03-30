/**
 * @module node-opcua-client-crawler
 */
import * as async from "async";
import chalk from "chalk";
import { EventEmitter } from "events";
import * as _ from "underscore";

import { UAReferenceType } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { BrowseDescriptionLike, ReadValueIdOptions, ResponseCallback } from "node-opcua-client";
import { ReferenceTypeIds, VariableIds } from "node-opcua-constants";
import {
    AccessLevelFlag,
    AttributeIds,
    BrowseDirection,
    coerceLocalizedText,
    LocalizedText,
    makeResultMask,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { coerceNodeId, makeNodeId, NodeId, NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { BrowseDescription, BrowseResult, ReferenceDescription } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { lowerFirstLetter } from "node-opcua-utils";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
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
function _fetch_elements<T>(arr: T[], maxNode: number): T[] {
    assert(_.isArray(arr));
    assert(arr.length > 0);
    const highLimit = (maxNode <= 0) ? arr.length : maxNode;
    const tmp = arr.splice(0, highLimit);
    assert(tmp.length > 0);
    return tmp;
}

const pendingBrowseName = new QualifiedName({ name: "pending" });

function w(s: string, l: number): string {
    return (s + "                                                                ").substr(0, l);
}

export class CacheNode {

    // the reference that links this node to its parent
    public referenceToParent?: ReferenceDescription;
    public parent?: CacheNode;

    public nodeId: NodeId;
    public browseName: QualifiedName;
    public references: ReferenceDescription[];
    public nodeClass: NodeClass;
    public typeDefinition: any;
    public displayName: LocalizedText;
    public description: LocalizedText = coerceLocalizedText("")!;

    constructor(nodeId: NodeId) {
        /**
         */
        this.nodeId = nodeId;
        /**
         */
        this.browseName = pendingBrowseName;
        /**
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

export interface CacheNodeDataType extends CacheNode {
    nodeClass: NodeClass.DataType;
    dataTypeDefinition: NodeId;
}

export interface CacheNodeVariable extends CacheNode {
    nodeClass: NodeClass.Variable;
    dataType: NodeId;
    dataValue: DataValue;
    minimumSamplingInterval: number;
    accessLevel: AccessLevelFlag;
    userAccessLevel: AccessLevelFlag;
    arrayDimensions?: number[];
    valueRank: any;
}

export interface CacheNodeVariableType extends CacheNode {
    nodeClass: NodeClass.VariableType;
    isAbstract: boolean;

    dataType: NodeId;
    dataValue: DataValue;
    accessLevel: AccessLevelFlag;
    arrayDimensions?: number[];

    valueRank: any;
}

export interface CacheNodeObjectType extends CacheNode {
    nodeClass: NodeClass.ObjectType;
    isAbstract: boolean;

    accessLevel: AccessLevelFlag;
    arrayDimensions?: number[];
    valueRank: any;
    eventNotifier: number;
}

export interface CacheNodeReferenceType extends CacheNode {
    nodeClass: NodeClass.ReferenceType;
    isAbstract: boolean;
    inverseName: LocalizedText;
}

type CacheNodeWithAbstractField = CacheNodeReferenceType |
  CacheNodeVariableType |
  CacheNodeObjectType;
type CacheNodeWithDataTypeField = CacheNodeVariable | CacheNodeVariableType;
type CacheNodeWithAccessLevelField = CacheNodeVariable;

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

interface TaskBase {
    name?: string;
}

interface TaskCrawl extends TaskBase {
    param: {
        cacheNode: CacheNode;
        userData: UserData;
    };
    func: (task: TaskCrawl, callback: Callback) => void;
}

interface Task2 extends TaskBase {
    param: {
        childCacheNode?: any;
        parentNode?: CacheNode;
        reference?: ReferenceDescription;
    };
    func: (task: Task2, callback: Callback) => void;
}

interface TaskProcessBrowseResponse extends TaskBase {
    param: {
        objectsToBrowse: TaskBrowseNode[];
        browseResults: BrowseResult[];
    };
    func: (task: TaskProcessBrowseResponse, callback: Callback) => void;
}

interface TaskExtraReference extends TaskBase {
    param: {
        childCacheNode: CacheNode,
        parentNode: CacheNode,
        reference: any,
        userData: UserData
    };
    func: (task: TaskExtraReference, callback: Callback) => void;
}

interface TaskReconstruction extends TaskBase {
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

export interface UserData {
    onBrowse: (crawler: NodeCrawler, cacheNode: CacheNode, userData: UserData) => void;
    setExtraReference?: (parentNode: CacheNode, reference: any, childCacheNode: CacheNode, userData: UserData) => void;
}

interface NodeCrawlerEvents {
    on(event: "browsed", handler: (cacheNode: CacheNode, userData: UserData) => void): void;
}

export interface NodeCrawlerClientSession {
    read(nodesToRead: ReadValueIdOptions[], callback: ResponseCallback<DataValue[]>): void;

    browse(nodesToBrowse: BrowseDescriptionLike[], callback: ResponseCallback<BrowseResult[]>): void;

    browseNext(continuationPoints: Buffer[], releaseContinuationPoints: boolean, callback: ResponseCallback<BrowseResult[]>): void;
}

interface TaskBrowseNode {
    action: (object: CacheNode) => void;
    cacheNode: CacheNode;
    nodeId: NodeId;
    referenceTypeId: NodeId;
}

interface TaskBrowseNext extends TaskBrowseNode {
    continuationPoint: Buffer;
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
    if (referenceType.toString() === "i=45" || referenceType === "HasSubtype") {
        return NodeId.resolveNodeId("i=45");
    }
    return NodeId.nullNodeId;
}

// tslint:disable:max-classes-per-file
/**
 * @class NodeCrawler
 * @param session
 * @constructor
 */
export class NodeCrawler extends EventEmitter implements NodeCrawlerEvents {

    public static follow(
      crawler: NodeCrawler,
      cacheNode: CacheNode,
      userData: UserData,
      referenceType?: string | UAReferenceType
    ) {
        const referenceTypeNodeId = getReferenceTypeId(referenceType);

        for (const reference of cacheNode.references) {
            if (!referenceTypeNodeId) {
                crawler.followReference(cacheNode, reference, userData);
            } else {
                if (NodeId.sameNodeId(referenceTypeNodeId, reference.referenceTypeId)) {
                    crawler.followReference(cacheNode, reference, userData);
                }
            }
        }
    }

    public maxNodesPerRead: number = 0;
    public maxNodesPerBrowse: number = 0;
    public startTime: Date = new Date();
    public readCounter: number = 0;
    public browseCounter: number = 0;
    public browseNextCounter: number = 0;
    public transactionCounter: number = 0;
    private readonly session: NodeCrawlerClientSession;
    private readonly browseNameMap: any;
    private readonly taskQueue: async.AsyncQueue<Task>;
    private readonly pendingReadTasks: TaskReadNode[];
    private readonly pendingBrowseTasks: TaskBrowseNode[];
    private readonly pendingBrowseNextTasks: TaskBrowseNext[];

    private readonly _objectCache: any;
    private readonly _objMap: any;
    private _crawled: any;
    private _visitedNode: any;
    private _prePopulatedSet = new WeakSet();

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
        this.pendingBrowseNextTasks = [];

        this.taskQueue = async.queue((task: Task, callback: Callback) => {
            // use process next tick to relax the stack frame
            if (doDebug) {
                debugLog(" executing Task ", task.name); // JSON.stringify(task, null, " "));
            }

            setImmediate(() => {
                (task.func as any).call(this, task, () => {
                    this.resolve_deferred_browseNext();
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

    public toString(): string {
        return "" + `reads:       ${this.readCounter}\n` +
          `browses:     ${this.browseCounter}  \n` +
          `transaction: ${this.transactionCounter}  \n`;
    }

    public crawl(nodeId: NodeIdLike, userData: UserData): Promise<void>;
    public crawl(nodeId: NodeIdLike, userData: UserData, endCallback: ErrorCallback): void;
    public crawl(nodeId: NodeIdLike, userData: UserData, ...args: any[]): any {

        const endCallback = args[0] as ErrorCallback;
        assert(endCallback instanceof Function, "expecting callback");
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
     */
    public read(nodeId: NodeIdLike): Promise<any>;
    public read(nodeId: NodeIdLike, callback: (err: Error | null, obj?: any) => void): void;
    public read(nodeId: NodeIdLike, callback?: (err: Error | null, obj?: any) => void): any {

        if (!callback) {
            throw new Error("Invalid Error");
        }

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

        }, (err?: Error | null, data?: any) => {
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
            }
        };
        this._push_task("_crawl task", task);

    }

    public followReference(
      parentNode: CacheNode,
      reference: ReferenceDescription,
      userData: UserData
    ) {

        assert(reference instanceof ReferenceDescription);

        const crawler = this;

        let referenceTypeIdCacheNode = crawler._getCacheNode(reference.referenceTypeId);
        if (this._prePopulatedSet.has(referenceTypeIdCacheNode)) {
            this._prePopulatedSet.delete(referenceTypeIdCacheNode);
            this._add_crawl_task(referenceTypeIdCacheNode, userData);
        }
        if (!referenceTypeIdCacheNode) {
            referenceTypeIdCacheNode = crawler._createCacheNode(reference.referenceTypeId);
            this._add_crawl_task(referenceTypeIdCacheNode, userData);
        }

        let childCacheNode = crawler._getCacheNode(reference.nodeId);
        if (!childCacheNode) {
            childCacheNode = crawler._createCacheNode(reference.nodeId, parentNode, reference);
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
            // xx obj.dataTypeName = object.dataTypeName;
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
                // debugLog(util.inspect(object, { colors: true, depth: 10 }));
                // console.log(chalk.red("Unknown reference type " + refIndex));
                // console.log(util.inspect(ref, { colors: true, depth: 10 }));
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

            if (reference) {
                // Extract nodeClass so it can be appended
                reference.nodeClass = (ref as any).$nodeClass;
            }
            if (referenceType) {

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

        const selectedPendingReadTasks: TaskReadNode[] = _fetch_elements(this.pendingReadTasks, this.maxNodesPerRead);

        const nodesToRead = selectedPendingReadTasks.map((e: TaskReadNode) => e.nodeToRead);

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

        debugLog("_resolve_deferred_browseNode = ", this.pendingBrowseTasks.length);

        const objectsToBrowse: TaskBrowseNode[] = _fetch_elements(this.pendingBrowseTasks, this.maxNodesPerBrowse);

        const nodesToBrowse = objectsToBrowse.map((e: TaskBrowseNode) => {

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
                    objectsToBrowse
                }
            };
            this._unshift_task("process browseResults", task);
            callback();
        });
    }

    private _resolve_deferred_browseNext(callback: ErrorCallback): void {

        if (this.pendingBrowseNextTasks.length === 0) {
            callback();
            return;
        }

        debugLog("_resolve_deferred_browseNext = ", this.pendingBrowseNextTasks.length);

        const objectsToBrowse: TaskBrowseNext[] = _fetch_elements(this.pendingBrowseNextTasks, this.maxNodesPerBrowse);

        const continuationPoints = objectsToBrowse.map((e: TaskBrowseNext) => {
            return e.continuationPoint;
        });

        this.browseNextCounter += continuationPoints.length;
        this.transactionCounter++;

        this.session.browseNext(
          continuationPoints,
          false,
          (err: Error | null, browseResults?: BrowseResult[]) => {

              if (err) {
                  debugLog("session.browse err:", err);
                  return callback(err || undefined);
              }

              assert(browseResults!.length === continuationPoints.length);

              browseResults = browseResults || [];

              const task: TaskProcessBrowseResponse = {
                  func: NodeCrawler.prototype._process_browse_response_task,
                  param: {
                      browseResults,
                      objectsToBrowse
                  }
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
     * @param name
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
        if (false) {
            appendPrepopulatedReference("HasTypeDefinition");
            appendPrepopulatedReference("HasChild");
            appendPrepopulatedReference("HasProperty");
            appendPrepopulatedReference("HasComponent");
            appendPrepopulatedReference("HasHistoricalConfiguration");
            appendPrepopulatedReference("Organizes");
            appendPrepopulatedReference("HasEventSource");
            appendPrepopulatedReference("HasModellingRule");
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
      attributeId: AttributeIds.Value,
      callback: (err: Error | null, value?: DataValue) => void
    ): void;
    private _defer_readNode(
      nodeId: NodeId,
      attributeId:
        AttributeIds.DisplayName |
        AttributeIds.Description |
        AttributeIds.InverseName,
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
      attributeId:
        AttributeIds.AccessLevel |
        AttributeIds.UserAccessLevel |
        AttributeIds.MinimumSamplingInterval |
        AttributeIds.NodeClass,
      callback: (err: Error | null, value?: number) => void
    ): void;

    private _defer_readNode(
      nodeId: NodeId,
      attributeId: AttributeIds,
      callback: (err: Error | null, value?: any) => void
    ): void {

        nodeId = resolveNodeId(nodeId);
        const key = make_node_attribute_key(nodeId, attributeId);
        if (this.has_cache_NodeAttribute(nodeId, attributeId)) {
            callback(null, this.get_cache_NodeAttribute(nodeId, attributeId));
        } else {
            this.browseNameMap[key] = "?";
            this.pendingReadTasks.push({
                action: (value: any, dataValue: DataValue) => {
                    if (dataValue.statusCode === StatusCodes.Good) {
                        // xx  console.log("xxxx set_cache_NodeAttribute", nodeId, attributeId, value);
                        this.set_cache_NodeAttribute(nodeId, attributeId, value);
                        callback(null, value);
                    } else {
                        // xx  console.log("xxxx ERROR", dataValue.toString(), nodeId.toString());
                        callback(new Error(
                          "Error "  + dataValue.statusCode.toString() + " while reading " + nodeId.toString() + " attributeIds " + AttributeIds[attributeId]));
                    }
                },
                nodeToRead: {
                    attributeId,
                    nodeId
                }

            });
        }
    }

    private _resolve_deferred(
      comment: string,
      collection: any[],
      method: (callback: Callback) => void
    ) {

        debugLog("_resolve_deferred ", comment, collection.length);

        if (collection.length > 0) {
            this._push_task("adding operation " + comment, {
                func: (task: Task, callback: Callback) => {
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

    private resolve_deferred_browseNext() {
        this._resolve_deferred("browse_next", this.pendingBrowseNextTasks, this._resolve_deferred_browseNext);
    }

// ---------------------------------------------------------------------------------------

    private _getCacheNode(nodeId: NodeIdLike): CacheNode {
        const key = resolveNodeId(nodeId).toString();
        return this._objectCache[key];
    }

    private _createCacheNode(
      nodeId: NodeId,
      parentNode?: CacheNode,
      referenceToParent?: ReferenceDescription
    ): CacheNode {
        const key = resolveNodeId(nodeId).toString();
        let cacheNode: CacheNode = this._objectCache[key];
        if (cacheNode) {
            throw new Error("NodeCrawler#_createCacheNode :" +
              " cache node should not exist already : " + nodeId.toString());
        }
        cacheNode = new CacheNode(nodeId) as CacheNode;
        cacheNode.parent = parentNode;
        cacheNode.referenceToParent = referenceToParent;

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
            referenceTypeId

        });
    }

    private _defer_browse_next(
      cacheNode: CacheNode,
      continuationPoint: Buffer,
      referenceTypeId: NodeId,
      actionOnBrowse: (err: Error | null, cacheNode?: CacheNode) => void
    ) {

        this.pendingBrowseNextTasks.push({
            action: (object: CacheNode) => {
                assert(object === cacheNode);
                assert(_.isArray(object.references));
                assert(cacheNode.browseName.name !== "pending");
                actionOnBrowse(null, cacheNode);
            },
            cacheNode,
            continuationPoint,
            nodeId: cacheNode.nodeId,
            referenceTypeId
        });
    }

    /**
     * @method _process_single_browseResult
     * @param _objectToBrowse
     * @param browseResult
     * @private
     */
    private _process_single_browseResult(
      _objectToBrowse: TaskBrowseNode,
      browseResult: BrowseResult
    ) {

        if (browseResult.continuationPoint) {
            //
            this._defer_browse_next(
              _objectToBrowse.cacheNode,
              browseResult.continuationPoint,
              _objectToBrowse.referenceTypeId,
              (err: Error | null, cacheNode1?: CacheNode) => {
                  _objectToBrowse.action(cacheNode1!);
              }
            );
        }

//        assert(browseResult.continuationPoint === null,
//          "NodeCrawler doesn't support continuation point yet");

        const cacheNode = _objectToBrowse.cacheNode as CacheNode;

        // note : some OPCUA may expose duplicated reference, they need to be filtered out
        // dedup reference

        cacheNode.references = dedup_reference(browseResult.references!);

        const tmp = browseResult.references!.filter((x) => sameNodeId(x.referenceTypeId, hasTypeDefinitionNodeId));

        if (tmp.length) {
            cacheNode.typeDefinition = tmp[0].nodeId;
        }

        async.parallel({

              task1_read_browseName: (callback: ErrorCallback) => {
                  if (cacheNode.browseName !== pendingBrowseName) {
                      return callback();
                  }
                  this._defer_readNode(
                    cacheNode.nodeId,
                    AttributeIds.BrowseName,
                    (err: Error | null, browseName?: QualifiedName) => {
                        cacheNode.browseName = browseName!;
                        callback();
                    });
              },
              task2_read_displayName: (callback: ErrorCallback) => {
                  if (cacheNode.displayName) {
                      return callback();
                  }
                  this._defer_readNode(
                    cacheNode.nodeId,
                    AttributeIds.DisplayName,
                    (err: Error | null, value?: LocalizedText) => {
                        if (err) {
                            return callback(err);
                        }
                        cacheNode.displayName = value!;
                        callback();
                    });
              },
              task3_read_description: (callback: ErrorCallback) => {
                  this._defer_readNode(
                    cacheNode.nodeId,
                    AttributeIds.Description,
                    (err: Error | null, value?: LocalizedText) => {
                        if (err) {
                            return callback(err);
                        }
                        cacheNode.description = coerceLocalizedText(value)!;
                        callback();
                    });
              },
              task4_variable_dataType: (callback: ErrorCallback) => {
                  // only if nodeClass is Variable || VariableType
                  if (cacheNode.nodeClass !== NodeClass.Variable
                    && cacheNode.nodeClass !== NodeClass.VariableType
                  ) {
                      return callback();
                  }
                  const cache = cacheNode as CacheNodeWithDataTypeField;
                  // read dataType and DataType if node is a variable
                  this._defer_readNode(
                    cacheNode.nodeId,
                    AttributeIds.DataType,
                    (err: Error | null, dataType?: any) => {

                        if (!(dataType instanceof NodeId)) {
                            return callback();
                        }
                        cache.dataType = dataType;
                        callback();
                    });
              },
              task5_variable_dataValue: (callback: ErrorCallback) => {
                  // only if nodeClass is Variable || VariableType
                  if (cacheNode.nodeClass !== NodeClass.Variable
                    && cacheNode.nodeClass !== NodeClass.VariableType
                  ) {
                      return callback();
                  }
                  const cache = cacheNode as CacheNodeVariable | CacheNodeVariableType;
                  this._defer_readNode(cacheNode.nodeId, AttributeIds.Value,
                    (err: Error | null, value?: DataValue) => {
                        cache.dataValue = value!;
                        callback();
                    });
              },
              task6_variable_arrayDimension: (callback: ErrorCallback) => {
                  callback();
              },
              task7_variable_minimumSamplingInterval: (callback: ErrorCallback) => {
                  if (cacheNode.nodeClass !== NodeClass.Variable) {
                      return callback();
                  }
                  const cache = cacheNode as CacheNodeVariable;
                  this._defer_readNode(cacheNode.nodeId, AttributeIds.MinimumSamplingInterval,
                    (err: Error | null, value?: number) => {
                        cache.minimumSamplingInterval = value!;
                        callback();
                    });
              },
              task8_variable_accessLevel: (callback: ErrorCallback) => {
                  if (cacheNode.nodeClass !== NodeClass.Variable) {
                      return callback();
                  }
                  const cache = cacheNode as CacheNodeWithAccessLevelField;
                  this._defer_readNode(cacheNode.nodeId, AttributeIds.AccessLevel,
                    (err: Error | null, value?: number) => {
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
                  this._defer_readNode(cacheNode.nodeId, AttributeIds.UserAccessLevel,
                    (err: Error | null, value?: number) => {
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
                  this._defer_readNode(cacheNode.nodeId, AttributeIds.InverseName,
                    (err: Error | null, value?: LocalizedText) => {
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
                  this._defer_readNode(cacheNode.nodeId, AttributeIds.IsAbstract,
                    (err: Error | null, value?: boolean) => {
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
                  const cache = cacheNode as CacheNodeDataType;
                  this._defer_readNode(cacheNode.nodeId, AttributeIds.DataType, (err, value?: NodeId) => {
                      if (err) {
                          return callback(err);
                      }
                      cache.dataTypeDefinition = value! as NodeId;
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

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
NodeCrawler.prototype.read = thenify.withCallback(NodeCrawler.prototype.read);
NodeCrawler.prototype.crawl = thenify.withCallback(NodeCrawler.prototype.crawl);
