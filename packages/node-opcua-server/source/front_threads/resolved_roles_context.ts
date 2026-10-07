/**
 * @module node-opcua-server
 */
import { type ISessionBase, SessionContext } from "node-opcua-address-space";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import type { MessageSecurityMode } from "node-opcua-types";
import type { ServerSession } from "../server_session.js";
import type { ContextDescriptor } from "./protocol.js";

/**
 * the context of a session kept in a thread without the user manager (the engine, a session
 * worker): the roles of its user are the ones the front resolved when the session was activated
 */
export class ResolvedRolesContext extends SessionContext {
    readonly #roles: NodeId[];
    constructor(session: ServerSession | ISessionBase, roles: NodeId[]) {
        super({ session });
        this.#roles = roles;
    }
    public override getCurrentUserRoles(): NodeId[] {
        return this.#roles;
    }
}

/**
 * the context of a session described by its roles alone (a ContextDescriptor): a whole
 * SessionContext, for the checks that need one (the ReceiveEvents permission of an event)
 */
export class RolesContext extends SessionContext {
    readonly #roles: NodeId[];
    constructor(descriptor: ContextDescriptor) {
        // no session: an in-process caller, granted everything; a session that is only its channel's security mode otherwise
        super(
            descriptor.session
                ? { session: { channel: { securityMode: descriptor.securityMode as MessageSecurityMode } } as never }
                : {}
        );
        this.#roles = descriptor.roles.map((role) => resolveNodeId(role));
    }
    public override getCurrentUserRoles(): NodeId[] {
        return this.#roles;
    }
}
