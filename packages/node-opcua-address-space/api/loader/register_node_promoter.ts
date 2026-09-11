import type { NodeId } from "node-opcua-nodeid";
import { resolveNodeId } from "node-opcua-nodeid";
import { g_promotableObject, type Promoter } from "./namespace_post_step.js";

/**
 * A promoter is not only for namespace 0. An application registers one for a type it defines
 * itself, or for a companion-specification type (DI, ADI, Machinery...), and those types have a
 * namespace index that is only known once the nodeset is loaded - hence the NodeId overload.
 * The numeric form stays because a namespace-0 type is naturally written as an `ObjectTypeIds`
 * or `VariableTypeIds` constant.
 */
export function registerNodePromoter(typeDefinitionNodeId: NodeId | number, promoter: Promoter, onInstanceOnly = false): void {
    g_promotableObject.set(resolveNodeId(typeDefinitionNodeId).toString(), { promoter, onInstanceOnly });
}
