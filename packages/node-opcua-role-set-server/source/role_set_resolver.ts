/**
 * @module node-opcua-role-set-server
 *
 * IRoleResolver adapter backed by an IIdentityMappingStore, optionally enforcing
 * per-Role application/endpoint restrictions (OPC 10000-18 §4.4.1).
 */
import type { NodeId } from "node-opcua-nodeid";
import type {
    AnyUserIdentityToken,
    IIdentityMappingStore,
    IRoleRestrictionStore,
    ResolutionContext
} from "node-opcua-role-set-common";

/**
 * Adapts an {@link IIdentityMappingStore} (and an optional
 * {@link IRoleRestrictionStore}) to the `IRoleResolver` contract so it can be
 * registered on `OPCUAServer.roleResolvers`.
 *
 * A Role is granted when the UserIdentityToken matches **and** — if a
 * restriction store is provided and a resolution context is available — the
 * Session's application/endpoint comply with the Role's restrictions.
 */
export interface RoleSetResolverOptions {
    /**
     * A token this resolver must grant nothing to, whatever the store maps it
     * to. `createRoleBasedSecurity` uses it for a user who must change the
     * password: the server `userManager` then grants only Anonymous, and
     * without this the resolver, reading the same store, would hand the
     * user's mapped Roles back to the Session.
     */
    excludeToken?: (userIdentityToken: AnyUserIdentityToken) => boolean;
}

export class RoleSetResolver {
    constructor(
        private readonly store: IIdentityMappingStore,
        private readonly restrictionStore?: IRoleRestrictionStore,
        private readonly options: RoleSetResolverOptions = {}
    ) {}

    public resolveRoles(userIdentityToken: AnyUserIdentityToken, context?: ResolutionContext): NodeId[] {
        if (this.options.excludeToken?.(userIdentityToken)) {
            return [];
        }
        const roles = this.store.resolveRoles(userIdentityToken, context);
        if (!this.restrictionStore || !context) {
            return roles;
        }
        const restrictionStore = this.restrictionStore;
        return roles.filter((roleId) => restrictionStore.complies(roleId, context));
    }
}
