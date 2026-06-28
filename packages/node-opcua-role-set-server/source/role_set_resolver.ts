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
export class RoleSetResolver {
    constructor(
        private readonly store: IIdentityMappingStore,
        private readonly restrictionStore?: IRoleRestrictionStore
    ) {}

    public resolveRoles(userIdentityToken: AnyUserIdentityToken, context?: ResolutionContext): NodeId[] {
        const roles = this.store.resolveRoles(userIdentityToken);
        if (!this.restrictionStore || !context) {
            return roles;
        }
        const restrictionStore = this.restrictionStore;
        return roles.filter((roleId) => restrictionStore.complies(roleId, context));
    }
}
