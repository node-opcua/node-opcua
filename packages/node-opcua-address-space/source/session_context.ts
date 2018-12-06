import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { CertificateInternals , exploreCertificate} from "node-opcua-crypto";
import { AccessLevelFlag, makeAccessLevelFlag } from "node-opcua-data-model";
import { AnonymousIdentityToken, UserNameIdentityToken, X509IdentityToken } from "node-opcua-types";

import { BaseNode, ISessionContext } from "./address_space_ts";

type UserIdentityToken = UserNameIdentityToken | AnonymousIdentityToken | X509IdentityToken;

function getUserName(userIdentityToken: UserIdentityToken) {
    if (userIdentityToken instanceof AnonymousIdentityToken) {
        return "anonymous";
    }
    if (userIdentityToken instanceof X509IdentityToken) {
        const certInfo: CertificateInternals = exploreCertificate(userIdentityToken.certificateData);
        const userName = certInfo.tbsCertificate.subject.commonName;
        return userName;
    }
    if (userIdentityToken instanceof UserNameIdentityToken) {
        if (userIdentityToken.policyId === "anonymous") {
            return "anonymous";
        }
        assert(userIdentityToken.hasOwnProperty("userName"));
        return userIdentityToken.userName;
    }
    throw new Error("Invalid user identity token");
}

export interface SessionContextOptions {
    session?: any;
    object?: any;
    server?: any;
}

/**
 * @class SessionContext
 * @param options
 * @param [options.session=null] {Session}
 * @param [options.object=null] {Session}
 * @param [options.server=null] {OPCUAServer}
 * @constructor
 */
export class SessionContext implements ISessionContext {

    public static defaultContext = new SessionContext({});

    private readonly session: any;
    private readonly object: any;
    private readonly server: any;

    constructor(options: SessionContextOptions) {
        options = options || {};
        this.session = options.session;
        this.object = options.object;
        this.server = options.server;
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

        assert(action === "CurrentRead" || action === "CurrentWrite");
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
