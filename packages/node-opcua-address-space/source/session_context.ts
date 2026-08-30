/**
 * @module node-opcua-address-space
 */
/** biome-ignore-all lint/style/useLiteralEnumMembers: still needed */

import type {
    BaseNode,
    IAddressSpace,
    ISessionBase,
    ISessionContext,
    UAObject,
    UAObjectType,
    UAVariable
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { UAString } from "node-opcua-basic-types";
import { ObjectIds } from "node-opcua-constants";
import { type Certificate, type CertificateInternals, exploreCertificate } from "node-opcua-crypto/web";
import {
    AccessRestrictionsFlag,
    AttributeIds,
    allPermissions,
    BrowseDirection,
    NodeClass,
    PermissionFlag,
    type QualifiedNameLike,
    type QualifiedNameOptions
} from "node-opcua-data-model";
import type { PreciseClock } from "node-opcua-date-time";
import { NodeId, type NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import {
    AnonymousIdentityToken,
    MessageSecurityMode,
    PermissionType,
    type RolePermissionType,
    UserNameIdentityToken,
    X509IdentityToken
} from "node-opcua-types";
import type { NamespacePrivate } from "../src/namespace_private";

// export type, not a plain re-export: RolePermissionTypeOptions is an interface,
// and the value form left an `undefined` export key in Windows-built CJS output
// (tsc could not prove the name type-only there and kept the runtime binding).
export type { RolePermissionTypeOptions } from "node-opcua-types";
export { PermissionType, RolePermissionType } from "node-opcua-types";

export type AnyUserIdentityToken = UserNameIdentityToken | AnonymousIdentityToken | X509IdentityToken;

function getUserName(userIdentityToken: AnyUserIdentityToken): string {
    if (userIdentityToken instanceof AnonymousIdentityToken) {
        return "anonymous";
    }
    if (userIdentityToken instanceof X509IdentityToken) {
        const cert = Array.isArray(userIdentityToken.certificateData)
            ? userIdentityToken.certificateData[0]
            : userIdentityToken.certificateData;
        const certInfo: CertificateInternals = exploreCertificate(cert);
        const userName = certInfo.tbsCertificate.subject.commonName || "";
        if (typeof userName !== "string") {
            throw new Error("Invalid username");
        }
        return userName;
    }
    if (userIdentityToken instanceof UserNameIdentityToken) {
        if (userIdentityToken.policyId === "anonymous") {
            return "anonymous";
        }
        return typeof userIdentityToken.userName === "string" ? userIdentityToken.userName : "";
    }
    throw new Error("Invalid user identity token");
}

// Re-exported from node-opcua-constants for backward compatibility.
// The canonical definition now lives in node-opcua-constants so that
// client-side packages can use it without pulling in address-space.
import { WellKnownRoles } from "node-opcua-constants";

export { WellKnownRoles } from "node-opcua-constants";

/** @deprecated Use WellKnownRoles instead */
export const WellKnownRolesNodeId = {
    Anonymous: ObjectIds.WellKnownRole_Anonymous,
    AuthenticatedUser: ObjectIds.WellKnownRole_AuthenticatedUser,
    ConfigureAdmin: ObjectIds.WellKnownRole_ConfigureAdmin,
    Engineer: ObjectIds.WellKnownRole_Engineer,
    Observer: ObjectIds.WellKnownRole_Observer,
    Operator: ObjectIds.WellKnownRole_Operator,
    SecurityAdmin: ObjectIds.WellKnownRole_SecurityAdmin,
    Supervisor: ObjectIds.WellKnownRole_Supervisor
} as const;
/**
 * OPC Unified Architecture, Part 3 13 Release 1.04
 * 4.8.2 Well Known Roles
 * All Servers should support the well-known Roles which are defined in Table 2. The NodeIds
 * for the well-known Roles are defined in Part 6.
 * Table 2 – Well-Known Roles
 * BrowseName           Suggested Permissions
 *
 * Anonymous            The Role has very limited access for use when a Session has anonymous credentials.
 * AuthenticatedUser    The Role has limited access for use when a Session has valid non-anonymous credentials
 *                      but has not been explicitly granted access to a Role.
 * Observer             The Role is allowed to browse, read live data, read historical data/events or subscribe to data/events.
 * Operator             The Role is allowed to browse, read live data, read historical data/events or subscribe to data/events.
 *                      In addition, the Session is allowed to write some live data and call some Methods.
 * Engineer             The Role is allowed to browse, read/write configuration data, read historical data/events,
 *                      call Methods or subscribe to data/events.
 * Supervisor           The Role is allowed to browse, read live data, read historical data/events, call Methods or
 *                      subscribe to data/events.
 * ConfigureAdmin       The Role is allowed to change the non-security related config
 * SecurityAdmin	    The Role is allowed to change security related settings.
 */
export type WellKnownRolesSemiColumnSeparated = string;

export interface IUserManager {
    /**
     * retrieve the roles of the given user
     *  @returns semicolon separated list of roles
     */
    getUserRoles?: (user: string) => NodeId[];
}

/**
 * A temporary override for role resolution.
 *
 * When set on the server, `getUserRoles` is called
 * **before** the default `userManager`. Returning
 * a `NodeId[]` overrides the roles; returning `null`
 * falls through to the default resolution.
 */
export interface IRolePolicyOverride {
    getUserRoles(username: string): NodeId[] | null;
}

/**
 * Session attributes a resolver may use to evaluate application/endpoint
 * restrictions on a Role (OPC 10000-18 §4.4.1).
 */
export interface IRoleResolutionContext {
    /** ApplicationUri from the Client certificate, if any. */
    applicationUri?: string | null;
    /** SecureChannel security mode. */
    securityMode?: MessageSecurityMode;
    /** SecureChannel security policy URI. */
    securityPolicyUri?: string;
    /** Endpoint URL used by the Session, if known. */
    endpointUrl?: string;
}

/**
 * Pluggable role resolver (OPC 10000-18 §4.4).
 *
 * Receives the full UserIdentityToken so implementations can match by
 * Thumbprint, X509Subject, UserName, etc., plus an optional resolution context
 * to enforce application/endpoint restrictions. Registered on
 * IServerBase.roleResolvers by packages like node-opcua-role-set-server.
 */
export interface IRoleResolver {
    resolveRoles(userIdentityToken: AnyUserIdentityToken, context?: IRoleResolutionContext): NodeId[];
}

/**
 * What to do when a permission cannot be resolved for a Session — either because no Role
 * could be attached to its identity, or because neither the node nor its namespace declares
 * any RolePermissions.
 *
 *  - `"allow"` : grant every permission. This is what node-opcua has always done, and what
 *                the vast majority of address spaces need, since almost no server declares
 *                RolePermissions on its own nodes.
 *  - `"deny"`  : grant nothing. Fail-closed, for products that drive access entirely from
 *                declared policy. Expect to set DefaultRolePermissions on every namespace,
 *                otherwise the address space becomes unreadable.
 *
 * Note that this governs *Sessions only*. A SessionContext with no Session at all is an
 * in-process caller (SessionContext.defaultContext, PseudoSession) and stays permissive
 * whatever this is set to — see {@link SessionContext.getPermissions}.
 */
export type UnresolvedPermissionPolicy = "allow" | "deny";

export interface IServerBase {
    userManager?: IUserManager;
    rolePolicyOverride?: IRolePolicyOverride | null;
    /** Additional role resolvers (identity stores, LDAP, etc.) */
    roleResolvers?: IRoleResolver[];
    /**
     * how to treat a permission that could not be resolved for a Session.
     * @default "allow"
     */
    unresolvedPermissionPolicy?: UnresolvedPermissionPolicy;
}

export interface SessionContextOptions {
    session?: ISessionBase /* ServerSession */;
    object?: UAObject | UAObjectType;
    server?: IServerBase /* OPCUAServer*/;
}

function getPermissionForRole(
    rolePermissions: RolePermissionType[] | null,
    role: NodeId,
    unresolved: PermissionFlag
): PermissionFlag {
    if (rolePermissions === null) {
        // neither the node nor its namespace declares any policy: nothing to match the
        // Role against, so the answer is the caller's fail-open / fail-closed default
        return unresolved;
    }
    const a = rolePermissions.find((r) => {
        if (!r.roleId) {
            return false;
        }
        return sameNodeId(resolveNodeId(r.roleId), role);
    });
    return a?.permissions !== undefined ? a.permissions | PermissionFlag.None : PermissionFlag.None;
}

function isDefaultContext(context: SessionContext) {
    return context === SessionContext.defaultContext;
}
function getAccessRestrictionsOnNamespace(namespace: NamespacePrivate, context: SessionContext): AccessRestrictionsFlag {
    // ignore permission when default context is provided (to avoid recursion)
    if (isDefaultContext(context)) {
        return AccessRestrictionsFlag.None;
    }
    const namespaces = namespace.addressSpace.rootFolder?.objects?.server?.namespaces;
    if (!namespaces) {
        return AccessRestrictionsFlag.None;
    }
    const namespaceObject = namespaces.getChildByName(namespace.namespaceUri);
    if (!namespaceObject) {
        return AccessRestrictionsFlag.None;
    }
    const defaultAccessRestriction = namespaceObject.getChildByName("defaultAccessRestriction");
    if (defaultAccessRestriction) {
        const dataValue = defaultAccessRestriction.readAttribute(null, AttributeIds.Value);
        if (dataValue?.statusCode.isGood()) {
            return dataValue.value.value as AccessRestrictionsFlag;
        }
    }
    return AccessRestrictionsFlag.None;
}

function getDefaultUserRolePermissionsOnNamespace(
    namespace: NamespacePrivate,
    context: SessionContext
): RolePermissionType[] | null {
    // ignore permission when default context is provided
    if (isDefaultContext(context)) {
        return null;
    }

    const namespaces = namespace.addressSpace.rootFolder?.objects?.server?.namespaces;
    const uaNamespaceObject = namespaces?.getChildByName(namespace.namespaceUri);
    if (uaNamespaceObject) {
        // DefaultUserRolePermissions is the user-specific policy and wins when it carries a value.
        const defaultUserRolePermissions = uaNamespaceObject.getChildByName("DefaultUserRolePermissions") as UAVariable;
        if (defaultUserRolePermissions) {
            const dataValue = defaultUserRolePermissions.readValue();
            if (dataValue?.statusCode.isGood() && dataValue.value.value && dataValue.value.value.length > 0) {
                return dataValue.value.value as RolePermissionType[];
            }
        }
        const defaultRolePermissions = uaNamespaceObject.getChildByName("DefaultRolePermissions") as UAVariable;
        if (defaultRolePermissions) {
            const dataValue = defaultRolePermissions.readValue();
            const value = dataValue?.value?.value as RolePermissionType[] | null | undefined;
            // Honour a real value only. The metadata node is left Null-typed (value === null)
            // unless setNamespaceMetaData() bound it, so a null must fall through to the
            // namespace policy below instead of short-circuiting the whole lookup to null.
            if (dataValue?.statusCode.isGood() && value !== null && value !== undefined) {
                return value;
            }
        }
    }

    // Fall back to the policy configured programmatically via Namespace.setDefaultRolePermissions().
    // The NamespaceMetadata node is only bound to that field when setNamespaceMetaData() is called
    // (which throws on NodeSet2-loaded namespaces), and is absent entirely for a programmatically
    // created namespace. Consulting the field here keeps the configured default consistent between
    // the local getter (BaseNode.getRolePermissions(inherited=true)) and this enforcement path,
    // so setDefaultRolePermissions() takes effect without also requiring setNamespaceMetaData().
    return namespace.getDefaultRolePermissions();
}

/**
 * A Role, designated either by its NodeId or by its BrowseName.
 *
 * Roles outside namespace 0 (the GDS Roles, or any Role added with AddRole) have
 * NodeIds that depend on the order in which nodesets were loaded, so naming them is
 * more robust than hard coding `ns=1;i=1661`. Resolving a BrowseName requires an
 * address space, since the RoleSet is where the answer lives.
 *
 * A QualifiedName whose namespaceIndex is left undefined matches in any namespace,
 * as long as the BrowseName is unambiguous.
 */
export type RoleIdLike = NodeIdLike | QualifiedNameLike;

/** "i=15668", "ns=1;i=1661", "ns=2;s=MyRole", "g=...", "b=..." */
const nodeIdExpressionRegExp = /^(ns=\d+;)?[isgb]=/;
/** "1:DiscoveryAdmin" */
const namespacedBrowseNameRegExp = /^(\d+):(.+)$/;
/** the left-hand half of a NodeId that a naive split(";") has torn in two */
const namespacePrefixRegExp = /^ns=\d+$/;

const roleSetNodeId = resolveNodeId(ObjectIds.Server_ServerCapabilities_RoleSet);
const anonymousRoleNodeId = resolveNodeId(WellKnownRoles.Anonymous);

function isQualifiedName(role: RoleIdLike): role is QualifiedNameOptions {
    return typeof role === "object" && role !== null && !(role instanceof NodeId) && "name" in role;
}

/**
 * split a semicolon separated list of Roles.
 *
 * NodeId expressions contain a semicolon of their own ("ns=1;i=1661"), so a plain
 * split() would tear them in half: glue the two pieces back together.
 */
function splitRoleList(roleIds: string): string[] {
    const roles: string[] = [];
    for (const token of roleIds.split(";")) {
        const role = token.trim();
        if (role.length === 0) {
            continue;
        }
        const previous = roles.length > 0 ? roles[roles.length - 1] : undefined;
        if (previous !== undefined && namespacePrefixRegExp.test(previous)) {
            roles[roles.length - 1] = `${previous};${role}`;
            continue;
        }
        roles.push(role);
    }
    return roles;
}

/** the standard Roles of OPC 10000-3, which live in namespace 0 and need no address space */
function tryResolveWellKnownRole(browseName: string): NodeId | null {
    const name = browseName.startsWith("WellKnownRole_") ? browseName.slice("WellKnownRole_".length) : browseName;
    try {
        return resolveNodeId(`WellKnownRole_${name}`);
    } catch {
        return null;
    }
}

/**
 * look a Role up by BrowseName in the RoleSet (OPC 10000-18 §4.3), which is where
 * both the standard Roles and the ones contributed by companion nodesets are listed.
 */
function resolveRoleByBrowseName(
    browseName: UAString | undefined,
    namespaceIndex: number | undefined,
    addressSpace: IAddressSpace | undefined
): NodeId {
    if (!browseName) {
        throw new Error("makeRoles: a Role given as a QualifiedName must carry a name");
    }
    if (!addressSpace) {
        throw new Error(
            `makeRoles: cannot resolve the Role "${browseName}": it is not a standard Role of namespace 0, ` +
                "so an address space must be passed as the second argument of makeRoles()"
        );
    }

    const roleSet = addressSpace.findNode(roleSetNodeId);
    if (!roleSet) {
        throw new Error(`makeRoles: cannot resolve the Role "${browseName}": the address space has no RoleSet`);
    }

    const candidates = roleSet
        .findReferencesExAsObject("HasComponent", BrowseDirection.Forward)
        .filter((node) => node.nodeClass === NodeClass.Object && node.browseName.name === browseName)
        .filter((node) => namespaceIndex === undefined || node.browseName.namespaceIndex === namespaceIndex);

    if (candidates.length === 0) {
        const known = roleSet
            .findReferencesExAsObject("HasComponent", BrowseDirection.Forward)
            .filter((node) => node.nodeClass === NodeClass.Object)
            .map((node) => node.browseName.toString())
            .join(", ");
        throw new Error(`makeRoles: cannot find a Role named "${browseName}" in the RoleSet. Known Roles are: ${known}`);
    }
    if (candidates.length > 1) {
        const ambiguous = candidates.map((node) => node.browseName.toString()).join(", ");
        throw new Error(
            `makeRoles: the Role name "${browseName}" is ambiguous (${ambiguous}), please qualify it with its namespace`
        );
    }
    return candidates[0].nodeId;
}

function resolveRole(role: RoleIdLike, addressSpace: IAddressSpace | undefined): NodeId {
    if (isQualifiedName(role)) {
        return resolveRoleByBrowseName(role.name, role.namespaceIndex, addressSpace);
    }
    if (typeof role !== "string") {
        return resolveNodeId(role);
    }
    if (nodeIdExpressionRegExp.test(role)) {
        return resolveNodeId(role);
    }
    const namespacedBrowseName = namespacedBrowseNameRegExp.exec(role);
    if (namespacedBrowseName) {
        return resolveRoleByBrowseName(namespacedBrowseName[2], parseInt(namespacedBrowseName[1], 10), addressSpace);
    }
    // a bare name: the standard Roles resolve without an address space, the others need one
    return tryResolveWellKnownRole(role) ?? resolveRoleByBrowseName(role, undefined, addressSpace);
}

/**
 * build the list of Role NodeIds a user is granted, from any of the accepted spellings:
 *
 * ```ts
 * makeRoles(WellKnownRoles.Observer);                        // a well known Role
 * makeRoles("Observer;Operator");                            // semicolon separated names
 * makeRoles("ns=1;i=1661");                                  // an explicit NodeId
 * makeRoles(["Observer", "ns=1;i=1661"]);                    // mixed
 * makeRoles("1:DiscoveryAdmin", addressSpace);               // BrowseName, namespace index
 * makeRoles("DiscoveryAdmin", addressSpace);                 // BrowseName, any namespace
 * makeRoles([{ name: "DiscoveryAdmin" }], addressSpace);     // idem, as a QualifiedName
 * // when the namespace is known by its URI rather than by its index:
 * makeRoles([{ namespaceIndex: addressSpace.getNamespaceIndex(gdsUri), name: "DiscoveryAdmin" }], addressSpace);
 * ```
 *
 * @param roleIds  the Roles to resolve
 * @param addressSpace  required only to resolve a Role by BrowseName, since that
 *                      lookup goes through the RoleSet
 */
export function makeRoles(roleIds: RoleIdLike[] | string | WellKnownRoles, addressSpace?: IAddressSpace): NodeId[] {
    if (typeof roleIds === "number") {
        roleIds = [roleIds];
    }
    if (typeof roleIds === "string") {
        roleIds = splitRoleList(roleIds);
    }
    return roleIds.map((role) => resolveRole(role, addressSpace));
}

export class SessionContext implements ISessionContext {
    public static defaultContext = new SessionContext({});

    public object: UAObject | UAObjectType | undefined;
    public currentTime?: PreciseClock;
    public continuationPoints: Buffer[] = [];
    public readonly session?: ISessionBase;
    public readonly server?: IServerBase;

    constructor(options?: SessionContextOptions) {
        options = options || {};
        this.session = options.session;
        this.object = options.object;
        this.server = options.server;
        this.currentTime = undefined;
    }

    /**
     * The client's application-instance certificate,
     * or `null` if no secure channel is available.
     */
    public get clientCertificate(): Certificate | null {
        return this.session?.channel?.clientCertificate ?? null;
    }

    /**
     * The application URI extracted from the client
     * certificate's SubjectAltName, or `null` if
     * no certificate is available.
     */
    public get clientApplicationUri(): string | null {
        const cert = this.clientCertificate;
        if (!cert) {
            return null;
        }
        try {
            const info = exploreCertificate(cert);
            const san = info.tbsCertificate.extensions?.subjectAltName;
            return san?.uniformResourceIdentifier?.[0] ?? null;
        } catch {
            return null;
        }
    }

    /** The URL of the Endpoint the Session was created on, or `null` if unknown. */
    public get endpointUrl(): string | null {
        return this.session?.getEndpointUrl?.() ?? null;
    }

    public toJSON(): Record<string, string | null> {
        return {
            userName: this.getUserName(),
            clientApplicationUri: this.clientApplicationUri,
            session: this.session ? this.session.getSessionId().toString() : null
        };
    }

    public toString(): string {
        if (this === SessionContext.defaultContext) {
            return "SessionContext({ default })";
        }
        return `SessionContext({ userName: "${this.getUserName()}", session: ${this.session ? this.session.getSessionId().toString() : "none"} })`;
    }

    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        return this.toString();
    }

    public getUserName(): string {
        if (!this.session) {
            return "<unknown client user id>";
        }
        const userIdentityToken = this.session.userIdentityToken;
        if (!userIdentityToken) {
            return "<unknown client user id>";
        }
        return getUserName(userIdentityToken);
    }
    /**
     * getCurrentUserRoles
     *
     * guest   => anonymous user (unauthenticated)
     * default => default authenticated user
     *
     */
    public getCurrentUserRoles(): NodeId[] {
        if (!this.session) {
            // no Session: an in-process caller. getPermissions grants it everything —
            // an empty list here does NOT mean "no rights", see unresolvedPermissions.
            return [];
        }

        assert(this.session != null, "expecting a session");
        const userIdentityToken = this.session.userIdentityToken;
        if (!userIdentityToken) {
            // a Session that was never activated. Distinct from the case above: this one
            // is remote, and how the empty list is then interpreted depends on
            // IServerBase.unresolvedPermissionPolicy.
            return [];
        }

        const anonymous = makeRoles([WellKnownRoles.Anonymous]);

        const username = getUserName(userIdentityToken);

        // --- US-028: check role policy override first ---
        if (this.server?.rolePolicyOverride) {
            const overriddenRoles = this.server.rolePolicyOverride.getUserRoles(username);
            if (overriddenRoles !== null) {
                return overriddenRoles;
            }
            // null => fall through to default resolution
        }

        if (username === "anonymous") {
            return anonymous;
        }
        if (!this.server?.userManager) {
            return anonymous;
        }

        assert(this.server != null, "expecting a server");

        if (typeof this.server.userManager.getUserRoles !== "function") {
            return anonymous;
        }

        const rolesNodeId = this.server.userManager.getUserRoles(username) || [];

        // OPC 10000-18 §4.4: check registered role resolvers
        if (this.server.roleResolvers && this.session?.userIdentityToken) {
            const resolutionContext: IRoleResolutionContext = {
                applicationUri: this.clientApplicationUri,
                securityMode: this.session.channel?.securityMode,
                securityPolicyUri: this.session.channel?.securityPolicy,
                endpointUrl: this.endpointUrl ?? undefined
            };
            for (const resolver of this.server.roleResolvers) {
                const extra = resolver.resolveRoles(this.session.userIdentityToken, resolutionContext);
                for (const r of extra) {
                    if (!rolesNodeId.find((e) => sameNodeId(e, r))) {
                        rolesNodeId.push(r);
                    }
                }
            }
        }

        if (rolesNodeId.findIndex((r) => r.namespace === 0 && r.value === WellKnownRoles.AuthenticatedUser) < 0) {
            rolesNodeId.push(resolveNodeId(WellKnownRoles.AuthenticatedUser));
        }
        return rolesNodeId;
    }

    public getApplicableRolePermissions(node: BaseNode): RolePermissionType[] | null {
        if (!node.rolePermissions) {
            const namespace = node.namespace as NamespacePrivate;
            const defaultUserRolePermissions = getDefaultUserRolePermissionsOnNamespace(namespace, this);
            return defaultUserRolePermissions;
        }
        return node.rolePermissions;
    }
    /**
     * true when this context carries no Session at all.
     *
     * That is an in-process caller — SessionContext.defaultContext, or a PseudoSession
     * driving the address space from inside the server — not a remote one. Such a caller
     * has already passed whatever authorization its own entry point applies, and the
     * address space is not the place to second-guess it, so it is always granted every
     * permission. This is deliberate, and distinct from a remote Session whose identity
     * merely failed to resolve to a Role: that case is governed by
     * IServerBase.unresolvedPermissionPolicy.
     */
    private get isInProcessCaller(): boolean {
        return !this.session;
    }

    /** what an unresolved permission means for this context: everything, or nothing */
    private get unresolvedPermissions(): PermissionFlag {
        if (this.isInProcessCaller) {
            return allPermissions;
        }
        return this.server?.unresolvedPermissionPolicy === "deny" ? PermissionFlag.None : allPermissions;
    }

    /**
     * the Roles to evaluate permissions against: the ones the user resolved to, plus the
     * Anonymous Role, which every Session stands on.
     *
     * Opc.Ua.NodeSet2.xml names exactly five Roles across its 854 RolePermission entries —
     * Anonymous, SecurityAdmin, ConfigureAdmin and the two SecurityKeyServer ones — and
     * never AuthenticatedUser, Observer, Operator, Engineer or Supervisor. Its 195 Anonymous
     * entries (Browse, Browse|Read, Browse|Call) are therefore not a privilege reserved for
     * unauthenticated Sessions; they are the floor granted to everyone. Read literally, an
     * authenticated user would be unable to browse the Server Object at all, and would have
     * strictly less access than an anonymous one.
     *
     * Adding the Anonymous Role here can only widen a permission set, never narrow it, and
     * only ever to what an unauthenticated Session already has — so it cannot grant anything
     * an attacker could not obtain by simply not authenticating. It leaves
     * getCurrentUserRoles() alone: the identity a Session reports stays truthful, only the
     * permission evaluation gains the baseline.
     */
    private getRolesForPermissionEvaluation(roles: NodeId[]): NodeId[] {
        if (roles.find((role) => sameNodeId(role, anonymousRoleNodeId))) {
            return roles;
        }
        return [...roles, anonymousRoleNodeId];
    }

    public getPermissions(node: BaseNode): PermissionFlag {
        const applicableRolePermissions = this.getApplicableRolePermissions(node);

        const roles = this.getCurrentUserRoles();
        if (roles.length === 0) {
            // Two very different situations land here:
            //  - no Session at all: an in-process caller, always trusted (see isInProcessCaller)
            //  - a Session that resolved to no Role, either because it carries no
            //    UserIdentityToken (it was never activated) or because its user matched
            //    nothing. Permissive by default, for backwards compatibility, but a server
            //    can set unresolvedPermissionPolicy: "deny" to fail closed instead.
            return this.unresolvedPermissions;
        }
        const unresolved = this.unresolvedPermissions;
        let orFlags: PermissionFlag = 0;
        for (const role of this.getRolesForPermissionEvaluation(roles)) {
            orFlags = orFlags | getPermissionForRole(applicableRolePermissions, role, unresolved);
        }
        return orFlags;
    }
    public getAccessRestrictions(node: BaseNode): AccessRestrictionsFlag {
        if (node.accessRestrictions === undefined) {
            const namespace = node.namespace as NamespacePrivate;
            const accessRestrictions = getAccessRestrictionsOnNamespace(namespace, this);
            return accessRestrictions;
        }
        return node.accessRestrictions;
    }

    /**
     *
     * @param node
     * @returns true if the browse is denied (access is restricted)
     */
    public isBrowseAccessRestricted(node: BaseNode): boolean {
        if (this.checkPermission(node, PermissionType.Browse)) {
            return false; // can browse
        }
        return true; // browse restriction
    }
    /**
     *
     * @param node
     * @returns true  if the context is access restricted
     */
    public isAccessRestricted(node: BaseNode): boolean {
        const accessRestrictions = this.getAccessRestrictions(node);
        if (accessRestrictions === AccessRestrictionsFlag.None) {
            return false;
        }
        if (accessRestrictions & AccessRestrictionsFlag.SessionRequired) {
            if (!this.session) {
                return true;
            }
        }
        if (!this.session) {
            return false;
        }
        const securityMode = this.session?.channel?.securityMode;
        if (accessRestrictions & AccessRestrictionsFlag.SigningRequired) {
            if (securityMode !== MessageSecurityMode.Sign && securityMode !== MessageSecurityMode.SignAndEncrypt) {
                return true;
            }
        }
        if (accessRestrictions & AccessRestrictionsFlag.EncryptionRequired) {
            if (securityMode !== MessageSecurityMode.SignAndEncrypt) {
                return true;
            }
        }
        return false;
    }
    /**
     */
    public checkPermission(node: BaseNode, requestedPermission: PermissionType): boolean {
        const permissions = this.getPermissions(node);
        return (permissions & requestedPermission) === requestedPermission;
    }

    public currentUserHasRole(role: NodeIdLike): boolean {
        const currentUserRole = this.getCurrentUserRoles();
        const n = resolveNodeId(role);
        return currentUserRole.findIndex((r) => sameNodeId(r, n)) >= 0;
    }
}
