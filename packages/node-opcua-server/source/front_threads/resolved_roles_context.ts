/**
 * @module node-opcua-server
 */
import { SessionContext } from "node-opcua-address-space";
import type { NodeId } from "node-opcua-nodeid";
import type { ServerSession } from "../server_session.js";

/**
 * the context of a session kept in a thread without the user manager (the engine, a session
 * worker): the roles of its user are the ones the front resolved when the session was activated
 */
export class ResolvedRolesContext extends SessionContext {
    readonly #roles: NodeId[];
    constructor(session: ServerSession, roles: NodeId[]) {
        super({ session });
        this.#roles = roles;
    }
    public override getCurrentUserRoles(): NodeId[] {
        return this.#roles;
    }
}
