import async from "async";
import chalk from "chalk";
import assert from "node-opcua-assert";
import { NodeClass } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import { type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import type { ReferenceDescription } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { type CacheNode, CacheNodeVariable, CacheNodeVariableType } from "./cache_node.js";
import { NodeCrawlerBase, type NodeCrawlerClientSession, type ObjectMap, type Pojo, type UserData } from "./node_crawler_base.js";
import { type EmptyCallback, removeCycle, type TaskReconstruction } from "./private.js";

const warningLog = make_warningLog("node_crawler");

type Queue = async.QueueObject<TaskReconstruction>;

/**
 * @deprecated: use NodeCrawlerBase from "@sterfive/crawler"
 *              contact@sterfive.com
 */
export class NodeCrawler extends NodeCrawlerBase {
    protected readonly _objMap: ObjectMap;

    constructor(session: NodeCrawlerClientSession) {
        super(session);
        this._objMap = {};
    }
    public override dispose(): void {
        Object.values(this._objMap).forEach((obj: Pojo) => {
            Object.keys(obj).forEach((k) => {
                obj[k] = undefined;
            });
        });
        (this as unknown as { _objMap: ObjectMap | null })._objMap = null;
        super.dispose();
    }
    /**
     *
     */
    public read(nodeId: NodeIdLike): Promise<Pojo>;
    public read(nodeId: NodeIdLike, callback: (err: Error | null, obj?: Pojo) => void): void;
    public read(nodeId: NodeIdLike, callback?: (err: Error | null, obj?: Pojo) => void): Promise<Pojo> | undefined {
        /* c8 ignore next */
        if (!callback) {
            throw new Error("Invalid Error");
        }

        try {
            nodeId = resolveNodeId(nodeId);
        } /* c8 ignore next */ catch (err) {
            callback(err as Error);
            return;
        }

        const key = nodeId.toString();

        // check if object has already been crawled
        if (Object.hasOwn(this._objMap, key)) {
            const object = this._objMap[key];
            callback(null, object);
            return;
        }

        const userData: UserData = {
            onBrowse: NodeCrawlerBase.follow
        };

        this.crawl(nodeId, userData, (err) => {
            /* c8 ignore next */
            if (err) {
                return callback(err);
            }

            if (Object.hasOwn(this._objectCache, key)) {
                const cacheNode = this._objectCache[key];
                assert(cacheNode.browseName.name !== "pending");

                this.simplify_object(this._objMap, cacheNode, callback);
            } else {
                /* c8 ignore next */
                callback(new Error(`Cannot find nodeId${key}`));
            }
        });
        return;
    }

    private simplify_object(objMap: ObjectMap, object: CacheNode, finalCallback: (err: Error | null, obj?: Pojo) => void) {
        assert(typeof finalCallback === "function");

        const queue: Queue = async.queue((task: TaskReconstruction, innerCallback: EmptyCallback) => {
            setImmediate(() => {
                assert(typeof task.func === "function");
                task.func(task, innerCallback);
            });
        }, 1);

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
        if (!object?.nodeId) {
            return;
        }
        assert(typeof extraFunc === "function");
        assert(typeof object.nodeId.toString() === "string");

        const task: TaskReconstruction = {
            data: object,
            func: (_data, callback: EmptyCallback) => {
                this._reconstruct_manageable_object(queue, objMap, object, (err: Error | null, obj?: Pojo) => {
                    extraFunc(err, obj);
                    callback();
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
        if (Object.hasOwn(objMap, key2)) {
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
        const obj: Pojo = {
            browseName: object.browseName.name,
            nodeId: object.nodeId.toString(),
            displayName: object.displayName?.text,
            description: object.description?.text
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

        object.references.forEach((ref: ReferenceDescription) => {
            assert(ref);
            const refIndex = ref.referenceTypeId.toString();

            const referenceType = this._objectCache[refIndex];

            /* c8 ignore next */
            if (!referenceType) {
                warningLog(chalk.red(`Unknown reference type ${refIndex}`));
                // debugLog(util.inspect(object, { colors: true, depth: 10 }));
            }
            const reference = this._objectCache[ref.nodeId.toString()];

            /* c8 ignore next */
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
                reference.nodeClass = ref.nodeClass;
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
                            (referenceMap[refName] as Pojo[]).push(mObject as Pojo);
                        }
                    });
                }
            }
        });
        callback(null, obj);
    }
}

import { withCallback } from "thenify-ex";

NodeCrawler.prototype.read = withCallback(NodeCrawler.prototype.read);
