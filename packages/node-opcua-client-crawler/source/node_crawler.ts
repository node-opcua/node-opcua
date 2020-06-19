import * as chalk from "chalk";
import * as async from "async";
import _ = require("underscore");

import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { assert } from "node-opcua-assert";
import { ReferenceDescription } from "node-opcua-service-browse";
import { ErrorCallback } from "node-opcua-status-code";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import {
    NodeCrawlerBase,
    UserData,
} from "./node_crawler_base";
import {
    CacheNode,
    CacheNodeVariable,
    CacheNodeVariableType
} from "./cache_node";
import { TaskReconstruction, EmptyCallback, remove_cycle } from "./private";
import { lowerFirstLetter } from "node-opcua-utils";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export class NodeCrawler extends NodeCrawlerBase {

    /**
     *
     */
    public read(nodeId: NodeIdLike): Promise<any>;
    public read(nodeId: NodeIdLike, callback: (err: Error | null, obj?: any) => void): void;
    public read(nodeId: NodeIdLike, callback?: (err: Error | null, obj?: any) => void): any {

        /* istanbul ignore next */
        if (!callback) {
            throw new Error("Invalid Error");
        }

        try {
            nodeId = resolveNodeId(nodeId);
        } /* istanbul ignore next */ catch (err) {
            return callback(err);
        }

        const key = nodeId.toString();

        // check if object has already been crawled
        if (this._objMap.hasOwnProperty(key)) {
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
            if (this._objectCache.hasOwnProperty(key)) {

                const cacheNode = this._objectCache[key];
                assert(cacheNode.browseName.name !== "pending");

                this.simplify_object(this._objMap, cacheNode, callback);

            } else {
                callback(new Error("Cannot find nodeId" + key));
            }
        });
    }

    private simplify_object(
        objMap: any,
        object: CacheNode,
        finalCallback: (err: Error | null, obj?: any) => void
    ) {

        assert(_.isFunction(finalCallback));

        const queue = async.queue(
            (task: TaskReconstruction, innerCallback: EmptyCallback) => {
                setImmediate(() => {
                    assert(_.isFunction(task.func));
                    task.func(task, innerCallback);
                });
            }, 1);

        // tslint:disable:no-empty
        this._add_for_reconstruction(queue, objMap, object, () => {
        });

        const key1 = object.nodeId.toString();
        queue.drain(() => {
            const object1: any = this._objMap[key1];
            remove_cycle(object1, finalCallback);
        });
    }

    private _add_for_reconstruction(
        queue: any,
        objMap: any,
        object: CacheNode,
        extraFunc: (err: Error | null, obj?: any) => void
    ) {
        assert(_.isFunction(extraFunc));
        assert(typeof object.nodeId.toString() === "string");

        const task: TaskReconstruction = {
            data: object,
            func: (data, callback: ErrorCallback) => {
                this._reconstruct_manageable_object(queue, objMap, object, (err: Error | null, obj?: any) => {
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
        object: CacheNode,
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
                debugLog(chalk.red("Unknown reference type " + refIndex));
                // debugLog(util.inspect(object, { colors: true, depth: 10 }));
                // console.log(chalk.red("Unknown reference type " + refIndex));
                // console.log(util.inspect(ref, { colors: true, depth: 10 }));
            }
            const reference = this._objectCache[ref.nodeId.toString()];

            /* istanbul ignore else */
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
                    if (!reference.nodeId) {
                        // tslint:disable-next-line: no-console
                        console.log("node id ", reference.toString());
                    }
                    this._add_for_reconstruction(queue, objMap, reference, (err: Error | null, mObject: any) => {
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
