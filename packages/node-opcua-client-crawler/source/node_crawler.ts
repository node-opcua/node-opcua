import * as chalk from "chalk";
import * as async from "async";

import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { assert } from "node-opcua-assert";
import { ReferenceDescription } from "node-opcua-service-browse";
import { ErrorCallback } from "node-opcua-status-code";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { NodeClass } from "node-opcua-data-model";
import { lowerFirstLetter } from "node-opcua-utils";

import { NodeCrawlerBase, ObjectMap, Pojo, UserData } from "./node_crawler_base";
import { CacheNode, CacheNodeVariable, CacheNodeVariableType } from "./cache_node";
import { TaskReconstruction, EmptyCallback, removeCycle } from "./private";

const debugLog = make_debugLog(__filename);
const warningLog = make_warningLog(__filename);
const doDebug = checkDebugFlag(__filename);

type Queue = async.QueueObject<TaskReconstruction>;

export class NodeCrawler extends NodeCrawlerBase {
    /**
     *
     */
    public read(nodeId: NodeIdLike): Promise<Pojo>;
    public read(nodeId: NodeIdLike, callback: (err: Error | null, obj?: Pojo) => void): void;
    public read(nodeId: NodeIdLike, callback?: (err: Error | null, obj?: Pojo) => void): any {
        /* istanbul ignore next */
        if (!callback) {
            throw new Error("Invalid Error");
        }

        try {
            nodeId = resolveNodeId(nodeId);
        } /* istanbul ignore next */ catch (err) {
            callback(err as Error);
            return;
        }

        const key = nodeId.toString();

        // check if object has already been crawled
        if (Object.prototype.hasOwnProperty.call(this._objMap, key)) {
            const object = this._objMap[key];
            return callback(null, object);
        }

        const userData: UserData = {
            onBrowse: NodeCrawlerBase.follow
        };

        this.crawl(nodeId, userData, (err) => {
            /* istanbul ignore next */
            if (err) {
                return callback(err);
            }

            /* istanbul ignore else */
            if (Object.prototype.hasOwnProperty.call(this._objectCache, key)) {
                const cacheNode = this._objectCache[key];
                assert(cacheNode.browseName.name !== "pending");

                this.simplify_object(this._objMap, cacheNode, callback);
            } else {
                callback(new Error("Cannot find nodeId" + key));
            }
        });
    }

    private simplify_object(objMap: ObjectMap, object: CacheNode, finalCallback: (err: Error | null, obj?: Pojo) => void) {
        assert(typeof finalCallback === "function");

        const queue: Queue = async.queue((task: TaskReconstruction, innerCallback: EmptyCallback) => {
            setImmediate(() => {
                assert(typeof task.func === "function");
                task.func(task, innerCallback);
            });
        }, 1);

        // tslint:disable:no-empty
        this._add_for_reconstruction(queue, objMap, object, () => {
            /* */
        });

        const key1 = object.nodeId.toString();
        queue.drain(() => {
            const object1: Pojo = this._objMap[key1];
            removeCycle(object1, finalCallback);
        });
    }

    private _add_for_reconstruction(
        queue: Queue,
        objMap: ObjectMap,
        object: CacheNode,
        extraFunc: (err: Error | null, obj?: Pojo) => void
    ) {
        if (!object || !object.nodeId) {
            return;
        }
        assert(typeof extraFunc === "function");
        assert(typeof object.nodeId.toString() === "string");

        const task: TaskReconstruction = {
            data: object,
            func: (data, callback: ErrorCallback) => {
                this._reconstruct_manageable_object(queue, objMap, object, (err: Error | null, obj?: Pojo) => {
                    extraFunc(err, obj);
                    callback(err || undefined);
                });
            }
        };
        queue.push(task);
    }

    private _reconstruct_manageable_object(
        queue: Queue,
        objMap: ObjectMap,
        object: CacheNode,
        callback: (err: Error | null, obj?: Pojo) => void
    ) {
        assert(typeof callback === "function");
        assert(object);
        assert(object.nodeId);

        const key2 = object.nodeId.toString();
        if (Object.prototype.hasOwnProperty.call(objMap, key2)) {
            return callback(null, objMap[key2]);
        }
        /* reconstruct a more manageable object
         * var obj = {
         *    browseName: "Objects",
         *    organizes : [
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
        if (object instanceof CacheNodeVariable || object instanceof CacheNodeVariableType) {
            if (object.dataType) {
                obj.dataType = object.dataType.toJSON();
                // xx obj.dataTypeName = object.dataTypeName;
            }
            if (object.dataValue) {
                obj.dataValue = object.dataValue.toJSON();
            }
        }
        objMap[key2] = obj;

        const referenceMap = obj;

        object.references = object.references || [];

        object.references.map((ref: ReferenceDescription) => {
            assert(ref);
            const refIndex = ref.referenceTypeId.toString();

            const referenceType = this._objectCache[refIndex];

            /* istanbul ignore else */
            if (!referenceType) {
                warningLog(chalk.red("Unknown reference type " + refIndex));
                // debugLog(util.inspect(object, { colors: true, depth: 10 }));
            }
            const reference = this._objectCache[ref.nodeId.toString()];

            /* istanbul ignore else */
            if (!reference) {
                warningLog(
                    ref.nodeId.toString(),
                    "bn=",
                    ref.browseName.toString(),
                    "class =",
                    NodeClass[ref.nodeClass],
                    ref.typeDefinition.toString()
                );
                warningLog("Crawler: Cannot find reference", ref.nodeId.toString(), "in cache");
                warningLog("contact Sterfive's professional support for help to resolve");
            }

            if (reference) {
                // Extract nodeClass so it can be appended
                reference.nodeClass = (ref as any).$nodeClass;
            }
            if (referenceType) {
                const refName = lowerFirstLetter(referenceType?.browseName?.name || "");

                if (refName === "hasTypeDefinition") {
                    obj.typeDefinition = reference?.browseName.name;
                } else {
                    if (!referenceMap[refName]) {
                        referenceMap[refName] = [];
                    }
                    this._add_for_reconstruction(queue, objMap, reference, (err: Error | null, mObject?: Pojo) => {
                        if (!err) {
                            referenceMap[refName].push(mObject);
                        }
                    });
                }
            }
        });
        callback(null, obj);
    }
}
// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
NodeCrawler.prototype.read = thenify.withCallback(NodeCrawler.prototype.read);
