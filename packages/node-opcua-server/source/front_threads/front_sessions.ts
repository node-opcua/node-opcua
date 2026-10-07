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
import { type ISessionContext, SessionContext } from "node-opcua-address-space";
import { BinaryStream } from "node-opcua-binary-stream";
import { make_warningLog } from "node-opcua-debug";
import { decodeExtensionObject } from "node-opcua-extension-object";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { ApplicationDescription, EndpointDescription, type MessageSecurityMode, type UserIdentityToken } from "node-opcua-types";
import type { ClosingReason, ServerEngine } from "../server_engine.js";
import type { ServerSession, SessionChannelSecurity } from "../server_session.js";
import {
    type ChannelSecurityDescriptor,
    decodeStructure,
    EngineCount,
    type EngineToFront,
    type SessionActivation,
    type SessionRecord,
    type SessionState
} from "./protocol.js";

const warningLog = make_warningLog("front_sessions");

/** the context of a session whose user's roles its front resolved: the user manager stays in the front */
class ResolvedRolesContext extends SessionContext {
    readonly #roles: NodeId[];
    constructor(session: ServerSession, roles: NodeId[]) {
        super({ session });
        this.#roles = roles;
    }
    public override getCurrentUserRoles(): NodeId[] {
        return this.#roles;
    }
}

function securityOf(descriptor: ChannelSecurityDescriptor): SessionChannelSecurity {
    return {
        securityMode: descriptor.securityMode as MessageSecurityMode,
        securityPolicy: descriptor.securityPolicy,
        clientCertificate: descriptor.clientCertificate ? Buffer.from(descriptor.clientCertificate) : null
    };
}

interface Entry {
    session: ServerSession;
    front: Worker;
    record: SessionRecord;
    activation: SessionActivation | null;
}

export class FrontSessions {
    readonly #engine: ServerEngine;
    readonly #counts: Int32Array;
    readonly #entries = new Map<string, Entry>();
    /** sessions admitted and not created yet: they count against maxSessions */
    #reserved = 0;
    #releaseId = 0;
    readonly #releases = new Map<number, (state: SessionState | null) => void>();
    // the reason of a close the registry asked for, for the front to hear the right one
    readonly #closing = new Map<string, string>();

    constructor(engine: ServerEngine, counts: SharedArrayBuffer) {
        this.#engine = engine;
        this.#counts = new Int32Array(counts);
        this.publishCounts();
    }

    /** the engine-wide counts the fronts read in place */
    public publishCounts(): void {
        const engine = this.#engine;
        const counts = this.#counts;
        Atomics.store(counts, EngineCount.Sessions, engine.currentSessionCount);
        Atomics.store(counts, EngineCount.Subscriptions, engine.currentSubscriptionCount);
        Atomics.store(counts, EngineCount.RejectedSessions, engine.rejectedSessionCount);
        Atomics.store(counts, EngineCount.RejectedRequests, engine.rejectedRequestsCount);
        Atomics.store(counts, EngineCount.SessionAborts, engine.sessionAbortCount);
        Atomics.store(counts, EngineCount.PublishingIntervals, engine.publishingIntervalCount);
        Atomics.store(counts, EngineCount.ServerState, engine.getServerState());
    }

    /** the context of a session's requests: its record's, which carries the roles its front resolved */
    public contextOf(token: string | null): ISessionContext | null {
        if (token === null) return null;
        return this.#entries.get(token)?.session.sessionContext ?? null;
    }

    /** OPC 10000-4 5.6.2: when the server is full, the oldest session not activated is closed to make room */
    public admit(): boolean {
        const engine = this.#engine;
        const max = engine.serverCapabilities.maxSessions;
        if (engine.currentSessionCount + this.#reserved >= max) {
            const oldest = engine.getOldestInactiveSession();
            if (oldest) {
                this.#closing.set(oldest.authenticationToken.toString(), "Forcing");
                engine.closeSession(oldest.authenticationToken, false, "Forcing");
            }
        }
        if (engine.currentSessionCount + this.#reserved >= max) {
            return false;
        }
        this.#reserved++;
        return true;
    }

    public created(front: Worker, record: SessionRecord): void {
        this.#reserved = Math.max(0, this.#reserved - 1);
        const session = this.#engine.createSession({
            clientDescription: decodeStructure(record.clientDescription, new ApplicationDescription()),
            sessionTimeout: record.sessionTimeout,
            ids: { nodeId: resolveNodeId(record.nodeId), authenticationToken: resolveNodeId(record.token) }
        });
        session.sessionName = record.sessionName;
        session.endpoint = record.endpoint ? decodeStructure(record.endpoint, new EndpointDescription()) : undefined;
        session.remoteChannelSecurity = securityOf(record.security);
        session.sessionContext = new ResolvedRolesContext(session, []);
        this.#entries.set(record.token, { session, front, record, activation: null });
        session.once("session_closed", () => this.#closed(record.token));
        this.publishCounts();
    }

    public activated(front: Worker, activation: SessionActivation): void {
        const entry = this.#entries.get(activation.token);
        if (!entry) return;
        entry.front = front;
        entry.activation = activation;
        const session = entry.session;
        session.userIdentityToken = activation.userIdentityToken
            ? ((decodeExtensionObject(new BinaryStream(Buffer.from(activation.userIdentityToken))) as UserIdentityToken | null) ??
              undefined)
            : undefined;
        session.remoteChannelSecurity = securityOf(activation.security);
        session.sessionContext = new ResolvedRolesContext(
            session,
            activation.roles.map((role) => resolveNodeId(role))
        );
        session.setLocaleIds(activation.localeIds);
        // the diagnostics nodes of the session are created as it becomes active
        session.status = "active";
        this.publishCounts();
    }

    public close(token: string, deleteSubscriptions: boolean, reason: ClosingReason): void {
        const entry = this.#entries.get(token);
        if (!entry) return;
        // the front closed it itself: nothing to tell it
        this.#closing.set(token, "");
        this.#engine.closeSession(entry.session.authenticationToken, deleteSubscriptions, reason);
    }

    /** the sessions a front used in a turn: their watchdog, and the counters of their diagnostics */
    public activity(
        seen: string[],
        counters: [string, string, number][],
        rejected: number,
        securityRejected: number,
        rejectedRequests: number
    ): void {
        const engine = this.#engine;
        for (let k = 0; k < rejected; k++) engine.incrementRejectedSessionCount();
        for (let k = 0; k < securityRejected; k++) engine.incrementSecurityRejectedSessionCount();
        for (let k = 0; k < rejectedRequests; k++) engine.incrementRejectedRequestsCount();
        for (const token of seen) this.#entries.get(token)?.session.keepAlive();
        for (const [token, counter, error] of counters) {
            const session = this.#entries.get(token)?.session;
            if (!session) continue;
            if (counter === "") {
                session.incrementTotalRequestCount();
            } else if (error) {
                session.incrementRequestErrorCounter(counter);
            } else {
                session.incrementRequestTotalCounter(counter);
            }
        }
        if (rejected + securityRejected + rejectedRequests > 0) this.publishCounts();
    }

    /** a front goes on with a session another front holds: that one gives it up */
    public async take(front: Worker, token: string): Promise<SessionState | null> {
        const entry = this.#entries.get(token);
        if (!entry) return null;
        if (entry.front === front) return null;
        const id = ++this.#releaseId;
        const released = new Promise<SessionState | null>((resolve) => this.#releases.set(id, resolve));
        const release: EngineToFront = { kind: "releaseSession", id, token };
        entry.front.postMessage(release);
        const state = (await released) ?? { record: entry.record, activation: entry.activation, nonce: null };
        entry.front = front;
        return state;
    }

    public released(id: number, state: SessionState | null): void {
        const resolve = this.#releases.get(id);
        this.#releases.delete(id);
        resolve?.(state);
    }

    /** the fronts are gone (shutdown): no release will be answered */
    public frontsGone(): void {
        for (const [id, resolve] of this.#releases) {
            this.#releases.delete(id);
            resolve(null);
        }
    }

    #closed(token: string): void {
        const entry = this.#entries.get(token);
        this.#entries.delete(token);
        const reason = this.#closing.get(token);
        this.#closing.delete(token);
        // emitted from inside closeSession, before the engine counts the session out
        queueMicrotask(() => this.publishCounts());
        // closed here (timeout, room made for another): the front that holds it closes its own
        if (entry && reason !== "") {
            const closed: EngineToFront = { kind: "sessionClosed", token, reason: reason ?? "Timeout" };
            try {
                entry.front.postMessage(closed);
            } catch (err) {
                warningLog("front_sessions: cannot tell the front a session closed", (err as Error).message);
            }
        }
    }
}
