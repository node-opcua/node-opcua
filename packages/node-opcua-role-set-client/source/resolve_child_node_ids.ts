/**
 * @module node-opcua-role-set-client
 *
 * Resolve the NodeIds of several children of a parent Node in one
 * `translateBrowsePath` round-trip — the shared building block behind
 * {@link ClientRole}, {@link ClientRoleSet} and {@link ClientUserManagement}.
 */
import type { NodeId } from "node-opcua-nodeid";
import type { IBasicSessionAsync } from "node-opcua-pseudo-session";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";

/**
 * Given a `parentNodeId` and a map of `key → relative browse path` (e.g.
 * `{ addIdentity: "/AddIdentity" }`), return the same keys mapped to the
 * resolved child NodeId, or `null` when the child does not exist.
 */
export async function resolveChildNodeIds<K extends string>(
    session: IBasicSessionAsync,
    parentNodeId: NodeId,
    paths: Record<K, string>
): Promise<Record<K, NodeId | null>> {
    const keys = Object.keys(paths) as K[];
    const results = await session.translateBrowsePath(keys.map((k) => makeBrowsePath(parentNodeId, paths[k])));
    const out = {} as Record<K, NodeId | null>;
    keys.forEach((key, i) => {
        const r = results[i];
        out[key] = r.statusCode.isGood() && r.targets ? r.targets[0].targetId : null;
    });
    return out;
}
