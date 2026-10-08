/**
 * @module node-opcua-server
 *
 * What the nodes a monitored item sees in another thread than the engine's have in common, a node of
 * the shared store (FrontMonitoredNode) or a node object of the engine (RemoteObjectNode): what the
 * engine described of them, the watch a listener to value_changed starts, and their events, filtered
 * by the engine.
 */

import { EventEmitter } from "node:events";
import type { ISessionContext } from "node-opcua-address-space";
import { AttributeIds, type NodeClass, type QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { EventFilter } from "node-opcua-service-filter";
import { StatusCodes } from "node-opcua-status-code";
import type { EventFilterResult } from "node-opcua-types";
import { DataType, type Variant } from "node-opcua-variant";
import type { EventItemIdentity } from "../monitorable_node.js";

/** the events of a node, filtered by the engine for an item */
export interface NodeEventSource {
    subscribeEvents(
        nodeId: NodeId,
        filter: EventFilter,
        context: ISessionContext | null,
        onFields: (fields: Variant[]) => void,
        item?: EventItemIdentity
    ): () => void;
    /** the result of the filter of an event item, checked by the engine before the item was created */
    eventFilterResult(filter: EventFilter): EventFilterResult | undefined;
}

export abstract class MonitoredNodeBase extends EventEmitter {
    public readonly nodeId: NodeId;
    public readonly nodeClass: NodeClass;
    public readonly browseName: QualifiedName;
    public readonly dataType?: NodeId;
    readonly #events: NodeEventSource;
    #watching = false;

    protected constructor(
        events: NodeEventSource,
        nodeId: NodeId,
        nodeClass: NodeClass,
        browseName: QualifiedName,
        dataType?: NodeId
    ) {
        super();
        this.#events = events;
        this.nodeId = nodeId;
        this.nodeClass = nodeClass;
        this.browseName = browseName;
        this.dataType = dataType;
        // an item reporting changes listens to value_changed: the engine then pushes the node's values
        this.on("newListener", (event: string | symbol) => {
            if (event === "value_changed" && !this.#watching && this.canWatch()) {
                this.#watching = true;
                this.startWatching();
            }
        });
        this.on("removeListener", (event: string | symbol) => {
            if (event === "value_changed" && this.#watching && this.listenerCount("value_changed") === 0) {
                this.#watching = false;
                this.stopWatching();
            }
        });
    }

    /** the engine pushes the values written to the node from now on */
    protected abstract startWatching(): void;
    protected abstract stopWatching(): void;
    protected canWatch(): boolean {
        return true;
    }

    public subscribeEvents(
        filter: EventFilter,
        context: ISessionContext | null,
        onFields: (fields: Variant[]) => void,
        item?: EventItemIdentity
    ): () => void {
        return this.#events.subscribeEvents(this.nodeId, filter, context, onFields, item);
    }

    public analyzeEventFilter(filter: EventFilter): EventFilterResult | undefined {
        return this.#events.eventFilterResult(filter);
    }

    /** NodeId, NodeClass, BrowseName, DataType: what the engine described; undefined for the other attributes */
    protected describedAttribute(attributeId: AttributeIds): DataValue | undefined {
        switch (attributeId) {
            case AttributeIds.NodeId:
                return new DataValue({ statusCode: StatusCodes.Good, value: { dataType: DataType.NodeId, value: this.nodeId } });
            case AttributeIds.NodeClass:
                return new DataValue({ statusCode: StatusCodes.Good, value: { dataType: DataType.Int32, value: this.nodeClass } });
            case AttributeIds.BrowseName:
                return new DataValue({
                    statusCode: StatusCodes.Good,
                    value: { dataType: DataType.QualifiedName, value: this.browseName }
                });
            case AttributeIds.DataType:
                return this.dataType
                    ? new DataValue({ statusCode: StatusCodes.Good, value: { dataType: DataType.NodeId, value: this.dataType } })
                    : new DataValue({ statusCode: StatusCodes.BadAttributeIdInvalid });
            default:
                return undefined;
        }
    }
}
