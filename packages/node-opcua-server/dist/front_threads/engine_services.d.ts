/**
 * @module node-opcua-server
 *
 * The services of the server engine that a front asks the engine to run for one of its sessions
 * (Read, Write, Browse, TranslateBrowsePaths, Call, HistoryRead), with their request and results
 * as binary encodings.
 */
import { type CompactAddressSpace } from "node-opcua-address-space";
import type { ServerEngine } from "../server_engine.js";
import type { FrontSessions } from "./front_sessions.js";
import { type ServiceKind } from "./protocol.js";
export declare class EngineServices {
    #private;
    constructor(serverEngine: ServerEngine, sessions: FrontSessions, addressSpace: CompactAddressSpace);
    /** a service of the server engine, for a session of a front: its request and its results as their binary encoding */
    run(service: ServiceKind, token: string | null, bytes: Uint8Array): Promise<unknown>;
}
//# sourceMappingURL=engine_services.d.ts.map