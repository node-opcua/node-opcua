/**
 * @module node-opcua-address-space
 */

import { assert } from "node-opcua-assert";

// note : use specifically dist file to avoid modules that rely on fs
import { Certificate, CertificateInternals, exploreCertificate } from "node-opcua-crypto";

import { AccessLevelFlag, allPermissions, NodeClass, PermissionFlag } from "node-opcua-data-model";
import { PreciseClock } from "node-opcua-date-time";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { AnonymousIdentityToken, MessageSecurityMode, PermissionType, RolePermissionTypeOptions, UserNameIdentityToken, X509IdentityToken } from "node-opcua-types";
import {
    ISessionContext,
    UAObject,
    UAObjectType,
    UAVariable,
    UAMethod,
    BaseNode,
} from "./address_space_ts";
import { ObjectIds } from "node-opcua-constants";


export { PermissionType } from "node-opcua-types";

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
        assert(userIdentityToken.hasOwnProperty("userName"));
        return userIdentityToken.userName!;
    }
    throw new Error("Invalid user identity token");
}

export interface IChannelBase {
    clientCertificate: Certificate | null;
    // clientNonce: Buffer | null;
    securityMode: MessageSecurityMode;
    securityPolicy: string;
}
/**
 *
 */
export interface ISessionBase {
    userIdentityToken?: UserIdentityToken;

    channel?: IChannelBase;

    getSessionId(): NodeId; // session NodeID
}

export enum WellKnownRoles {
    Anonymous = "Anonymous",
    AuthenticatedUser = "AuthenticatedUser",
    ConfigureAdmin = "ConfigureAdmin",
    Engineer = "Engineer",
    Observer = "Observer",
    Operator = "Operator",
    SecurityAdmin = "SecurityAdmin",
    Supervisor = "Supervisor",
};
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
    getUserRole?: (user: string) => WellKnownRolesSemiColumnSeparated;
}
export interface IServerBase {
    userManager?: IUserManager;
}
export interface SessionContextOptions {
    session?: ISessionBase /* ServerSession */;
    object?: UAObject | UAObjectType;
    server?: IServerBase /* OPCUAServer*/;
}
function getPermissionForRole(
    rolePermissions: RolePermissionTypeOptions[],
    role: NodeIdLike
): PermissionFlag {

    const a = rolePermissions.find((r) => {
        return r.roleId === role;
    });
    return a !== undefined ? a.permissions! | PermissionFlag.None : PermissionFlag.None;
}

export class SessionContext implements ISessionContext {
    public static defaultContext = new SessionContext({});

    public object: any;
    public currentTime?: PreciseClock;
    public continuationPoints: any = {};
    public userIdentity: any;
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
     * getCurrentUserRole
     *
     * guest   => anonymous user (unauthenticated)
     * default => default authenticated user
     *
     */
    public getCurrentUserRole(): string {
        if (!this.session) {
            return "default"; // default context => no Session
        }

        assert(this.session != null, "expecting a session");
        const userIdentityToken = this.session.userIdentityToken;
        if (!userIdentityToken) {
            throw new Error("session object must provide a userIdentityToken");
        }

        const username = getUserName(userIdentityToken);

        if (username === "anonymous") {
            return "Anonymous";
        }
        if (!this.server || !this.server.userManager) {
            return "Anonymous";
        }

        assert(this.server != null, "expecting a server");

        if (typeof this.server.userManager.getUserRole !== "function") {
            return "Anonymous";
        }
        return this.server.userManager.getUserRole(username);
    }

    public getPermissions(node: BaseNode): PermissionFlag {
        if (!node.rolePermissions) {
            // todo check permissions on namespace 
            return allPermissions; // no permission specified => all access
        }

        const roles = this.getCurrentUserRole();
        if (roles === "default") {
            return allPermissions;
        }

        let orFlags: PermissionFlag = 0;
        for (const role of roles.split(";")) {
            // to do : improve with nodeId
            orFlags = orFlags | getPermissionForRole(node.rolePermissions, role);
        }
        return orFlags;
    }
    /**
     * @method checkPermission
     * @param node
     * @param requestedPermission
     * @return {Boolean}
     */
    public checkPermission(node: UAMethod | UAVariable, requestedPermission: PermissionType): boolean {
        const permissions = this.getPermissions(node);
        return (permissions & requestedPermission) === requestedPermission;
    }
}
