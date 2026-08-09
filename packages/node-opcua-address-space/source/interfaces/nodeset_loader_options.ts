/**
 * how the per-node access policy declared in a NodeSet2 file
 * (the `AccessRestrictions` / `HasNoPermissions` attributes and the `<RolePermissions>` element)
 * is handled at load time.
 *
 *  - `"apply"`  : the policy is installed on the node, as mandated by OPC UA Part 6 F.3.
 *  - `"ignore"` : the policy is discarded. This is what node-opcua did before this option existed:
 *                 a nodeset declaring a restrictive policy would load fail-open.
 */
export type NodeSetPermissionsPolicy = "apply" | "ignore";

export interface NodeSetLoaderOptions {
    loadDraftNodes?: boolean;
    loadDeprecatedNodes?: boolean;
    /**
     * Applying the policy is the spec-compliant behaviour and the default.
     *
     * Be aware of what that means for the nodesets you load. `Opc.Ua.NodeSet2.xml` alone
     * carries 854 RolePermission entries and 359 AccessRestrictions; the restrictions sit on
     * management surfaces (the RoleSet internals, ServerConfiguration, file transfer methods)
     * and now require a signed — often signed and encrypted — channel to reach.
     *
     * Set this to `"ignore"` if an existing deployment relied on the previous fail-open
     * behaviour and would otherwise lock itself out.
     * @default "apply"
     */
    permissions?: NodeSetPermissionsPolicy;
}
