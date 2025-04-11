/**
 * @module node-opcua-client-proxy
 */
// tslint:disable:no-shadowed-variable
import { EventEmitter } from "stream";
import { assert } from "node-opcua-assert";

import { AttributeIds, NodeClass, coerceAccessLevelFlag } from "node-opcua-data-model";
import { NodeId, coerceNodeId } from "node-opcua-nodeid";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { NodeIdLike } from "node-opcua-nodeid";
import { CreateSubscriptionRequestOptions, MonitoringParametersOptions } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { IBasicSessionAsync, IBasicSessionGetArgumentDefinitionAsync } from "node-opcua-pseudo-session";
import { ReadValueIdOptions } from "node-opcua-service-read";
import { Variant } from "node-opcua-variant";
import { make_debugLog } from "node-opcua-debug";

import { readUAStructure } from "./object_explorer";
import { makeRefId } from "./proxy";
import { ProxyObject } from "./proxy_object";
import { ProxyStateMachineType } from "./state_machine_proxy";
import { ProxyNode } from "./proxy_transition";

const debugLog = make_debugLog(__filename);

export interface IProxy1 {
    nodeId: NodeId;
    executableFlag?: boolean;
    __monitoredItem_execution_flag?: EventEmitter;
    __monitoredItem?: EventEmitter;
}
export interface IProxy extends EventEmitter, IProxy1 {
    dataValue: DataValue;
}

async function internalGetObject(
    proxyManager: UAProxyManager, 
    nodeId: NodeIdLike | NodeId, options: any
): Promise<ProxyNode> {
   
    const session = proxyManager.session;

    nodeId = coerceNodeId(nodeId) as NodeId;

    if (nodeId.isEmpty()) {
        throw new Error(" Invalid empty node in getObject");
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

    async function read_accessLevels(clientObject: any) {
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

        const dataValues = await session.read(nodesToRead);

        if (dataValues[0].statusCode.isGood()) {
            clientObject.dataValue = dataValues[0].value;
        }
        if (dataValues[1].statusCode.isGood()) {
            clientObject.userAccessLevel = coerceAccessLevelFlag(dataValues[1].value.value);
        }
        if (dataValues[2].statusCode.isGood()) {
            clientObject.accessLevel = coerceAccessLevelFlag(dataValues[2].value.value);
        }
    }

    let clientObject: any;

    const dataValues = await session.read(nodesToRead);

    if (dataValues[0].statusCode.equals(StatusCodes.BadNodeIdUnknown)) {
        throw new Error("Invalid Node " + nodeId.toString());
    }

    clientObject = new ProxyObject(proxyManager, nodeId as NodeId);

    clientObject.browseName = dataValues[0].value.value;
    clientObject.description = dataValues[1].value ? dataValues[1].value.value : "";
    clientObject.nodeClass = dataValues[2].value.value;

    if (clientObject.nodeClass === NodeClass.Variable) {
        await read_accessLevels(clientObject);
    }
    // install monitored item
    if (clientObject.nodeClass === NodeClass.Variable) {
        await proxyManager._monitor_value(clientObject);
    }

    return await readUAStructure(proxyManager, clientObject);
}

export interface IClientSubscription {
    monitor(
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions,
        timestampToReturn: TimestampsToReturn
    ): Promise<IClientMonitoredItemBase>;

    terminate(): Promise<void>;
    on(eventName: "terminated", eventHandler: () => void): void;
}

export interface IClientMonitoredItemBase {
    on(eventName: "changed", eventHandler: (data: DataValue | Variant[]) => void): void;
}
export interface IBasicSessionWithSubscriptionAsync extends IBasicSessionAsync, IBasicSessionGetArgumentDefinitionAsync {
    createSubscription2(options: CreateSubscriptionRequestOptions): Promise<IClientSubscription>;
}

// tslint:disable-next-line: max-classes-per-file
export class UAProxyManager {
    public readonly session: IBasicSessionWithSubscriptionAsync;
    public subscription?: IClientSubscription;
    #_map: any;

    constructor(session: IBasicSessionWithSubscriptionAsync) {
        this.session = session;
        this.#_map = {};
    }

    public async start(): Promise<void> {

        const createSubscriptionRequest: CreateSubscriptionRequestOptions = {
            maxNotificationsPerPublish: 1000,
            priority: 10,
            publishingEnabled: true,
            requestedLifetimeCount: 6000,
            requestedMaxKeepAliveCount: 100,
            requestedPublishingInterval: 100
        };

        const subscription = await this.session.createSubscription2(createSubscriptionRequest);
        this.subscription = subscription!;
        this.subscription!.on("terminated", () => {
            this.subscription = undefined;
        });
    }

    public async stop(): Promise<void> {
        if (this.subscription) {
            await this.subscription.terminate();
            this.subscription = undefined;
        } else {
            // throw new Error("UAProxyManager already stopped ?");
        }
    }

    // todo: rename getObject as getNode
    public async getObject(nodeId: NodeIdLike): Promise<ProxyNode> {
        let options: any = {};
        options = options || {};
        options.depth = options.depth || 1;

        const key = nodeId.toString();
        // the object already exist in the map ?
        if (Object.prototype.hasOwnProperty.call(this.#_map, key)) {
            return this.#_map[key];
        }

        const obj = await internalGetObject(this, nodeId, options);
        this.#_map[key] = obj;
        return obj;
    }

    public async _monitor_value(proxyObject: IProxy): Promise<void> {
        if (!this.subscription) {
            // debugLog("cannot monitor _monitor_value: no subscription");
            // some server do not provide subscription support, do not treat this as an error.
            return; // new Error("No subscription"));
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

        const monitoredItem = await this.subscription.monitor(itemToMonitor, monitoringParameters, requestedParameters);

        Object.defineProperty(proxyObject, "__monitoredItem", { value: monitoredItem, enumerable: false });
        proxyObject.__monitoredItem!.on("changed", (dataValue: DataValue) => {
            proxyObject.dataValue = dataValue;
            proxyObject.emit("value_changed", dataValue);
        });
        proxyObject.__monitoredItem!.on("err", (err: Error) => {
            debugLog("Proxy: cannot monitor variable ", itemToMonitor.nodeId?.toString(), err.message);
        });
    }

    public async _monitor_execution_flag(proxyObject: IProxy1): Promise<void> {
        // note : proxyObject must wrap a method
        assert(proxyObject.nodeId instanceof NodeId);

        if (!this.subscription) {
            // some server do not provide subscription support, do not treat this as an error.
            return; // new Error("No subscription"));
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

        const monitoredItem = await this.subscription.monitor(itemToMonitor, monitoringParameters, requestedParameters);
        Object.defineProperty(proxyObject, "__monitoredItem_execution_flag", {
            value: monitoredItem,

            enumerable: false
        });
        proxyObject.__monitoredItem_execution_flag!.on("changed", (dataValue: DataValue) => {
            proxyObject.executableFlag = dataValue.value.value;
        });
    }
    public async getStateMachineType(nodeId: NodeIdLike): Promise<ProxyStateMachineType> {
        if (typeof nodeId === "string") {
            nodeId = makeRefId(nodeId);
        }
        const obj = await this.getObject(nodeId);
        return new ProxyStateMachineType(obj);
    }
}
