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
import type { EventFilterResult } from "node-opcua-types";
import { type Variant } from "node-opcua-variant";
import type { EventItemIdentity } from "../monitorable_node.js";
/** the events of a node, filtered by the engine for an item */
export interface NodeEventSource {
    subscribeEvents(nodeId: NodeId, filter: EventFilter, context: ISessionContext | null, onFields: (fields: Variant[]) => void, item?: EventItemIdentity): () => void;
    /** the result of the filter of an event item, checked by the engine before the item was created */
    eventFilterResult(filter: EventFilter): EventFilterResult | undefined;
}
export declare abstract class MonitoredNodeBase extends EventEmitter {
    #private;
    readonly nodeId: NodeId;
    readonly nodeClass: NodeClass;
    readonly browseName: QualifiedName;
    readonly dataType?: NodeId;
    protected constructor(events: NodeEventSource, nodeId: NodeId, nodeClass: NodeClass, browseName: QualifiedName, dataType?: NodeId);
    /** the engine pushes the values written to the node from now on */
    protected abstract startWatching(): void;
    protected abstract stopWatching(): void;
    protected canWatch(): boolean;
    subscribeEvents(filter: EventFilter, context: ISessionContext | null, onFields: (fields: Variant[]) => void, item?: EventItemIdentity): () => void;
    analyzeEventFilter(filter: EventFilter): EventFilterResult | undefined;
    /** NodeId, NodeClass, BrowseName, DataType: what the engine described; undefined for the other attributes */
    protected describedAttribute(attributeId: AttributeIds): DataValue | undefined;
}
//# sourceMappingURL=front_node_base.d.ts.map