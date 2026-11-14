/**
 * @module node-opcua-server
 *
 * The events and the values of the node objects that the session workers monitor: the engine
 * listens on the node objects and sends each worker what its items selected, one message per
 * worker and turn of the event loop.
 */
import type { Worker } from "node:worker_threads";
import type { ServerEngine } from "../server_engine.js";
import type { FrontSessions } from "./front_sessions.js";
import { type FrontRequest } from "./protocol.js";
export declare class EventWatches {
    #private;
    constructor(serverEngine: ServerEngine, sessions: FrontSessions);
    unwatchEvents(worker: Worker, id: number): void;
    /** a worker that ended: it listens to nothing any longer */
    workerGone(worker: Worker): void;
    stopAll(): void;
    /**
     * the events of a node object for an event item of a worker: filtered here, where the address
     * space is, with the item's filter and the roles of its session; the selected fields go to the worker
     */
    watchEvents(worker: Worker, request: Extract<FrontRequest, {
        kind: "watchEvents";
    }>): void;
    /** a node object a session worker monitors: the values written to it go to that worker */
    watchObject(worker: Worker, nodeId: string): void;
    unwatchObject(worker: Worker, nodeId: string): void;
}
//# sourceMappingURL=event_watches.d.ts.map