import type { NodeId } from "node-opcua-nodeid";
import type { IAddressSpace } from "./address_space.js";
import type { BaseNode } from "./base_node.js";

export interface UAReference {
    readonly nodeId: NodeId;
    readonly referenceType: NodeId;
    readonly isForward: boolean;

    readonly node?: BaseNode;

    toString(options?: { addressSpace?: IAddressSpace }): string;
}
