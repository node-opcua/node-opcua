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
import type { ISessionBase, ISessionContext, ISubscriptionBase } from "node-opcua-address-space";
import { BinaryStream } from "node-opcua-binary-stream";
import { make_warningLog } from "node-opcua-debug";
import { decodeExtensionObject } from "node-opcua-extension-object";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import {
    ApplicationDescription,
    CallMethodRequest,
    CallMethodResult,
    type CallMethodResultOptions,
    EndpointDescription,
    type MessageSecurityMode,
    type UserIdentityToken
} from "node-opcua-types";
import type { Variant } from "node-opcua-variant";
import type { ClosingReason, ServerEngine } from "../server_engine.js";
import type { ServerSession, SessionChannelSecurity } from "../server_session.js";
import {
    type ChannelSecurityDescriptor,
    decodeStructure,
    EngineCount,
    type EngineToFront,
    encodeStructure,
    type SessionActivation,
    type SessionRecord,
    type SessionState
} from "./protocol.js";
import { ResolvedRolesContext } from "./resolved_roles_context.js";

const warningLog = make_warningLog("front_sessions");

/**
 * the session as the context of its requests sees it, here: the record of the session, whose
 * Subscriptions live in a session worker. A ConditionRefresh run here checks the Subscription it
 * names (and the MonitoredItem of a ConditionRefresh2) against the ids the worker reported.
 */
function contextSessionOf(session: ServerSession, subscriptions: Map<number, Set<number>>): ISessionBase {
    const contextSession = Object.create(session) as ISessionBase;
    contextSession.getSubscription = (subscriptionId: number): ISubscriptionBase | null => {
        const items = subscriptions.get(subscriptionId);
        return items ? { id: subscriptionId, getMonitoredItem: (itemId: number) => (items.has(itemId) ? { itemId } : null) } : null;
    };
    return contextSession;
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
    /** the session worker hosting its subscriptions; -1 without session workers */
    worker: number;
    /** its Subscriptions in the worker, by id: the ids of their MonitoredItems */
    subscriptions: Map<number, Set<number>>;
    /** the session as the contexts of its requests see it: its Subscriptions are the worker's (see contextSessionOf) */
    contextSession: ISessionBase;
}

export class FrontSessions {
    readonly #engine: ServerEngine;
    readonly #counts: Int32Array;
    readonly #entries = new Map<string, Entry>();
    // the Server methods about a Subscription a session worker runs, until it answers (callSubscriptionMethod)
    readonly #calls = new Map<number, (result: CallMethodResult) => void>();
    #callId = 0;
    /** sessions admitted and not created yet: they count against maxSessions */
    #reserved = 0;
    #releaseId = 0;
    readonly #releases = new Map<number, (state: SessionState | null) => void>();
    // the reason of a close the registry asked for, for the front to hear the right one
    readonly #closing = new Map<string, string>();
    #workers: Worker[] = [];
    #workerLoad: number[] = [];

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
        // the session workers count the subscriptions themselves (Atomics.add)
        if (this.#workers.length === 0) Atomics.store(counts, EngineCount.Subscriptions, engine.currentSubscriptionCount);
        Atomics.store(counts, EngineCount.RejectedSessions, engine.rejectedSessionCount);
        Atomics.store(counts, EngineCount.RejectedRequests, engine.rejectedRequestsCount);
        Atomics.store(counts, EngineCount.SessionAborts, engine.sessionAbortCount);
        Atomics.store(counts, EngineCount.PublishingIntervals, engine.publishingIntervalCount);
        Atomics.store(counts, EngineCount.ServerState, engine.getServerState());
    }

    /** the session workers that host the subscriptions of the sessions */
    public setWorkers(workers: Worker[]): void {
        this.#workers = workers;
        this.#workerLoad = workers.map(() => 0);
    }

    #toWorker(entry: Entry, message: EngineToFront): void {
        if (entry.worker >= 0) this.#workers[entry.worker].postMessage(message);
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

    /** the room admit() made, given back: the session it was for closed before created() */
    public cancelAdmission(): void {
        this.#reserved = Math.max(0, this.#reserved - 1);
    }

    /** a session a front created: its record here, its subscriptions on the least loaded session worker */
    public created(front: Worker, record: SessionRecord): number {
        this.#reserved = Math.max(0, this.#reserved - 1);
        const session = this.#engine.createSession({
            clientDescription: decodeStructure(record.clientDescription, new ApplicationDescription()),
            sessionTimeout: record.sessionTimeout,
            ids: { nodeId: resolveNodeId(record.nodeId), authenticationToken: resolveNodeId(record.token) }
        });
        session.sessionName = record.sessionName;
        session.endpoint = record.endpoint ? decodeStructure(record.endpoint, new EndpointDescription()) : undefined;
        session.remoteChannelSecurity = securityOf(record.security);
        const subscriptions = new Map<number, Set<number>>();
        const contextSession = contextSessionOf(session, subscriptions);
        session.sessionContext = new ResolvedRolesContext(contextSession, []);
        let worker = -1;
        for (let k = 0; k < this.#workers.length; k++) {
            if (worker < 0 || this.#workerLoad[k] < this.#workerLoad[worker]) worker = k;
        }
        const entry: Entry = { session, front, record, activation: null, worker, subscriptions, contextSession };
        this.#entries.set(record.token, entry);
        if (worker >= 0) this.#workerLoad[worker]++;
        session.once("session_closed", (_session: ServerSession, deleteSubscriptions: boolean) =>
            this.#closed(record.token, deleteSubscriptions !== false)
        );
        this.publishCounts();
        return worker;
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
            entry.contextSession,
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

    /** the Subscriptions and MonitoredItems a session worker created or deleted, by session token */
    public subscriptionsChanged(changes: [string, number, number, number][]): void {
        for (const [token, subscriptionId, itemId, added] of changes) {
            const subscriptions = this.#entries.get(token)?.subscriptions;
            if (!subscriptions) continue;
            if (itemId < 0) {
                if (added) subscriptions.set(subscriptionId, subscriptions.get(subscriptionId) ?? new Set());
                else subscriptions.delete(subscriptionId);
            } else {
                const items = subscriptions.get(subscriptionId);
                if (added) items?.add(itemId);
                else items?.delete(itemId);
            }
        }
    }

    /**
     * a Server method about one Subscription (subscription_methods.ts), called in the engine by a
     * session of the fronts: run by the session worker that hosts the session's Subscriptions. The
     * Subscription is checked first as the method does it, with the ids the workers reported. Null for a
     * session the fronts do not serve.
     */
    public callSubscriptionMethod(
        methodId: number,
        inputArguments: Variant[],
        context: ISessionContext
    ): Promise<CallMethodResultOptions> | null {
        const token = (context.session as { authenticationToken?: NodeId } | undefined)?.authenticationToken?.toString();
        const entry = token === undefined ? undefined : this.#entries.get(token);
        if (!token || !entry || entry.worker < 0) return null;
        const subscriptionId = inputArguments[0]?.value as number;
        if (!entry.subscriptions.has(subscriptionId)) {
            // a Subscription of another session is denied, an unknown one invalid
            const elsewhere = [...this.#entries.values()].some((other) => other.subscriptions.has(subscriptionId));
            return Promise.resolve({
                statusCode: elsewhere ? StatusCodes.BadUserAccessDenied : StatusCodes.BadSubscriptionIdInvalid
            });
        }
        const id = ++this.#callId;
        const request = encodeStructure(
            new CallMethodRequest({ objectId: resolveNodeId("ns=0;i=2253"), methodId: resolveNodeId(methodId), inputArguments })
        );
        return new Promise((resolve) => {
            this.#calls.set(id, resolve);
            this.#toWorker(entry, { kind: "callSubscriptionMethod", id, token, request });
        });
    }

    /** a session worker's answer to callSubscriptionMethod */
    public subscriptionMethodCalled(id: number, result: Uint8Array): void {
        const resolve = this.#calls.get(id);
        if (!resolve) return;
        this.#calls.delete(id);
        resolve(decodeStructure(result, new CallMethodResult()));
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
        const state = (await released) ?? { record: entry.record, activation: entry.activation, nonce: null, worker: entry.worker };
        state.worker = entry.worker;
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

    #closed(token: string, deleteSubscriptions: boolean): void {
        const entry = this.#entries.get(token);
        this.#entries.delete(token);
        if (entry && entry.worker >= 0) {
            this.#workerLoad[entry.worker]--;
            // the subscriptions of a session closed without deleting them wait in the worker for a TransferSubscriptions
            this.#toWorker(entry, { kind: "workerSessionClosed", token, deleteSubscriptions });
        }
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
