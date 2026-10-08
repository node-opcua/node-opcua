/**
 * @module node-opcua-server
 *
 * A node object of the engine (namespace 0: ServerStatus, the diagnostics...) as a monitored item
 * in a session worker sees it. It is described when the item is created, by a Read the engine runs
 * in the context of the session; a sampled item reads its value through the engine; an item that
 * reports changes as they happen makes the worker watch it, and the engine pushes the values
 * written to it.
 */

import type { ISessionContext } from "node-opcua-address-space";
import { AttributeIds, type NodeClass, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import type { CompactMonitorableNode } from "../monitorable_node.js";
import { MonitoredNodeBase, type NodeEventSource } from "./front_node_base.js";

/** what a node object asks of the worker it is monitored in */
export interface RemoteObjectHost extends NodeEventSource {
    /** the value as the engine reads it for this session */
    readValue(context: ISessionContext | null, node: RemoteObjectNode): Promise<DataValue>;
    watch(node: RemoteObjectNode): void;
    unwatch(node: RemoteObjectNode): void;
}

/** the attributes the engine read of the node when an item was created on it */
export interface RemoteObjectDescription {
    nodeClass: NodeClass;
    browseName: QualifiedName;
    dataType: NodeId | null;
    minimumSamplingInterval: number;
}

// the built-in numeric DataTypes (SByte to Double), what a deadband applies to
const NUMBER_TYPES = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

export class RemoteObjectNode extends MonitoredNodeBase implements CompactMonitorableNode {
    public readonly minimumSamplingInterval: number;
    readonly #host: RemoteObjectHost;
    #last: DataValue | null = null;

    constructor(host: RemoteObjectHost, nodeId: NodeId, description: RemoteObjectDescription) {
        super(host, nodeId, description.nodeClass, description.browseName, description.dataType ?? undefined);
        this.#host = host;
        this.minimumSamplingInterval = description.minimumSamplingInterval;
    }

    protected startWatching(): void {
        this.#host.watch(this);
    }

    protected stopWatching(): void {
        this.#host.unwatch(this);
    }

    public isNumberDataType(): boolean {
        return !!this.dataType && this.dataType.namespace === 0 && NUMBER_TYPES.has(this.dataType.value as number);
    }

    public getChildByName(): unknown {
        return null;
    }

    public readAttribute(_context: ISessionContext | null, attributeId: AttributeIds): DataValue {
        if (attributeId === AttributeIds.Value) {
            return this.#last ?? new DataValue({ statusCode: StatusCodes.BadWaitingForInitialData });
        }
        return this.describedAttribute(attributeId) ?? new DataValue({ statusCode: StatusCodes.BadAttributeIdInvalid });
    }

    public readValueAsync(context: ISessionContext | null, callback: (err: Error | null, dataValue?: DataValue) => void): void {
        this.#host.readValue(context, this).then(
            (dataValue) => {
                this.#last = dataValue;
                callback(null, dataValue);
            },
            (err: Error) => callback(err)
        );
    }

    /** a value the engine pushed: written to the node object */
    public changed(dataValue: DataValue): void {
        this.#last = dataValue;
        this.emit("value_changed", dataValue);
    }
}

/** the description of a node from the Read of its NodeClass, BrowseName, DataType and MinimumSamplingInterval */
export function describeFromRead(values: DataValue[]): RemoteObjectDescription | null {
    const [nodeClass, browseName, dataType, minimumSamplingInterval] = values;
    if (!nodeClass?.statusCode.isGood()) return null;
    return {
        nodeClass: nodeClass.value.value as NodeClass,
        browseName: (browseName?.value?.value as QualifiedName) ?? new QualifiedName({ name: "" }),
        dataType: dataType?.statusCode.isGood() ? (dataType.value.value as NodeId) : null,
        minimumSamplingInterval: minimumSamplingInterval?.statusCode.isGood() ? (minimumSamplingInterval.value.value as number) : 0
    };
}

/** the attributes describeFromRead() takes, in this order */
export const DESCRIBED_ATTRIBUTES = [
    AttributeIds.NodeClass,
    AttributeIds.BrowseName,
    AttributeIds.DataType,
    AttributeIds.MinimumSamplingInterval
];
