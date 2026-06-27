/**
 * @module node-opcua-role-set-common
 */
import type { NodeId } from "node-opcua-nodeid";
import type { AnonymousIdentityToken, IdentityMappingRuleType, UserNameIdentityToken, X509IdentityToken } from "node-opcua-types";

/**
 * Union of all user identity token types (OPC 10000-4).
 * Mirrors the type from node-opcua-address-space but avoids
 * pulling in the heavy address-space dependency.
 */
export type AnyUserIdentityToken = AnonymousIdentityToken | UserNameIdentityToken | X509IdentityToken;

/**
 * Store for identity-to-role mappings (OPC 10000-18 §4.4).
 *
 * Each mapping associates an {@link IdentityMappingRuleType} with a role NodeId.
 * The store resolves which roles a given user identity token grants.
 */
export interface IIdentityMappingStore {
    /** Add an identity mapping rule for a role. Idempotent. */
    addIdentity(roleId: NodeId, rule: IdentityMappingRuleType): void;

    /** Remove an identity mapping rule. Returns true if found and removed. */
    removeIdentity(roleId: NodeId, rule: IdentityMappingRuleType): boolean;

    /** Get all identity mapping rules for a given role. */
    getIdentitiesForRole(roleId: NodeId): IdentityMappingRuleType[];

    /** Get all role NodeIds that have at least one mapping. */
    getRoleIds(): NodeId[];

    /** Resolve which roles are granted by a user identity token. */
    resolveRoles(token: AnyUserIdentityToken): NodeId[];
}
