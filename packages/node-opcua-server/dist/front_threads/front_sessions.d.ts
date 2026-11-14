/**
 * @module node-opcua-server
 *
 * The sessions of the front threads, kept by the engine: every session a front creates has its
 * record here, a ServerSession of the engine's ServerEngine. That record is what the server
 * counts against its limits, what its diagnostics nodes show, and what times the session out.
 * The front that holds the session's channel keeps a ServerSession of its own for the requests;
 * a client that comes back through another front finds its session there, moved over.
 */
import type { Worker } from "node:worker_threads";
import type { ISessionContext } from "node-opcua-address-space";
import { type CallMethodResultOptions } from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import type { ClosingReason, ServerEngine } from "../server_engine.js";
import { type SessionActivation, type SessionRecord, type SessionState } from "./protocol.js";
export declare class FrontSessions {
    #private;
    constructor(engine: ServerEngine, counts: SharedArrayBuffer);
    /** the engine-wide counts the fronts read in place */
    publishCounts(): void;
    /** the session workers that host the subscriptions of the sessions */
    setWorkers(workers: Worker[]): void;
    /** the context of a session's requests: its record's, which carries the roles its front resolved */
    contextOf(token: string | null): ISessionContext | null;
    /** OPC 10000-4 5.6.2: when the server is full, the oldest session not activated is closed to make room */
    admit(): boolean;
    /** the room admit() made, given back: the session it was for closed before created() */
    cancelAdmission(): void;
    /** a session a front created: its record here, its subscriptions on the least loaded session worker */
    created(front: Worker, record: SessionRecord): number;
    activated(front: Worker, activation: SessionActivation): void;
    close(front: Worker, token: string, deleteSubscriptions: boolean, reason: ClosingReason): void;
    /** the sessions a front used in a turn: their watchdog, and the counters of their diagnostics */
    activity(seen: string[], counters: [string, string, number][], rejected: number, securityRejected: number, rejectedRequests: number): void;
    /** the Subscriptions and MonitoredItems a session worker created or deleted, by session token */
    subscriptionsChanged(changes: [string, number, number, number][]): void;
    /**
     * a Server method about one Subscription (subscription_methods.ts), called in the engine by a
     * session of the fronts: run by the session worker that hosts the session's Subscriptions. The
     * Subscription is checked first as the method does it, with the ids the workers reported. Null for a
     * session the fronts do not serve.
     */
    callSubscriptionMethod(methodId: number, inputArguments: Variant[], context: ISessionContext): Promise<CallMethodResultOptions> | null;
    /** a session worker's answer to callSubscriptionMethod */
    subscriptionMethodCalled(id: number, result: Uint8Array): void;
    /**
     * a front goes on with a session another front holds: that one sets it aside and sends its state.
     * The session is that front's again if the ActivateSession is refused (returned), and forgotten
     * there once it is activated (activated).
     */
    take(front: Worker, token: string): Promise<SessionState | null>;
    /** the ActivateSession that took a session was refused: the front it came from goes on with it */
    returned(front: Worker, token: string): void;
    released(id: number, state: SessionState | null): void;
    /** the fronts are gone (shutdown): no release will be answered */
    frontsGone(): void;
    /**
     * a front ended: what waited on it is answered, and its sessions close. Their subscriptions are
     * kept, for the client to take them over with TransferSubscriptions from a session of another front.
     */
    frontGone(front: Worker): void;
    /** a session worker ended: its pending calls fail, its sessions close (their subscriptions went with it), no new session goes there */
    workerGone(index: number): void;
}
//# sourceMappingURL=front_sessions.d.ts.map