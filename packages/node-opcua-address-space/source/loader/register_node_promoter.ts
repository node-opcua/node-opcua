import { NodeIdLike, resolveNodeId } from "node-opcua-nodeid";

import { UAObject } from "../../src/ua_object";
import { UAVariable } from "../../src/ua_variable";

import { g_promotableObject } from "./namespace_post_step";

export function registerNodePromoter(nodeId: NodeIdLike, promoter: ((node: UAVariable) => void) | ((node: UAObject) => void)) {
    g_promotableObject[resolveNodeId(nodeId).toString()] = promoter;
}
