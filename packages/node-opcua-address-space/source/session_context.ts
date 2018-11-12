import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { AccessLevelFlag, makeAccessLevelFlag } from "node-opcua-data-model";
import { BaseNode, ISessionContext } from "./address_space_ts";

type UserIdentityToken = any;

function getUserName(userIdentityToken: UserIdentityToken) {
    if (userIdentityToken.policyId === "anonymous") {
        return "anonymous";
    }
    assert(userIdentityToken.hasOwnProperty("userName"));
    return userIdentityToken.userName;
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
     */
    public getCurrentUserRole(): string {

        assert(this.session != null, "expecting a session");
        assert(this.server != null, "expecting a server");

        const userIdentityToken = this.session.userIdentityToken;

        const username = getUserName(userIdentityToken);

        if (username === "anonymous") {
            return "guest";
        }
        if (!this.server || !this.server.userManager) {
            return "default";
        }

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
    public checkPermission(node: BaseNode, action: string) {

        // tslint:disable:no-bitwise
        const lNode = node as any;

        assert(action === "CurrentRead" || action === "CurrentWrite");
        const actionFlag = makeAccessLevelFlag(action);

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
