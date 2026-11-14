/**
 * @module node-opcua-server
 */
import { type ISessionBase, SessionContext } from "node-opcua-address-space";
import { type NodeId } from "node-opcua-nodeid";
import type { ServerSession } from "../server_session.js";
import type { ContextDescriptor } from "./protocol.js";
/**
 * the context of a session kept in a thread without the user manager (the engine, a session
 * worker): the roles of its user are the ones the front resolved when the session was activated
 */
export declare class ResolvedRolesContext extends SessionContext {
    #private;
    constructor(session: ServerSession | ISessionBase, roles: NodeId[]);
    getCurrentUserRoles(): NodeId[];
}
/**
 * the context of a session described by its roles alone (a ContextDescriptor): a whole
 * SessionContext, for the checks that need one (the ReceiveEvents permission of an event)
 */
export declare class RolesContext extends SessionContext {
    #private;
    constructor(descriptor: ContextDescriptor);
    getCurrentUserRoles(): NodeId[];
}
//# sourceMappingURL=resolved_roles_context.d.ts.map