import { resolveNodeId } from "node-opcua-nodeid";
import { g_promotableObject, Promoter } from "./namespace_post_step";

export function registerNodePromoter(standardNodeId: number, promoter: Promoter, onInstanceOnly = false): void {
    g_promotableObject.set(resolveNodeId(standardNodeId).toString(),{ promoter, onInstanceOnly });
}
