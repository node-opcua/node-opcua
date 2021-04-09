/**
 * @module node-opcua-address-space
 */

import { assert } from "node-opcua-assert";

// note : use specifically dist file to avoid modules that rely on fs
import { Certificate, CertificateInternals, exploreCertificate } from "node-opcua-crypto";

import { AccessLevelFlag, NodeClass } from "node-opcua-data-model";
import { PreciseClock } from "node-opcua-date-time";
import { NodeId } from "node-opcua-nodeid";
import { AnonymousIdentityToken, MessageSecurityMode, PermissionType, UserNameIdentityToken, X509IdentityToken } from "node-opcua-types";
import { UAVariable as UAVariablePrivate } from "../src/ua_variable";
import { UAMethod as UAMethodPrivate } from "../src/ua_method";
import {
    ISessionContext,
    UAObject,
    UAObjectType,
    UAVariable,
    UAMethod,
    Permission
} from "./address_space_ts";

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
    Observer = "Observer",
    Operator = "Operator",
    Engineer = "Engineer",
    Supervisor = "Supervisor",
    ConfigureAdmin = "ConfigureAdmin",
    SecurityAdmin = "SecurityAdmin"
};

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
export type WellKnownRolesSemiColumnSeperated = string;
export interface IUserManager {
    /**  
     * retrieve the roles of the given user
     *  @returns semicolon separated list of roles
     */
    getUserRole?: (user: string) => WellKnownRolesSemiColumnSeperated;
}
export interface IServerBase {
    userManager?: IUserManager;
}
export interface SessionContextOptions {
    session?: ISessionBase /* ServerSession */;
    object?: UAObject | UAObjectType;
    server?: IServerBase /* OPCUAServer*/;
}

function hasOneRoleDenied(permission: string[], roles: string[]): boolean {
    for (const role of roles) {
        const str = "!" + role;
        if (permission.findIndex((x: string) => x === str) >= 0) {
            return true; // user is explicitly denied
        }
    }
    return false;
}
function hasOneRoleAllowed(permission: string[], roles: string[]) {
    for (const role of roles) {
        const str = role;
        if (permission.findIndex((x: string) => x === str) >= 0) {
            return true; // user is explicitly denied
        }
    }
    return false;
}

function toPermissionKey(perm: PermissionType): keyof typeof Permission {
    return PermissionType[perm] as (keyof typeof Permission);
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
            return "default";
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

    /**
     * @method checkPermission
     * @param node
     * @param permission
     * @return {Boolean}
     */
    public checkPermission(node: UAMethod | UAVariable, permission: PermissionType): boolean {
        let permissionRole: string[] | undefined = undefined;
        const permissionKey = toPermissionKey(permission);
        const userRole = this.getCurrentUserRole();
        if (node.nodeClass === NodeClass.Variable) {
            const nodeVariable = node as UAVariablePrivate;
            permissionRole = nodeVariable._permissions
                ? nodeVariable._permissions[permissionKey as (keyof typeof nodeVariable._permissions)]
                : undefined;
            if (!permissionRole /* || userRole === "default" */) {
                switch (permission) {
                    case PermissionType.Read:
                        return (nodeVariable.userAccessLevel & AccessLevelFlag.CurrentRead) === AccessLevelFlag.CurrentRead;
                    case PermissionType.Write:
                        return (nodeVariable.userAccessLevel & AccessLevelFlag.CurrentWrite) === AccessLevelFlag.CurrentWrite;
                    case PermissionType.InsertHistory:
                    case PermissionType.DeleteHistory:
                    case PermissionType.ModifyHistory:
                        return (nodeVariable.userAccessLevel & AccessLevelFlag.HistoryWrite) === AccessLevelFlag.HistoryWrite;
                    case PermissionType.ReadHistory:
                        return (nodeVariable.userAccessLevel & AccessLevelFlag.HistoryRead) === AccessLevelFlag.HistoryRead;
                }
            }
        } else if (node.nodeClass === NodeClass.Method) {
            const nodeMethod = node as UAMethodPrivate;
            permissionRole = nodeMethod._permissions
                ? nodeMethod._permissions[permissionKey as (keyof typeof nodeMethod._permissions)]
                : undefined;
            if (!permissionRole || userRole === "default") {
                return nodeMethod.getExecutableFlag(this);
            }
        } else {
            throw new Error("checkPermission node should be a UAVariable or a UAMethod");
        }
        if (!permissionRole) {
            return false;
        }
        const roles = userRole.split(";");
        if (permissionRole[0] === "*") {
            // accept all except...
            return !hasOneRoleDenied(permissionRole, roles);
        } else {
            // deny all except
            return hasOneRoleAllowed(permissionRole, roles) && !hasOneRoleDenied(permissionRole, roles);
        }
    }
}
