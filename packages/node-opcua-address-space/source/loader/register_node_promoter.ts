import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { UAObject, UAVariable } from "node-opcua-address-space-base";

import { g_promotableObject, Promoter } from "./namespace_post_step";

export function registerNodePromoter(standardNodeId: number, promoter: Promoter, onInstanceOnly = false): void {
    
    g_promotableObject[resolveNodeId(standardNodeId).toString()] = { promoter, onInstanceOnly };
}
