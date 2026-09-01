import type { BaseNode, InstantiateObjectOptions, UAObject } from "node-opcua-address-space-base";
import type { NodeId } from "node-opcua-nodeid";

export interface InstantiateConditionOptions extends InstantiateObjectOptions {
    conditionOf?: UAObject | BaseNode | NodeId | null;
    conditionClass?: UAObject | BaseNode | NodeId | null;
    conditionName?: string;
}
