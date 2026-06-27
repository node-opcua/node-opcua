/**
 * @module node-opcua-role-set-common
 *
 * Pre-built NodeId objects for the OPC UA Well-Known Roles
 * (OPC 10000-3 §4.8.2).
 *
 * These save callers from repeatedly calling `resolveNodeId(WellKnownRoles.X)`.
 */

import { WellKnownRoles } from "node-opcua-constants";
import { makeNodeId } from "node-opcua-nodeid";

// Re-export so consumers only need to import from role-set-common
export { WellKnownRoles } from "node-opcua-constants";

/**
 * Pre-built NodeId objects for OPC UA Well-Known Roles.
 *
 * Usage:
 * ```ts
 * import { WellKnownRoleIds } from "node-opcua-role-set-common";
 * store.addIdentity(WellKnownRoleIds.SecurityAdmin, rule);
 * ```
 */
export const WellKnownRoleIds = {
    /** Very limited access for anonymous Sessions. */
    Anonymous: makeNodeId(WellKnownRoles.Anonymous),
    /** Limited access for valid non-anonymous credentials. */
    AuthenticatedUser: makeNodeId(WellKnownRoles.AuthenticatedUser),
    /** Browse, read live/historical data, subscribe. */
    Observer: makeNodeId(WellKnownRoles.Observer),
    /** Observer + write some live data, call some Methods. */
    Operator: makeNodeId(WellKnownRoles.Operator),
    /** Browse, read/write config, read historical, call Methods, subscribe. */
    Engineer: makeNodeId(WellKnownRoles.Engineer),
    /** Browse, read live/historical data, call Methods, subscribe. */
    Supervisor: makeNodeId(WellKnownRoles.Supervisor),
    /** Change non-security related configuration. */
    ConfigureAdmin: makeNodeId(WellKnownRoles.ConfigureAdmin),
    /** Change security related settings. */
    SecurityAdmin: makeNodeId(WellKnownRoles.SecurityAdmin)
} as const;
