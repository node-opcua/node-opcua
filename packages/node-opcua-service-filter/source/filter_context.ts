import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { BrowsePath, NodeClass } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";

export interface FilterContext {
    readonly eventSource: NodeId;
    isSubtypeOf(nodeId: NodeId, baseType: NodeId): boolean;
    getTypeDefinition(nodeId: NodeId): NodeId | null;
    // readOperand(operand: SimpleAttributeOperand | AttributeOperand): Variant;
    readNodeValue(nodeId: NodeIdLike): Variant;
    getNodeClass(nodeId: NodeId): NodeClass;
    browsePath(browsePath: BrowsePath): NodeId | null;
}
