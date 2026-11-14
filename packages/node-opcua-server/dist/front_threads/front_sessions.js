import { BinaryStream } from "node-opcua-binary-stream";
import { make_warningLog } from "node-opcua-debug";
import { decodeExtensionObject } from "node-opcua-extension-object";
import { resolveNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { ApplicationDescription, CallMethodRequest, CallMethodResult, EndpointDescription } from "node-opcua-types";
import { decodeStructure, EngineCount, encodeStructure } from "./protocol.js";
import { ResolvedRolesContext } from "./resolved_roles_context.js";
const warningLog = make_warningLog("front_sessions");
/**
 * the session as the context of its requests sees it, here: the record of the session, whose
 * Subscriptions live in a session worker. A ConditionRefresh run here checks the Subscription it
 * names (and the MonitoredItem of a ConditionRefresh2) against the ids the worker reported.
 */
function contextSessionOf(session, subscriptions) {
    const contextSession = Object.create(session);
    contextSession.getSubscription = (subscriptionId) => {
        const items = subscriptions.get(subscriptionId);
        return items ? { id: subscriptionId, getMonitoredItem: (itemId) => (items.has(itemId) ? { itemId } : null) } : null;
    };
    return contextSession;
}
function securityOf(descriptor) {
    return {
        securityMode: descriptor.securityMode,
        securityPolicy: descriptor.securityPolicy,
        clientCertificate: descriptor.clientCertificate ? Buffer.from(descriptor.clientCertificate) : null
    };
}
export class FrontSessions {
    #engine;
    #counts;
    #entries = new Map();
    // the Server methods about a Subscription a session worker runs, until it answers (callSubscriptionMethod)
    #calls = new Map();
    #callId = 0;
    // the sessions the contexts of the fronts' requests carry (contextSessionOf)
    #contextSessions = new WeakSet();
    /** sessions admitted and not created yet: they count against maxSessions */
    #reserved = 0;
    #releaseId = 0;
    #releases = new Map();
    // the reason of a close the registry asked for, for the front to hear the right one
    #closing = new Map();
    #workers = [];
    #workerLoad = [];
    constructor(engine, counts) {
        this.#engine = engine;
        this.#counts = new Int32Array(counts);
        this.publishCounts();
    }
    /** the engine-wide counts the fronts read in place */
    publishCounts() {
        const engine = this.#engine;
        const counts = this.#counts;
        Atomics.store(counts, EngineCount.Sessions, engine.currentSessionCount);
        // the session workers count the subscriptions themselves (Atomics.add)
        if (this.#workers.length === 0)
            Atomics.store(counts, EngineCount.Subscriptions, engine.currentSubscriptionCount);
        Atomics.store(counts, EngineCount.RejectedSessions, engine.rejectedSessionCount);
        Atomics.store(counts, EngineCount.RejectedRequests, engine.rejectedRequestsCount);
        Atomics.store(counts, EngineCount.SessionAborts, engine.sessionAbortCount);
        Atomics.store(counts, EngineCount.PublishingIntervals, engine.publishingIntervalCount);
        Atomics.store(counts, EngineCount.ServerState, engine.getServerState());
    }
    /** the session workers that host the subscriptions of the sessions */
    setWorkers(workers) {
        this.#workers = workers;
        this.#workerLoad = workers.map(() => 0);
    }
    #toWorker(entry, message) {
        if (entry.worker >= 0)
            this.#workers[entry.worker].postMessage(message);
    }
    /** the context of a session's requests: its record's, which carries the roles its front resolved */
    contextOf(token) {
        if (token === null)
            return null;
        return this.#entries.get(token)?.session.sessionContext ?? null;
    }
    /** OPC 10000-4 5.6.2: when the server is full, the oldest session not activated is closed to make room */
    admit() {
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
    cancelAdmission() {
        this.#reserved = Math.max(0, this.#reserved - 1);
    }
    /** a session a front created: its record here, its subscriptions on the least loaded session worker */
    created(front, record) {
        this.#reserved = Math.max(0, this.#reserved - 1);
        const session = this.#engine.createSession({
            clientDescription: decodeStructure(record.clientDescription, new ApplicationDescription()),
            sessionTimeout: record.sessionTimeout,
            ids: { nodeId: resolveNodeId(record.nodeId), authenticationToken: resolveNodeId(record.token) }
        });
        session.sessionName = record.sessionName;
        session.endpoint = record.endpoint ? decodeStructure(record.endpoint, new EndpointDescription()) : undefined;
        session.remoteChannelSecurity = securityOf(record.security);
        const subscriptions = new Map();
        const contextSession = contextSessionOf(session, subscriptions);
        this.#contextSessions.add(contextSession);
        session.sessionContext = new ResolvedRolesContext(contextSession, []);
        let worker = -1;
        for (let k = 0; k < this.#workers.length; k++) {
            // a session worker that is gone has an infinite load
            if (this.#workerLoad[k] === Number.POSITIVE_INFINITY)
                continue;
            if (worker < 0 || this.#workerLoad[k] < this.#workerLoad[worker])
                worker = k;
        }
        const entry = { session, front, record, activation: null, worker, subscriptions, contextSession };
        this.#entries.set(record.token, entry);
        if (worker >= 0)
            this.#workerLoad[worker]++;
        session.once("session_closed", (_session, deleteSubscriptions) => this.#closed(record.token, deleteSubscriptions !== false));
        this.publishCounts();
        return worker;
    }
    activated(front, activation) {
        const entry = this.#entries.get(activation.token);
        if (!entry)
            return;
        if (entry.front !== front) {
            // a front that no longer holds the session (another one took it since)
            warningLog("front_sessions: an activation from a front that does not hold the session is ignored");
            return;
        }
        if (entry.lentFrom) {
            // taken over: the front it came from forgets it
            const forget = { kind: "forgetSession", token: activation.token };
            entry.lentFrom.postMessage(forget);
            entry.lentFrom = undefined;
        }
        entry.activation = activation;
        const session = entry.session;
        session.userIdentityToken = activation.userIdentityToken
            ? (decodeExtensionObject(new BinaryStream(Buffer.from(activation.userIdentityToken))) ??
                undefined)
            : undefined;
        session.remoteChannelSecurity = securityOf(activation.security);
        session.sessionContext = new ResolvedRolesContext(entry.contextSession, activation.roles.map((role) => resolveNodeId(role)));
        session.setLocaleIds(activation.localeIds);
        // the diagnostics nodes of the session are created as it becomes active
        session.status = "active";
        this.publishCounts();
    }
    close(front, token, deleteSubscriptions, reason) {
        const entry = this.#entries.get(token);
        if (!entry)
            return;
        if (entry.front !== front) {
            // a CloseSession that crossed a take: the front that holds the session now goes on with it
            return;
        }
        // the front closed it itself: nothing to tell it
        this.#closing.set(token, "");
        this.#engine.closeSession(entry.session.authenticationToken, deleteSubscriptions, reason);
    }
    /** the sessions a front used in a turn: their watchdog, and the counters of their diagnostics */
    activity(seen, counters, rejected, securityRejected, rejectedRequests) {
        const engine = this.#engine;
        for (let k = 0; k < rejected; k++)
            engine.incrementRejectedSessionCount();
        for (let k = 0; k < securityRejected; k++)
            engine.incrementSecurityRejectedSessionCount();
        for (let k = 0; k < rejectedRequests; k++)
            engine.incrementRejectedRequestsCount();
        for (const token of seen)
            this.#entries.get(token)?.session.keepAlive();
        for (const [token, counter, error] of counters) {
            const session = this.#entries.get(token)?.session;
            if (!session)
                continue;
            if (counter === "") {
                session.incrementTotalRequestCount();
            }
            else if (error) {
                session.incrementRequestErrorCounter(counter);
            }
            else {
                session.incrementRequestTotalCounter(counter);
            }
        }
        if (rejected + securityRejected + rejectedRequests > 0)
            this.publishCounts();
    }
    /** the Subscriptions and MonitoredItems a session worker created or deleted, by session token */
    subscriptionsChanged(changes) {
        for (const [token, subscriptionId, itemId, added] of changes) {
            const subscriptions = this.#entries.get(token)?.subscriptions;
            if (!subscriptions)
                continue;
            if (itemId < 0) {
                if (added)
                    subscriptions.set(subscriptionId, subscriptions.get(subscriptionId) ?? new Set());
                else
                    subscriptions.delete(subscriptionId);
            }
            else {
                const items = subscriptions.get(subscriptionId);
                if (added)
                    items?.add(itemId);
                else
                    items?.delete(itemId);
            }
        }
    }
    /**
     * a Server method about one Subscription (subscription_methods.ts), called in the engine by a
     * session of the fronts: run by the session worker that hosts the session's Subscriptions. The
     * Subscription is checked first as the method does it, with the ids the workers reported. Null for a
     * session the fronts do not serve.
     */
    callSubscriptionMethod(methodId, inputArguments, context) {
        const token = context.session?.authenticationToken?.toString();
        const entry = token === undefined ? undefined : this.#entries.get(token);
        if (!entry && context.session && this.#contextSessions.has(context.session)) {
            // a session of the fronts, closed since
            return Promise.resolve({ statusCode: StatusCodes.BadSessionIdInvalid });
        }
        if (!token || !entry || entry.worker < 0)
            return null;
        const subscriptionId = inputArguments[0]?.value;
        if (!entry.subscriptions.has(subscriptionId)) {
            // a Subscription of another session is denied, an unknown one invalid
            const elsewhere = [...this.#entries.values()].some((other) => other.subscriptions.has(subscriptionId));
            return Promise.resolve({
                statusCode: elsewhere ? StatusCodes.BadUserAccessDenied : StatusCodes.BadSubscriptionIdInvalid
            });
        }
        const id = ++this.#callId;
        const request = encodeStructure(new CallMethodRequest({ objectId: resolveNodeId("ns=0;i=2253"), methodId: resolveNodeId(methodId), inputArguments }));
        return new Promise((resolve) => {
            this.#calls.set(id, { worker: entry.worker, resolve });
            this.#toWorker(entry, { kind: "callSubscriptionMethod", id, token, request });
        });
    }
    /** a session worker's answer to callSubscriptionMethod */
    subscriptionMethodCalled(id, result) {
        const call = this.#calls.get(id);
        if (!call)
            return;
        this.#calls.delete(id);
        call.resolve(decodeStructure(result, new CallMethodResult()));
    }
    /**
     * a front goes on with a session another front holds: that one sets it aside and sends its state.
     * The session is that front's again if the ActivateSession is refused (returned), and forgotten
     * there once it is activated (activated).
     */
    async take(front, token) {
        const entry = this.#entries.get(token);
        if (!entry || entry.front === front || entry.lentFrom)
            return null;
        const owner = entry.front;
        const id = ++this.#releaseId;
        const released = new Promise((resolve) => this.#releases.set(id, { front: owner, resolve }));
        const release = { kind: "releaseSession", id, token };
        owner.postMessage(release);
        const state = await released;
        // closed meanwhile (the front that held it closes what it set aside), or already gone from that front
        if (state === null || this.#entries.get(token) !== entry || entry.front !== owner) {
            if (state !== null && this.#entries.get(token) === entry)
                owner.postMessage({ kind: "restoreSession", token });
            return null;
        }
        state.worker = entry.worker;
        entry.lentFrom = owner;
        entry.front = front;
        return state;
    }
    /** the ActivateSession that took a session was refused: the front it came from goes on with it */
    returned(front, token) {
        const entry = this.#entries.get(token);
        if (!entry || entry.front !== front || !entry.lentFrom)
            return;
        const restore = { kind: "restoreSession", token };
        entry.lentFrom.postMessage(restore);
        entry.front = entry.lentFrom;
        entry.lentFrom = undefined;
    }
    released(id, state) {
        const release = this.#releases.get(id);
        this.#releases.delete(id);
        release?.resolve(state);
    }
    /** the fronts are gone (shutdown): no release will be answered */
    frontsGone() {
        for (const [id, release] of this.#releases) {
            this.#releases.delete(id);
            release.resolve(null);
        }
    }
    /**
     * a front ended: what waited on it is answered, and its sessions close. Their subscriptions are
     * kept, for the client to take them over with TransferSubscriptions from a session of another front.
     */
    frontGone(front) {
        for (const [id, release] of this.#releases) {
            if (release.front !== front)
                continue;
            this.#releases.delete(id);
            release.resolve(null);
        }
        for (const [token, entry] of [...this.#entries]) {
            if (entry.lentFrom === front)
                entry.lentFrom = undefined;
            if (entry.front !== front)
                continue;
            if (entry.lentFrom) {
                // taken by the front that ended, not activated there yet: back to the one it came from
                this.returned(front, token);
                continue;
            }
            // no front to tell
            this.#closing.set(token, "");
            this.#engine.closeSession(entry.session.authenticationToken, false, "Terminated");
        }
    }
    /** a session worker ended: its pending calls fail, its sessions close (their subscriptions went with it), no new session goes there */
    workerGone(index) {
        if (index < 0 || index >= this.#workerLoad.length)
            return;
        this.#workerLoad[index] = Number.POSITIVE_INFINITY; // check-proto-pollution: ok - numeric index into an array
        for (const [id, call] of this.#calls) {
            if (call.worker !== index)
                continue;
            this.#calls.delete(id);
            call.resolve(new CallMethodResult({ statusCode: StatusCodes.BadInternalError }));
        }
        for (const [token, entry] of [...this.#entries]) {
            if (entry.worker !== index)
                continue;
            this.#closing.set(token, "Terminated");
            this.#engine.closeSession(entry.session.authenticationToken, true, "Terminated");
        }
    }
    #closed(token, deleteSubscriptions) {
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
        if (entry?.lentFrom) {
            // the front that set it aside closes its copy too
            entry.lentFrom.postMessage({ kind: "sessionClosed", token, reason: reason || "Timeout" });
        }
        if (entry && reason !== "") {
            const closed = { kind: "sessionClosed", token, reason: reason ?? "Timeout" };
            try {
                entry.front.postMessage(closed);
            }
            catch (err) {
                warningLog("front_sessions: cannot tell the front a session closed", err.message);
            }
        }
    }
}
//# sourceMappingURL=front_sessions.js.map