/**
 * @module node-opcua-server
 *
 * The server of a front thread: every service of an OPCUAServer, over a RemoteEngine. The front
 * listens, secures channels and encodes; the one server behind it is the engine thread's, so
 * that every front shows the same address space, sessions and diagnostics.
 */
import type { MessagePort } from "node:worker_threads";
import type { EventTypeLike, RaiseEventData, UAObjectType } from "node-opcua-address-space";
import { type Message, type ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { OPCUAServerCore, type OPCUAServerOptions } from "../opcua_server.js";
import type { OPCUAServerEndPoint } from "../server_end_point.js";
import type { ServerEngineOptions } from "../server_engine.js";
import type { ServerSession } from "../server_session.js";
import type { RemoteEngine } from "./remote_engine.js";
export declare class FrontOPCUAServer extends OPCUAServerCore<RemoteEngine> {
    #private;
    constructor(options: OPCUAServerOptions, engine: RemoteEngine, workers: MessagePort[]);
    /** the Reads of items served in place are answered from the bytes of the request */
    protected leanRequestHandler(): OPCUAServerEndPoint["leanRequestHandler"];
    /** a session taken from another front for this ActivateSession goes back there */
    protected activationRefused(session: ServerSession): Promise<void> | undefined;
    /** the engine records the activation (user, roles, diagnostics) before the client hears of it */
    protected recordActivation(session: ServerSession): Promise<void> | undefined;
    /** the subscription services go to the session worker of the session, the others are served here */
    on_request(message: Message, channel: ServerSecureChannelLayer): void;
    protected createEngine(_options: ServerEngineOptions): RemoteEngine;
    /** the address space, its role sets and its structures are the engine's */
    protected afterEngineInitialized(): Error | null;
    /** raised on the engine's Server object, where every subscriber of every front sees it */
    raiseEvent(eventType: EventTypeLike | UAObjectType, options: RaiseEventData): void;
    /** a session another front holds comes here first: an ActivateSession on a channel of this front */
    protected _on_ActivateSessionRequest(message: Message, channel: ServerSecureChannelLayer): void;
}
//# sourceMappingURL=front_opcua_server.d.ts.map