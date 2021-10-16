import { NodeId } from "node-opcua-nodeid";
import { IAddressSpace } from "./address_space";
import { BaseNode } from "./base_node";

export interface UAReference {
    readonly nodeId: NodeId;
    readonly referenceType: NodeId;
    readonly isForward: boolean;

    readonly node?: BaseNode;

    toString(options?: { addressSpace?: IAddressSpace }): string;
}
