/**
 * @module node-opcua-address-space
 */
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { CertificateInternals , exploreCertificate} from "node-opcua-crypto";
import { AccessLevelFlag, makeAccessLevelFlag } from "node-opcua-data-model";
import { AnonymousIdentityToken, UserNameIdentityToken, X509IdentityToken } from "node-opcua-types";

import { BaseNode,  ISessionContext, UAObject , UAObjectType} from "./address_space_ts";

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

export interface ISessionBase {
    userIdentityToken?: UserIdentityToken;
}

/**
 * OPC Unified Architecture, Part 3 13 Release 1.04
 * 4.8.2 Well Known Roles
 * All Servers should support the well-known Roles which are defined in Table 2. The NodeIds
 * for the well-known Roles are defined in Part 6.
 * Table 2 – Well-Known Roles
 * BrowseName           Suggested Permissions
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
 */
export interface IUserManager {
    getUserRole?: (user: string) => string;
}
export interface IServerBase {
    userManager?: IUserManager;
}
export interface SessionContextOptions {
    session?: ISessionBase;  /* ServerSession */
    object?: UAObject | UAObjectType;
    server?: IServerBase;   /* OPCUAServer*/
}

export class SessionContext implements ISessionContext {

    public static defaultContext = new SessionContext({});

    public object: any;
    public currentTime?: Date;
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
            return "guest";
        }
        if (!this.server || !this.server.userManager) {
            return "default";
        }

        assert(this.server != null, "expecting a server");

        if (!_.isFunction(this.server.userManager.getUserRole)) {
            return "default";
        }
        return this.server.userManager.getUserRole(username);
    }

    /**
     * @method checkPermission
     * @param node
     * @param action
     * @return {Boolean}
     */
    public checkPermission(node: BaseNode, action: string): boolean {

        // tslint:disable:no-bitwise
        const lNode = node as any;

        assert(AccessLevelFlag.hasOwnProperty(action));
        const actionFlag: number = makeAccessLevelFlag(action);

        if (!lNode._permissions) {
            return (lNode.userAccessLevel & actionFlag) === actionFlag;
        }

        const permission: string[] = lNode._permissions[action];

        if (!permission) {
            return (lNode.userAccessLevel & actionFlag) === actionFlag;
        }

        const userRole = this.getCurrentUserRole();

        if (userRole === "default") {
            return (lNode.userAccessLevel & actionFlag) === actionFlag;
        }

        if (permission[0] === "*") {
            // accept all except...
            const str = "!" + userRole;
            if (permission.findIndex((x: string) => x === str) >= 0) {
                return false; // user is explicitly denied
            }
            return true;
        } else {
            // deny all, unless specify
            if (permission.findIndex((x: string) => x === userRole) >= 0) {
                return true; // user is explicitly denied
            }
            return false;
        }
    }
}
