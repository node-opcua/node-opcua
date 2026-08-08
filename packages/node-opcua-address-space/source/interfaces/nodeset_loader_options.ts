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
     * Set this to `"ignore"` if an existing deployment relied on the previous fail-open behaviour
     * and would otherwise lock itself out: nodesets such as `Opc.Ua.Gds.NodeSet2.xml` restrict
     * a large part of their address space to the SecurityAdmin role over a signed and encrypted
     * channel, and those restrictions now take effect.
     * @default "apply"
     */
    permissions?: NodeSetPermissionsPolicy;
}
