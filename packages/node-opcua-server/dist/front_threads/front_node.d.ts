/**
 * @module node-opcua-server
 *
 * A node of the compact namespaces as a monitored item in a front thread sees it. What does not
 * depend on the session (class, name, DataType) was described by the engine when the item was
 * created; the value is read in place when no permission rule applies to it, else asked to the
 * engine. A listener to value_changed makes the front watch the node: the engine, the only
 * writer, then pushes every value written to it. A pushed value goes to the item as it is only
 * when every session may read it; otherwise the item's session reads it again through the engine,
 * which applies its roles. A version word orders the values whatever path they came by, so that
 * an item never goes back to an older value.
 *
 * A percent deadband reads the EURange property: the front watches it from the first use, so
 * that a new range applies to the next value.
 */
import type { ISessionContext } from "node-opcua-address-space";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { type NodeId } from "node-opcua-nodeid";
import type { CompactMonitorableNode } from "../monitorable_node.js";
import { MonitoredNodeBase, type NodeEventSource } from "./front_node_base.js";
import type { NodeDescription } from "./protocol.js";
/** what a node asks of the backend of its front thread */
export interface FrontNodeHost extends NodeEventSource {
    /** false once the node is deleted (or its index given to another node) */
    isAlive(node: FrontMonitoredNode): boolean;
    /** true when every session may read the node's value: no permission rule, readable access levels */
    isReadableByAll(node: FrontMonitoredNode): boolean;
    /** the value read in place, with its version; null when it must be asked to the engine */
    valueInPlace(node: FrontMonitoredNode): {
        dataValue: DataValue;
        version: number;
    } | null;
    /** the value as the engine reads it for this session; version -1 when the node is gone */
    fetchValue(context: ISessionContext | null, node: FrontMonitoredNode): Promise<{
        dataValue: DataValue;
        version: number;
    }>;
    minimumSamplingInterval(node: FrontMonitoredNode): number;
    /** an attribute other than the Value, as the engine read it for this session when the item was created */
    attributeFor(context: ISessionContext | null, node: FrontMonitoredNode, attributeId: AttributeIds): DataValue | undefined;
    watch(node: FrontMonitoredNode): void;
    unwatch(node: FrontMonitoredNode): void;
}
export declare class FrontMonitoredNode extends MonitoredNodeBase implements CompactMonitorableNode {
    #private;
    readonly index: number;
    readonly generation: number;
    constructor(host: FrontNodeHost, nodeId: NodeId, description: NodeDescription, trusted?: boolean);
    protected startWatching(): void;
    protected stopWatching(): void;
    protected canWatch(): boolean;
    get minimumSamplingInterval(): number;
    isNumberDataType(): boolean;
    /** only the EURange property, for a percent deadband: its current value, watched from its first read */
    getChildByName(name: string): unknown;
    readAttribute(context: ISessionContext | null, attributeId: AttributeIds): DataValue;
    /** what the samplers call: in place when it can be, else from the engine, with the session's permissions */
    readValueAsync(context: ISessionContext | null, callback: (err: Error | null, dataValue?: DataValue) => void): void;
    /**
     * a value the engine pushed: reported unless a newer one was already seen. Under a permission
     * rule it is not the item's to see as it is: the item's session reads the value again
     */
    deliver(dataValue: DataValue, version: number): void;
    /** the node was deleted: what a monitored item listens to, as on the node objects */
    dispose(): void;
}
//# sourceMappingURL=front_node.d.ts.map