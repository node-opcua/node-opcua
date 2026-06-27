/**
 * @module node-opcua-role-set-server
 *
 * IRoleResolver adapter backed by an IIdentityMappingStore.
 */
import type { NodeId } from "node-opcua-nodeid";
import type { AnyUserIdentityToken, IIdentityMappingStore } from "node-opcua-role-set-common";

/**
 * Adapts an {@link IIdentityMappingStore} to the `IRoleResolver`
 * interface so it can be registered on `OPCUAServer.roleResolvers`.
 *
 * Implements the structural contract:
 * ```typescript
 * { resolveRoles(token: AnyUserIdentityToken): NodeId[] }
 * ```
 */
export class RoleSetResolver {
    constructor(private readonly store: IIdentityMappingStore) {}

    public resolveRoles(userIdentityToken: AnyUserIdentityToken): NodeId[] {
        return this.store.resolveRoles(userIdentityToken);
    }
}
