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
export declare class RemoteObjectNode extends MonitoredNodeBase implements CompactMonitorableNode {
    #private;
    readonly minimumSamplingInterval: number;
    constructor(host: RemoteObjectHost, nodeId: NodeId, description: RemoteObjectDescription);
    protected startWatching(): void;
    protected stopWatching(): void;
    isNumberDataType(): boolean;
    getChildByName(): unknown;
    readAttribute(_context: ISessionContext | null, attributeId: AttributeIds): DataValue;
    readValueAsync(context: ISessionContext | null, callback: (err: Error | null, dataValue?: DataValue) => void): void;
    /** a value the engine pushed: written to the node object */
    changed(dataValue: DataValue): void;
}
/** the description of a node from the Read of its NodeClass, BrowseName, DataType and MinimumSamplingInterval */
export declare function describeFromRead(values: DataValue[]): RemoteObjectDescription | null;
/** the attributes describeFromRead() takes, in this order */
export declare const DESCRIBED_ATTRIBUTES: AttributeIds[];
//# sourceMappingURL=remote_object_node.d.ts.map