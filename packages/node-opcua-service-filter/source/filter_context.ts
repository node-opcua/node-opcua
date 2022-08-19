import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { constructBrowsePathFromQualifiedName } from "node-opcua-service-translate-browse-path";
import { AttributeOperand, BrowsePath, NodeClass, SimpleAttributeOperand } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";

export interface FilterContext {
    readonly eventSource: NodeId;
    isSubtypeOf(nodeId: NodeId, baseType: NodeId): boolean;
    getTypeDefinition(nodeId: NodeId): NodeId | null;
    // readOperand(operand: SimpleAttributeOperand | AttributeOperand): Variant;
    readNodeValue(nodeId: NodeIdLike): Variant;
    getNodeClass(nodeId: NodeId): NodeClass;
    browsePath(browsePath: BrowsePath): NodeId | null;
}

