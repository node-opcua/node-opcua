/**
 * OPC Unified Architecture, Part 3 Release 1.04
 * 4.8.2 Well Known Roles
 *
 * All Servers should support the well-known Roles defined in Table 2.
 * The NodeIds for the well-known Roles are defined in Part 6.
 *
 * @see OPC 10000-3 §4.8.2
 */
/** biome-ignore-all lint/style/useLiteralEnumMembers: uses ObjectIds constants */
import { ObjectIds } from "./opcua_node_ids";

export enum WellKnownRoles {
    /** Very limited access for anonymous Sessions. */
    Anonymous = ObjectIds.WellKnownRole_Anonymous,
    /** Limited access for valid non-anonymous credentials. */
    AuthenticatedUser = ObjectIds.WellKnownRole_AuthenticatedUser,
    /** Browse, read live/historical data, subscribe. */
    Observer = ObjectIds.WellKnownRole_Observer,
    /** Observer + write some live data, call some Methods. */
    Operator = ObjectIds.WellKnownRole_Operator,
    /** Browse, read/write config, read historical, call Methods, subscribe. */
    Engineer = ObjectIds.WellKnownRole_Engineer,
    /** Browse, read live/historical data, call Methods, subscribe. */
    Supervisor = ObjectIds.WellKnownRole_Supervisor,
    /** Change non-security related configuration. */
    ConfigureAdmin = ObjectIds.WellKnownRole_ConfigureAdmin,
    /** Change security related settings. */
    SecurityAdmin = ObjectIds.WellKnownRole_SecurityAdmin,
}
