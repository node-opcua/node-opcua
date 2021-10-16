import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { UAObject, UAVariable } from "node-opcua-address-space-base";

import { g_promotableObject } from "./namespace_post_step";

export function registerNodePromoter(
    nodeId: NodeIdLike,
    promoter: ((node: UAVariable) => void) | ((node: UAObject) => void)
): void {
    g_promotableObject[resolveNodeId(nodeId).toString()] = promoter;
}
