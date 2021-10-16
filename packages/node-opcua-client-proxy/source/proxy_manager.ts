/**
 * @module node-opcua-client-proxy
 */
// tslint:disable:no-shadowed-variable
import { EventEmitter } from "stream";
import * as async from "async";
import { assert } from "node-opcua-assert";

import { AttributeIds, NodeClass, coerceAccessLevelFlag } from "node-opcua-data-model";
import { NodeId, coerceNodeId } from "node-opcua-nodeid";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { NodeIdLike } from "node-opcua-nodeid";
import { CreateSubscriptionRequestOptions, MonitoringParametersOptions } from "node-opcua-service-subscription";
import { StatusCodes, CallbackT, StatusCode } from "node-opcua-status-code";
import { ErrorCallback } from "node-opcua-status-code";
import { IBasicSession } from "node-opcua-pseudo-session";
import { ReadValueIdOptions } from "node-opcua-service-read";
import { Variant } from "node-opcua-variant";

import { readUAStructure } from "./object_explorer";
import { makeRefId } from "./proxy";
import { ProxyBaseNode } from "./proxy_base_node";
import { ProxyObject } from "./proxy_object";
import { ProxyStateMachineType } from "./state_machine_proxy";

export interface IProxy1 {
    nodeId: NodeId;
    executableFlag?: boolean;
    __monitoredItem_execution_flag?: EventEmitter;
    __monitoredItem?: EventEmitter;
}
export interface IProxy extends EventEmitter, IProxy1 {
    dataValue: DataValue;
}
function getObject(proxyManager: UAProxyManager, nodeId: NodeIdLike | NodeId, options: any, callback: any) {
    const session = proxyManager.session;

    nodeId = coerceNodeId(nodeId) as NodeId;

    if (nodeId.isEmpty()) {
        setImmediate(() => {
            callback(new Error(" Invalid empty node in getObject"));
        });
        return;
    }

    const nodesToRead = [
        {
            attributeId: AttributeIds.BrowseName,
            nodeId
        },
        {
            attributeId: AttributeIds.Description,
            nodeId
        },
        {
            attributeId: AttributeIds.NodeClass,
            nodeId
        }
    ];

    function read_accessLevels(clientObject: any, callback: ErrorCallback) {
        const nodesToRead = [
            {
                attributeId: AttributeIds.Value,
                nodeId
            },
            {
                attributeId: AttributeIds.UserAccessLevel,
                nodeId
            },
            {
                attributeId: AttributeIds.AccessLevel,
                nodeId
            }
        ];

        session.read(nodesToRead, (err: Error | null, dataValues?: DataValue[]) => {
            if (err) {
                return callback(err);
            }

            dataValues = dataValues || [];

            if (dataValues[0].statusCode === StatusCodes.Good) {
                clientObject.dataValue = dataValues[0].value;
            }
            if (dataValues[1].statusCode === StatusCodes.Good) {
                clientObject.userAccessLevel = coerceAccessLevelFlag(dataValues[1].value.value);
            }
            if (dataValues[2].statusCode === StatusCodes.Good) {
                clientObject.accessLevel = coerceAccessLevelFlag(dataValues[2].value.value);
            }
            callback(err!);
        });
    }

    let clientObject: any;

    async.series(
        [
            (callback: ErrorCallback) => {
                // readAttributes like browseName and references
                session.read(nodesToRead, (err: Error | null, dataValues?: DataValue[]) => {
                    if (!err) {
                        dataValues = dataValues!;

                        if (dataValues[0].statusCode === StatusCodes.BadNodeIdUnknown) {
                            // xx console.log(" INVALID NODE ", nodeId.toString());
                            return callback(new Error("Invalid Node " + nodeId.toString()));
                        }

                        clientObject = new ProxyObject(proxyManager, nodeId as NodeId);

                        /// x console.log("xxxx ,s",results.map(function(a){ return a.toString();}));

                        clientObject.browseName = dataValues[0].value.value;
                        clientObject.description = dataValues[1].value ? dataValues[1].value.value : "";
                        clientObject.nodeClass = dataValues[2].value.value;
                        // xx console.log("xxx nodeClass = ",clientObject.nodeClass.toString());

                        if (clientObject.nodeClass === NodeClass.Variable) {
                            return read_accessLevels(clientObject, callback);
                        }
                    }
                    callback(err!);
                });
            },

            (callback: ErrorCallback) => {
                // install monitored item
                if (clientObject.nodeClass === NodeClass.Variable) {
                    /*console.log(
                        "xxxx -> monitoring",
                        clientObject.nodeId.toString(),
                        clientObject.nodeClass.toString(),
                        clientObject.browseName.toString()
                    );
                    */
                    return proxyManager._monitor_value(clientObject, callback);
                }
                callback();
            },

            (callback: ErrorCallback) => {
                readUAStructure(proxyManager, clientObject, callback);
            }

            //
        ],
        (err) => {
            // istanbul ignore next
            if (err) {
                return callback(err);
            }
            callback(null, clientObject);
        }
    );
}

export interface IClientSubscription {
    monitor(
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions,
        timestampToReturn: TimestampsToReturn,
        callback: CallbackT<IClientMonitoredItemBase>
    ): void;

    terminate(callback: () => void): void;
    on(eventName: "terminated", eventHandler: () => void): void;
}

export interface IClientMonitoredItemBase {
    on(eventName: "changed", eventHandler: (data: DataValue | Variant[]) => void): void;
}
export interface IBasicSessionWithSubscription extends IBasicSession {
    createSubscription2(options: CreateSubscriptionRequestOptions, callback: CallbackT<IClientSubscription>): void;
}

// tslint:disable-next-line: max-classes-per-file
export class UAProxyManager {
    public readonly session: IBasicSessionWithSubscription;
    public subscription?: IClientSubscription;
    private _map: any;

    constructor(session: IBasicSessionWithSubscription) {
        this.session = session;
        this._map = {};
        // create a subscription
    }

    public async start(): Promise<void>;
    public start(callback: (err?: Error) => void): void;
    public start(...args: any[]): any {
        const callback = args[0] as (err?: Error) => void;

        const createSubscriptionRequest: CreateSubscriptionRequestOptions = {
            maxNotificationsPerPublish: 1000,
            priority: 10,
            publishingEnabled: true,
            requestedLifetimeCount: 6000,
            requestedMaxKeepAliveCount: 100,
            requestedPublishingInterval: 100
        };

        this.session.createSubscription2(createSubscriptionRequest, (err: Error | null, subscription?: IClientSubscription) => {
            if (err) {
                return callback(err);
            }
            this.subscription = subscription!;
            this.subscription!.on("terminated", () => {
                this.subscription = undefined;
            });
            callback();
        });
    }

    public async stop(): Promise<void>;
    public stop(callback: (err?: Error) => void): void;

    public stop(...args: any[]): any {
        const callback = args[0] as (err?: Error) => void;

        if (this.subscription) {
            this.subscription.terminate(() => {
                this.subscription = undefined;
                callback();
            });
        } else {
            callback(new Error("UAProxyManager already stopped ?"));
        }
    }

    // todo: rename getObject as getNode
    public async getObject(nodeId: NodeIdLike): Promise<any>;

    public getObject(nodeId: NodeIdLike, callback: (err: Error | null, object?: any) => void): void;
    public getObject(...args: any[]): any {
        const nodeId = args[0] as NodeIdLike;
        const callback = args[1] as (err: Error | null, object?: any) => void;

        let options: any = {};

        setImmediate(() => {
            options = options || {};
            options.depth = options.depth || 1;

            const key = nodeId.toString();
            // the object already exist in the map ?
            if (Object.prototype.hasOwnProperty.call(this._map, key)) {
                return callback(null, this._map[key]);
            }

            getObject(this, nodeId, options, (err: Error | null, obj?: ProxyBaseNode) => {
                if (!err) {
                    this._map[key] = obj;
                }
                callback(err, obj);
            });
        });
    }

    public _monitor_value(proxyObject: IProxy, callback: ErrorCallback): void {
        if (!this.subscription) {
            // debugLog("cannot monitor _monitor_value: no subscription");
            // some server do not provide subscription support, do not treat this as an error.
            return callback(); // new Error("No subscription"));
        }

        const itemToMonitor: ReadValueIdOptions = {
            // ReadValueId
            attributeId: AttributeIds.Value,
            nodeId: proxyObject.nodeId
        };
        const monitoringParameters: MonitoringParametersOptions = {
            // MonitoringParameters
            discardOldest: true,
            queueSize: 10,
            samplingInterval: 0 /* event-based */
        };
        const requestedParameters = TimestampsToReturn.Both;

        this.subscription.monitor(
            itemToMonitor,
            monitoringParameters,
            requestedParameters,

            (err: Error | null, monitoredItem?: IClientMonitoredItemBase) => {
                Object.defineProperty(proxyObject, "__monitoredItem", { value: monitoredItem, enumerable: false });
                proxyObject.__monitoredItem!.on("changed", (dataValue: DataValue) => {
                    proxyObject.dataValue = dataValue;
                    proxyObject.emit("value_changed", dataValue);
                });
                proxyObject.__monitoredItem!.on("err", (err: Error) => {
                    // tslint:disable-next-line: no-console
                    console.log("Proxy: cannot monitor variable ", itemToMonitor.nodeId?.toString(), err.message);
                });
                callback(err!);
            }
        );
    }

    public _monitor_execution_flag(proxyObject: IProxy1, callback: (err?: Error) => void): void {
        // note : proxyObject must wrap a method
        assert(proxyObject.nodeId instanceof NodeId);

        if (!this.subscription) {
            // some server do not provide subscription support, do not treat this as an error.
            return callback(); // new Error("No subscription"));
        }

        const itemToMonitor = {
            // ReadValueId
            attributeId: AttributeIds.Executable,
            nodeId: proxyObject.nodeId
        };

        const monitoringParameters = {
            // MonitoringParameters
            discardOldest: true,
            queueSize: 10,
            samplingInterval: 0 /* event-based */
        };
        const requestedParameters = TimestampsToReturn.Neither;

        this.subscription.monitor(
            itemToMonitor,
            monitoringParameters,
            requestedParameters,
            (err: Error | null, monitoredItem?: IClientMonitoredItemBase) => {
                Object.defineProperty(proxyObject, "__monitoredItem_execution_flag", {
                    value: monitoredItem,

                    enumerable: false
                });
                proxyObject.__monitoredItem_execution_flag!.on("changed", (dataValue: DataValue) => {
                    proxyObject.executableFlag = dataValue.value.value;
                });

                callback(err!);
            }
        );
    }

    public getStateMachineType(
        nodeId: NodeIdLike,
        callback: (err: Error | null, stateMachineType?: ProxyStateMachineType) => void
    ): void {
        if (typeof nodeId === "string") {
            const org_nodeId = nodeId;
            nodeId = makeRefId(nodeId);
        }

        this.getObject(nodeId, (err: Error | null, obj: any) => {
            // read fromState and toState Reference on
            let stateMachineType;
            if (!err) {
                stateMachineType = new ProxyStateMachineType(obj);
            }
            callback(err, stateMachineType);
        });
    }
}

// tslint:disable-next-line:no-var-requires
const thenify = require("thenify");
UAProxyManager.prototype.start = thenify.withCallback(UAProxyManager.prototype.start);
UAProxyManager.prototype.stop = thenify.withCallback(UAProxyManager.prototype.stop);
UAProxyManager.prototype.getObject = thenify.withCallback(UAProxyManager.prototype.getObject);
