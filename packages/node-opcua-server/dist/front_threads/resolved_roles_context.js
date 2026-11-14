/**
 * @module node-opcua-server
 */
import { SessionContext } from "node-opcua-address-space";
import { resolveNodeId } from "node-opcua-nodeid";
/**
 * the context of a session kept in a thread without the user manager (the engine, a session
 * worker): the roles of its user are the ones the front resolved when the session was activated
 */
export class ResolvedRolesContext extends SessionContext {
    #roles;
    constructor(session, roles) {
        super({ session });
        this.#roles = roles;
    }
    getCurrentUserRoles() {
        return this.#roles;
    }
}
/**
 * the context of a session described by its roles alone (a ContextDescriptor): a whole
 * SessionContext, for the checks that need one (the ReceiveEvents permission of an event)
 */
export class RolesContext extends SessionContext {
    #roles;
    constructor(descriptor) {
        // no session: an in-process caller, granted everything; a session that is only its channel's security mode otherwise
        super(descriptor.session
            ? { session: { channel: { securityMode: descriptor.securityMode } } }
            : {});
        this.#roles = descriptor.roles.map((role) => resolveNodeId(role));
    }
    getCurrentUserRoles() {
        return this.#roles;
    }
}
//# sourceMappingURL=resolved_roles_context.js.map