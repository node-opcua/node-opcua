/**
 * @module node-opcua-server
 *
 * A node object of the engine (namespace 0: ServerStatus, the diagnostics...) as a monitored item
 * in a session worker sees it. It is described when the item is created, by a Read the engine runs
 * in the context of the session; a sampled item reads its value through the engine; an item that
 * reports changes as they happen makes the worker watch it, and the engine pushes the values
 * written to it.
 */
import { EventEmitter } from "node:events";
import type { ISessionContext } from "node-opcua-address-space";
import { AttributeIds, type NodeClass, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { EventFilter } from "node-opcua-service-filter";
import { StatusCodes } from "node-opcua-status-code";
import type { EventFilterResult } from "node-opcua-types";
import { DataType, type Variant } from "node-opcua-variant";
import type { CompactMonitorableNode } from "../monitorable_node.js";

/** what a node object asks of the worker it is monitored in */
export interface RemoteObjectHost {
    /** the value as the engine reads it for this session */
    readValue(context: ISessionContext | null, node: RemoteObjectNode): Promise<DataValue>;
    watch(node: RemoteObjectNode): void;
    unwatch(node: RemoteObjectNode): void;
    /** the events of the node, filtered by the engine for an item */
    subscribeEvents(
        nodeId: NodeId,
        filter: EventFilter,
        context: ISessionContext | null,
        onFields: (fields: Variant[]) => void
    ): () => void;
    eventFilterResult(filter: EventFilter): EventFilterResult | undefined;
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

export class RemoteObjectNode extends EventEmitter implements CompactMonitorableNode {
    public readonly nodeId: NodeId;
    public readonly nodeClass: NodeClass;
    public readonly browseName: QualifiedName;
    public readonly dataType?: NodeId;
    public readonly minimumSamplingInterval: number;
    readonly #host: RemoteObjectHost;
    #last: DataValue | null = null;
    #watching = false;

    constructor(host: RemoteObjectHost, nodeId: NodeId, description: RemoteObjectDescription) {
        super();
        this.#host = host;
        this.nodeId = nodeId;
        this.nodeClass = description.nodeClass;
        this.browseName = description.browseName;
        this.dataType = description.dataType ?? undefined;
        this.minimumSamplingInterval = description.minimumSamplingInterval;
        // an item reporting changes listens to value_changed: the engine then pushes the node's values
        this.on("newListener", (event: string) => {
            if (event === "value_changed" && !this.#watching) {
                this.#watching = true;
                this.#host.watch(this);
            }
        });
        this.on("removeListener", (event: string) => {
            if (event === "value_changed" && this.#watching && this.listenerCount("value_changed") === 0) {
                this.#watching = false;
                this.#host.unwatch(this);
            }
        });
    }

    public isNumberDataType(): boolean {
        return !!this.dataType && this.dataType.namespace === 0 && NUMBER_TYPES.has(this.dataType.value as number);
    }

    public getChildByName(): unknown {
        return null;
    }

    public subscribeEvents(
        filter: EventFilter,
        context: ISessionContext | null,
        onFields: (fields: Variant[]) => void
    ): () => void {
        return this.#host.subscribeEvents(this.nodeId, filter, context, onFields);
    }

    public analyzeEventFilter(filter: EventFilter): EventFilterResult | undefined {
        return this.#host.eventFilterResult(filter);
    }

    public readAttribute(_context: ISessionContext | null, attributeId: AttributeIds): DataValue {
        switch (attributeId) {
            case AttributeIds.NodeId:
                return new DataValue({ value: { dataType: DataType.NodeId, value: this.nodeId } });
            case AttributeIds.NodeClass:
                return new DataValue({ value: { dataType: DataType.Int32, value: this.nodeClass } });
            case AttributeIds.BrowseName:
                return new DataValue({ value: { dataType: DataType.QualifiedName, value: this.browseName } });
            case AttributeIds.DataType:
                return this.dataType
                    ? new DataValue({ value: { dataType: DataType.NodeId, value: this.dataType } })
                    : new DataValue({ statusCode: StatusCodes.BadAttributeIdInvalid });
            case AttributeIds.Value:
                return this.#last ?? new DataValue({ statusCode: StatusCodes.BadWaitingForInitialData });
            default:
                return new DataValue({ statusCode: StatusCodes.BadAttributeIdInvalid });
        }
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
