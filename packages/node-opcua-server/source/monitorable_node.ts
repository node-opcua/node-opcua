/**
 * @module node-opcua-server
 *
 * What a monitored item needs of the node it watches, whether a node object or a node of the
 * compact address space: its identity, the attributes it reads, and the events it listens to
 * (value_changed, semantic_changed, dispose, the attribute change events).
 */
import type { EventEmitter } from "node:events";
import type { BaseNode, ISessionContext, UAMethod, UAObject, UAVariable } from "node-opcua-address-space";
import type { AttributeIds, NodeClass, QualifiedName } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";

/** a node of the compact address space, as a monitored item sees it */
export interface CompactMonitorableNode extends EventEmitter {
    readonly nodeId: NodeId;
    readonly nodeClass: NodeClass;
    readonly browseName: QualifiedName;
    readonly dataType?: NodeId;
    readonly minimumSamplingInterval?: number;
    readAttribute(
        context: ISessionContext | null,
        attributeId: AttributeIds,
        indexRange?: NumericRange,
        dataEncoding?: unknown
    ): DataValue;
    getChildByName(name: string, namespaceIndex?: number): unknown;
    readValueAsync?(context: ISessionContext | null, callback: (err: Error | null, dataValue?: DataValue) => void): void;
    /** true when the Variable's DataType is a number: what a deadband filter needs */
    isNumberDataType?(): boolean;
}

export type MonitorableNode = UAVariable | UAObject | UAMethod | CompactMonitorableNode;

/** what a node lookup answers: a node object, or a node of the compact address space */
export type FoundNode = BaseNode | CompactMonitorableNode;

/** where the nodes to monitor are found: the address space, or the engine's view over both of its spaces */
export interface INodeFinder {
    findNode(nodeId: NodeIdLike): FoundNode | null;
}
