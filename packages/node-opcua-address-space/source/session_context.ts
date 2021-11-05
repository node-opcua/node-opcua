/**
 * @module node-opcua-address-space
 */

import { assert } from "node-opcua-assert";
import { CertificateInternals, exploreCertificate } from "node-opcua-crypto";
import { AccessRestrictionsFlag, allPermissions, AttributeIds, PermissionFlag } from "node-opcua-data-model";
import { PreciseClock } from "node-opcua-date-time";
import { NodeId, NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import {
    AnonymousIdentityToken,
    MessageSecurityMode,
    PermissionType,
    RolePermissionType,
    UserNameIdentityToken,
    X509IdentityToken
} from "node-opcua-types";
import { ISessionContext, UAObject, UAObjectType, UAVariable, BaseNode, ISessionBase } from "node-opcua-address-space-base";
import { ObjectIds } from "node-opcua-constants";
import { StatusCodes } from "node-opcua-status-code";
import { NamespacePrivate } from "../src/namespace_private";

export { RolePermissionType, RolePermissionTypeOptions, PermissionType } from "node-opcua-types";

type UserIdentityToken = UserNameIdentityToken | AnonymousIdentityToken | X509IdentityToken;

function getUserName(userIdentityToken: UserIdentityToken): string {
    if (userIdentityToken instanceof AnonymousIdentityToken) {
        return "anonymous";
    }
    if (userIdentityToken instanceof X509IdentityToken) {
        const certInfo: CertificateInternals = exploreCertificate(userIdentityToken.certificateData);
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
        assert(Object.prototype.hasOwnProperty.call(userIdentityToken, "userName"));
        return userIdentityToken.userName!;
    }
    throw new Error("Invalid user identity token");
}

/**
 *
 */

export enum WellKnownRoles {
    Anonymous = ObjectIds.WellKnownRole_Anonymous,
    AuthenticatedUser = ObjectIds.WellKnownRole_AuthenticatedUser,
    ConfigureAdmin = ObjectIds.WellKnownRole_ConfigureAdmin,
    Engineer = ObjectIds.WellKnownRole_Engineer,
    Observer = ObjectIds.WellKnownRole_Observer,
    Operator = ObjectIds.WellKnownRole_Operator,
    SecurityAdmin = ObjectIds.WellKnownRole_SecurityAdmin,
    Supervisor = ObjectIds.WellKnownRole_Supervisor
}
export enum WellKnownRolesNodeId {
    Anonymous = ObjectIds.WellKnownRole_Anonymous,
    AuthenticatedUser = ObjectIds.WellKnownRole_AuthenticatedUser,
    ConfigureAdmin = ObjectIds.WellKnownRole_ConfigureAdmin,
    Engineer = ObjectIds.WellKnownRole_Engineer,
    Observer = ObjectIds.WellKnownRole_Observer,
    Operator = ObjectIds.WellKnownRole_Operator,
    SecurityAdmin = ObjectIds.WellKnownRole_SecurityAdmin,
    Supervisor = ObjectIds.WellKnownRole_Supervisor
}
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
export interface IServerBase {
    userManager?: IUserManager;
}

export interface SessionContextOptions {
    session?: ISessionBase /* ServerSession */;
    object?: UAObject | UAObjectType;
    server?: IServerBase /* OPCUAServer*/;
}

function getPermissionForRole(rolePermissions: RolePermissionType[] | null, role: NodeId): PermissionFlag {
    if (rolePermissions === null) {
        return allPermissions;
    }
    const a = rolePermissions.find((r) => {
        return sameNodeId(resolveNodeId(r.roleId!), role);
    });
    return a !== undefined ? a.permissions! | PermissionFlag.None : PermissionFlag.None;
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
        if (dataValue && dataValue.statusCode === StatusCodes.Good) {
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
    if (!namespaces) {
        return null;
    }
    const uaNamespaceObject = namespaces.getChildByName(namespace.namespaceUri);
    if (!uaNamespaceObject) {
        return null;
    }
    const defaultUserRolePermissions = uaNamespaceObject.getChildByName("DefaultUserRolePermissions") as UAVariable;
    if (defaultUserRolePermissions) {
        const dataValue = defaultUserRolePermissions.readValue();
        if (dataValue && dataValue.statusCode === StatusCodes.Good && dataValue.value.value && dataValue.value.value.length > 0) {
            return dataValue.value.value as RolePermissionType[];
        }
    }
    const defaultRolePermissions = uaNamespaceObject.getChildByName("DefaultRolePermissions") as UAVariable;
    if (defaultRolePermissions) {
        const dataValue = defaultRolePermissions.readValue();
        if (dataValue && dataValue.statusCode === StatusCodes.Good) {
            return dataValue.value.value as RolePermissionType[] | null;
        }
    }
    return null;
}

export function makeRoles(roleIds: NodeIdLike[] | string | WellKnownRoles): NodeId[] {
    if (typeof roleIds === "number") {
        roleIds = [roleIds];
    }
    if (typeof roleIds === "string") {
        roleIds = roleIds.split(";").map((r) => resolveNodeId("WellKnownRole_" + r));
    }
    return roleIds.map((r) => resolveNodeId(r));
}
export class SessionContext implements ISessionContext {
    public static defaultContext = new SessionContext({});

    public object: any;
    public currentTime?: PreciseClock;
    public continuationPoints: any = {};
    public userIdentity?: string;
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
     * getCurrentUserRoles
     *
     * guest   => anonymous user (unauthenticated)
     * default => default authenticated user
     *
     */
    public getCurrentUserRoles(): NodeId[] {
        if (!this.session) {
            return []; // default context => no Session
        }

        assert(this.session != null, "expecting a session");
        const userIdentityToken = this.session.userIdentityToken;
        if (!userIdentityToken) {
            return [];
        }

        const anonymous = makeRoles([WellKnownRoles.Anonymous]);

        const username = getUserName(userIdentityToken);

        if (username === "anonymous") {
            return anonymous;
        }
        if (!this.server || !this.server.userManager) {
            return anonymous;
        }

        assert(this.server != null, "expecting a server");

        if (typeof this.server.userManager.getUserRoles !== "function") {
            return anonymous;
        }

        const rolesNodeId = this.server.userManager.getUserRoles(username);

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
    public getPermissions(node: BaseNode): PermissionFlag {
        const applicableRolePermissions = this.getApplicableRolePermissions(node);

        const roles = this.getCurrentUserRoles();
        if (roles.length === 0) {
            return allPermissions;
        }
        let orFlags: PermissionFlag = 0;
        for (const role of roles) {
            orFlags = orFlags | getPermissionForRole(applicableRolePermissions, role);
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
     * @method checkPermission
     * @param node
     * @param requestedPermission
     * @return {Boolean} returns true of the current user is granted the requested Permission
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
