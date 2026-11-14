/**
 * @module node-opcua-server
 *
 * The engine of a FrontOPCUAServer: what the services of the server ask of an engine, answered
 * from the one ServerEngine of the engine thread. A front holds no address space: the values of
 * the compact namespaces are read in place from the shared store, everything else is asked of the
 * engine, a service request at a time, as its binary encoding. The engine keeps the record of
 * every session (limits, diagnostics, timeout); the front keeps the half of a session its channel
 * needs (nonce, signatures, the requests in flight).
 */
import { EventEmitter } from "node:events";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { decodeExtensionObject, encodeExtensionObject } from "node-opcua-extension-object";
import { resolveNodeId } from "node-opcua-nodeid";
import { encodedNodesToWrite } from "node-opcua-secure-channel";
import { HistoryReadResult } from "node-opcua-service-history";
import { TransferResult } from "node-opcua-service-subscription";
import { coerceStatusCode, StatusCodes } from "node-opcua-status-code";
import { ApplicationDescription, BrowsePathResult, BrowseResult, BuildInfo, CallMethodResult, EndpointDescription, MessageSecurityMode, ReadRequest } from "node-opcua-types";
import { ServerCapabilities } from "../server_capabilities.js";
import { ServerSession } from "../server_session.js";
import { decodeStructure, decodeStructures, EngineCount, encodedDataValuesOf, encodeStructure, encodeStructures } from "./protocol.js";
import { tokenKeyOf } from "./token_key.js";
function bytesOfExtensionObject(token) {
    if (!token)
        return null;
    const size = new BinaryStreamSizeCalculator();
    encodeExtensionObject(token, size);
    const stream = new BinaryStream(size.length);
    encodeExtensionObject(token, stream);
    return new Uint8Array(stream.buffer.subarray(0, size.length));
}
function securityOf(session) {
    const security = session.channelSecurity;
    return {
        securityMode: security?.securityMode ?? MessageSecurityMode.None,
        securityPolicy: security?.securityPolicy ?? "",
        clientCertificate: security?.clientCertificate ? new Uint8Array(security.clientCertificate) : null
    };
}
function tokenOf(context) {
    const session = context?.session;
    return session?.authenticationToken ? tokenKeyOf(session.authenticationToken) : null;
}
/** the half of a session a front keeps: what it does goes to the engine's record of it, once a turn */
class FrontSession extends ServerSession {
    #engine;
    constructor(engine, server, sessionTimeout) {
        super(engine, server, sessionTimeout);
        this.#engine = engine;
        this.watchedElsewhere(() => engine.noteActivity(tokenKeyOf(this.authenticationToken), null, 0));
    }
    incrementTotalRequestCount() {
        super.incrementTotalRequestCount();
        this.#engine.noteActivity(tokenKeyOf(this.authenticationToken), "", 0);
    }
    incrementRequestTotalCounter(counterName) {
        super.incrementRequestTotalCounter(counterName);
        this.#engine.noteActivity(tokenKeyOf(this.authenticationToken), counterName, 0);
    }
    incrementRequestErrorCounter(counterName) {
        super.incrementRequestErrorCounter(counterName);
        this.#engine.noteActivity(tokenKeyOf(this.authenticationToken), counterName, 1);
    }
}
export class RemoteEngine extends EventEmitter {
    _internalState = "creating";
    serverCapabilities;
    isAuditing;
    /** where the Sessions get their NodeId: the engine's (see OPCUAServerOptions.diagnosticsNamespaceUri) */
    diagnosticsNamespaceIndex;
    /** a front holds no address space: the engine's is the only one */
    addressSpace = null;
    clientDescription;
    #buildInfo;
    #counts;
    #channel;
    #backend;
    sessions = new Map();
    // the session worker that hosts the subscriptions of each session, once the engine assigned it
    // the sessions set aside for another front (releaseSession), until the engine says which front keeps them
    #lent = new Map();
    // the sessions taken from another front, until their ActivateSession is answered here
    #taken = new Set();
    #workerOf = new Map();
    // the store index of each item of a Read (prepareRead), until readSync reads them
    #inPlaceRead = null;
    #inPlace = new Int32Array(128);
    // what prepareRead fetched from the engine for the items of a Read, until readSync takes it
    #fetched = new WeakMap();
    // the activity of the sessions in this turn, sent to the engine at its end
    #seen = new Set();
    #counters = [];
    #rejected = 0;
    #securityRejected = 0;
    #rejectedRequests = 0;
    #activityScheduled = false;
    // sessions this front closed because the engine did: not to be closed there again
    #closedByEngine = new Set();
    /** the store this front reads in place */
    get backend() {
        return this.#backend;
    }
    constructor(state, channel, backend) {
        super();
        this.serverCapabilities = new ServerCapabilities(state.serverCapabilities);
        this.isAuditing = state.isAuditing;
        this.diagnosticsNamespaceIndex = state.diagnosticsNamespaceIndex;
        this.#buildInfo = decodeStructure(state.buildInfo, new BuildInfo());
        this.#counts = new Int32Array(state.counts);
        this.#channel = channel;
        this.#backend = backend;
    }
    // ------------------------------------------------------------------ lifecycle and state
    initialize(_options, callback) {
        this._internalState = "initialized";
        setImmediate(() => callback());
    }
    async shutdown() {
        this._internalState = "shutdown";
        // the sessions stay with the engine: a client may come back through another front
        for (const session of this.sessions.values())
            this.#drop(session);
        this.#flushActivity();
    }
    dispose() {
        this._internalState = "disposed";
    }
    isStarted() {
        return this._internalState === "initialized";
    }
    getServerState() {
        return Atomics.load(this.#counts, EngineCount.ServerState);
    }
    /** the state of the one server is the engine's: a front starting or stopping does not change it */
    setServerState(_serverState) { }
    setShutdownTime(_date) { }
    getInApplicationSetup() {
        return false;
    }
    setInApplicationSetup(_value) { }
    get buildInfo() {
        return this.#buildInfo;
    }
    registerCompactNamespace(_namespaceUri) {
        throw new Error("FrontOPCUAServer: namespaces are registered on the engine (FrontThreadEngine.registerNamespace)");
    }
    // ------------------------------------------------------------------ sessions
    get currentSessionCount() {
        return Atomics.load(this.#counts, EngineCount.Sessions);
    }
    get rejectedSessionCount() {
        return Atomics.load(this.#counts, EngineCount.RejectedSessions);
    }
    get rejectedRequestsCount() {
        return Atomics.load(this.#counts, EngineCount.RejectedRequests);
    }
    get sessionAbortCount() {
        return Atomics.load(this.#counts, EngineCount.SessionAborts);
    }
    incrementRejectedSessionCount() {
        this.#rejected++;
        this.#scheduleActivity();
    }
    incrementSecurityRejectedSessionCount() {
        this.#securityRejected++;
        this.#scheduleActivity();
    }
    incrementRejectedRequestsCount() {
        this.#rejectedRequests++;
        this.#scheduleActivity();
    }
    /** room for one more session, made by the engine for all the fronts */
    admitSession() {
        return this.#channel.call({ kind: "admitSession" });
    }
    createSession(options) {
        const sessionTimeout = options?.sessionTimeout || 1000;
        this.clientDescription = options?.clientDescription || new ApplicationDescription({});
        const session = new FrontSession(this, options?.server ?? {}, sessionTimeout);
        this.sessions.set(tokenKeyOf(session.authenticationToken), session);
        // the server names the session, gives it its endpoint and its channel before it answers
        const token = tokenKeyOf(session.authenticationToken);
        this.#workerOf.set(token, new Promise((resolve) => queueMicrotask(() => {
            if (session.status === "closed") {
                // the room the engine made for it goes back
                this.#tell({ kind: "cancelAdmission" });
                return resolve(-1);
            }
            resolve(this.#channel.call({ kind: "sessionCreated", session: this.recordOf(session) }));
        })));
        return session;
    }
    getSession(authenticationToken, activeOnly) {
        if (!authenticationToken)
            return null;
        const session = this.sessions.get(tokenKeyOf(authenticationToken));
        if (!session)
            return null;
        if (activeOnly && session.status !== "active")
            return null;
        return session;
    }
    /** the tokens of the sessions this thread holds */
    sessionTokens() {
        return this.sessions.keys();
    }
    getOldestInactiveSession() {
        return null;
    }
    /** answered once the engine has closed its record too: the client then sees the session counted out */
    closeSession(authenticationToken, deleteSubscriptions, reason, auditEntryId) {
        const token = tokenKeyOf(authenticationToken);
        const session = this.sessions.get(token);
        if (!session) {
            throw new Error(`cannot find session with this authenticationToken ${token}`);
        }
        this.sessions.delete(token);
        this.#workerOf.delete(token);
        session.close(deleteSubscriptions, reason, auditEntryId);
        session.dispose();
        if (this.#closedByEngine.delete(token))
            return Promise.resolve();
        return this.#channel.call({ kind: "closeSession", token, deleteSubscriptions, reason }).then(() => undefined);
    }
    /** the engine closed this session (timeout, room made for another): the front closes its half */
    sessionClosedByEngine(token, reason) {
        const lent = this.#lent.get(token);
        if (lent) {
            this.#lent.delete(token);
            this.#workerOf.delete(token);
            lent._detach_channel();
        }
        const session = this.sessions.get(token);
        if (!session)
            return;
        this.#closedByEngine.add(token);
        void this.closeSession(session.authenticationToken, true, reason);
    }
    /**
     * a session of this front another front goes on with: its state. The session is set aside, still
     * attached to its channel, until the engine says whether the other front activated it (forgetSession)
     */
    releaseSession(token) {
        const session = this.sessions.get(token);
        if (!session)
            return null;
        const state = {
            record: this.recordOf(session),
            activation: this.activationOf(session),
            nonce: session.nonce ? new Uint8Array(session.nonce) : null,
            // the engine knows it too, and overwrites it
            worker: -1
        };
        this.sessions.delete(token);
        this.#lent.set(token, session);
        return state;
    }
    /** the session set aside was activated on another front */
    forgetSession(token) {
        const session = this.#lent.get(token);
        if (!session)
            return;
        this.#lent.delete(token);
        session._detach_channel();
        this.#workerOf.delete(token);
    }
    /** the ActivateSession on another front was refused: this front goes on with the session it set aside */
    restoreSession(token) {
        const session = this.#lent.get(token);
        if (!session)
            return;
        this.#lent.delete(token);
        this.sessions.set(token, session);
    }
    /**
     * a session taken from another front whose ActivateSession was refused here: it goes back there,
     * untouched, as a refused ActivateSession leaves a session of a single-thread server.
     * Resolves once the engine has handed it back.
     */
    returnSession(session) {
        const token = tokenKeyOf(session.authenticationToken);
        if (!this.#taken.delete(token))
            return undefined;
        this.sessions.delete(token);
        this.#workerOf.delete(token);
        // answered once the engine has told the other front to go on with the session: the client
        // may reach that front as soon as it hears the refusal
        return this.#channel.call({ kind: "returnSession", token }).then(() => undefined);
    }
    /**
     * a session another front holds, taken over before an ActivateSession on a channel of this one;
     * `server` resolves the roles of its user, as for the sessions this front creates
     */
    async takeSession(authenticationToken, server) {
        const known = this.getSession(authenticationToken);
        if (known)
            return known;
        const state = await this.#channel.call({
            kind: "takeSession",
            token: tokenKeyOf(authenticationToken)
        });
        if (!state)
            return null;
        const session = this.sessionFrom(state.record, state.activation, server);
        session.nonce = state.nonce ? Buffer.from(state.nonce) : undefined;
        this.#taken.add(state.record.token);
        this.#workerOf.set(state.record.token, Promise.resolve(state.worker));
        return session;
    }
    /** the session worker that hosts the subscriptions of a session; -1 for none */
    workerOf(token) {
        return this.#workerOf.get(token) ?? Promise.resolve(-1);
    }
    /** a session of this thread rebuilt from what another thread knows of it */
    sessionFrom(record, activation, server) {
        const session = new FrontSession(this, server, record.sessionTimeout);
        session.nodeId = resolveNodeId(record.nodeId);
        session.authenticationToken = resolveNodeId(record.token);
        session.sessionName = record.sessionName;
        session.clientDescription = decodeStructure(record.clientDescription, new ApplicationDescription());
        if (record.endpoint) {
            session.endpoint = decodeStructure(record.endpoint, new EndpointDescription());
        }
        if (activation) {
            session.remoteChannelSecurity = {
                securityMode: activation.security.securityMode,
                securityPolicy: activation.security.securityPolicy,
                clientCertificate: activation.security.clientCertificate ? Buffer.from(activation.security.clientCertificate) : null
            };
            if (activation.userIdentityToken) {
                session.userIdentityToken = (decodeExtensionObject(new BinaryStream(Buffer.from(activation.userIdentityToken))) ??
                    undefined);
            }
            session.setLocaleIds(activation.localeIds);
            session.status = "active";
        }
        this.sessions.set(record.token, session);
        return session;
    }
    /** an event raised in this front: the engine raises it on its Server object */
    raiseEvent(eventType, fields) {
        this.#tell({ kind: "raiseEvent", eventType, fields });
    }
    /** an ActivateSession goes through: the engine learns the user (its roles) and the new channel */
    sessionActivated(session) {
        this.#taken.delete(tokenKeyOf(session.authenticationToken));
        const activation = this.activationOf(session);
        if (!activation)
            return undefined;
        return this.#channel.call({ kind: "sessionActivated", activation }).then(() => undefined);
    }
    recordOf(session) {
        return {
            nodeId: session.nodeId.toString(),
            token: tokenKeyOf(session.authenticationToken),
            sessionTimeout: session.sessionTimeout,
            sessionName: session.sessionName,
            clientDescription: encodeStructure(session.clientDescription ?? new ApplicationDescription({})),
            endpoint: session.endpoint ? encodeStructure(session.endpoint) : null,
            security: securityOf(session)
        };
    }
    activationOf(session) {
        if (session.status !== "active")
            return null;
        return {
            token: tokenKeyOf(session.authenticationToken),
            roles: session.sessionContext.getCurrentUserRoles().map((role) => role.toString()),
            userIdentityToken: bytesOfExtensionObject(session.userIdentityToken),
            localeIds: [...session.localeIds],
            security: securityOf(session)
        };
    }
    /** what a session did (seen, a service counter), which the engine's record counts at the end of the turn */
    noteActivity(token, counter, error) {
        if (counter === null)
            this.#seen.add(token);
        else
            this.#counters.push([token, counter, error]);
        this.#scheduleActivity();
    }
    /** forgets a session without closing it: it lives on with the engine */
    #drop(session) {
        const token = tokenKeyOf(session.authenticationToken);
        this.sessions.delete(token);
        this.#workerOf.delete(token);
        session._detach_channel();
    }
    #scheduleActivity() {
        if (this.#activityScheduled)
            return;
        this.#activityScheduled = true;
        setImmediate(() => this.#flushActivity());
    }
    #flushActivity() {
        this.#activityScheduled = false;
        if (this.#seen.size === 0 &&
            this.#counters.length === 0 &&
            this.#rejected + this.#securityRejected + this.#rejectedRequests === 0) {
            return;
        }
        const activity = {
            kind: "activity",
            seen: [...this.#seen],
            counters: this.#counters,
            rejected: this.#rejected,
            securityRejected: this.#securityRejected,
            rejectedRequests: this.#rejectedRequests
        };
        this.#seen = new Set();
        this.#counters = [];
        this.#rejected = this.#securityRejected = this.#rejectedRequests = 0;
        this.#channel.send(activity);
    }
    /** a request whose answer does not matter: in order with the others, so the engine knows a session before its services */
    #tell(request) {
        void this.#channel.call(request);
    }
    // ------------------------------------------------------------------ subscriptions (session workers, to come)
    get currentSubscriptionCount() {
        return Atomics.load(this.#counts, EngineCount.Subscriptions);
    }
    get publishingIntervalCount() {
        return Atomics.load(this.#counts, EngineCount.PublishingIntervals);
    }
    _createSubscriptionOnSession(_session, _parameters, _id) {
        throw new Error("FrontOPCUAServer: subscriptions are not served by this front yet");
    }
    findOrphanSubscription(_subscriptionId) {
        return null;
    }
    // this engine holds no orphan pool (findOrphanSubscription is always null here), so the orphan
    // branch is never reached through it; fail closed for completeness.
    mayDeleteOrphanSubscription(_session, _subscription) {
        return false;
    }
    deleteOrphanSubscription(_subscription) {
        return StatusCodes.BadSubscriptionIdInvalid;
    }
    async transferSubscription(_session, _subscriptionId, _sendInitialValues) {
        return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
    }
    prepareMonitoredItems() {
        return undefined;
    }
    monitoredItemsReady() {
        return undefined;
    }
    get nodeFinder() {
        throw new Error("FrontOPCUAServer: subscriptions are not served by this front yet");
    }
    // ------------------------------------------------------------------ services
    #service(service, context, request) {
        return this.#channel.call({ kind: "service", service, token: tokenOf(context), request });
    }
    prepareRead(context, readRequest, callback) {
        const nodesToRead = (readRequest.nodesToRead ?? []);
        // the node of each item in the shared store, found once for readSync; -1 for those the engine reads.
        // Kept for the Read prepared last: readSync follows at once unless the engine reads some items
        if (this.#inPlace.length < nodesToRead.length)
            this.#inPlace = new Int32Array(nodesToRead.length);
        const indexes = this.#inPlace;
        let remoteCount = 0;
        for (let k = 0; k < nodesToRead.length; k++) {
            indexes[k] = this.#backend.inPlaceIndex(nodesToRead[k]);
            if (indexes[k] < 0)
                remoteCount++;
        }
        this.#inPlaceRead = readRequest;
        if (remoteCount === 0) {
            callback();
            return;
        }
        const remote = nodesToRead.filter((_nodeToRead, k) => indexes[k] < 0);
        // another Read may be prepared before the engine answers: this one finds its nodes again in readSync
        this.#inPlaceRead = null;
        const request = new ReadRequest({
            nodesToRead: remote,
            maxAge: readRequest.maxAge ?? 0,
            timestampsToReturn: readRequest.timestampsToReturn ?? TimestampsToReturn.Source
        });
        this.#service("read", context, encodeStructure(request))
            .then((bytes) => {
            // the values go into the Read response as the engine encoded them
            const values = encodedDataValuesOf(bytes);
            for (let k = 0; k < remote.length; k++)
                this.#fetched.set(remote[k], values[k]);
            callback();
        })
            .catch((err) => callback(err));
    }
    readSync(context, readRequest) {
        const nodesToRead = (readRequest.nodesToRead ?? []);
        const maxAge = readRequest.maxAge ?? 0;
        const indexes = this.#inPlaceRead === readRequest ? this.#inPlace : undefined;
        this.#inPlaceRead = null;
        const backend = this.#backend;
        return nodesToRead.map((nodeToRead, k) => {
            const fetched = this.#fetched.get(nodeToRead);
            if (fetched) {
                this.#fetched.delete(nodeToRead);
                return fetched;
            }
            const i = indexes ? indexes[k] : backend.inPlaceIndex(nodeToRead);
            return i >= 0
                ? backend.readAt(i, context, maxAge, readRequest.timestampsToReturn)
                : new DataValue({ statusCode: StatusCodes.BadResourceUnavailable });
        });
    }
    refreshValues(_nodesToRefresh, _maxAge, callback) {
        // the engine refreshes them as it runs the service
        callback(null, []);
    }
    async write(context, nodesToWrite) {
        // the WriteValues as the client encoded them, when they arrived that way and are unchanged
        const items = encodedNodesToWrite(nodesToWrite) ?? encodeStructures(nodesToWrite);
        const statuses = await this.#service("write", context, items);
        return statuses.map((value) => coerceStatusCode(value));
    }
    /** a Write of WriteValues as the client encoded them (their count, then them), to the engine as they are */
    async writeEncoded(context, nodesToWrite) {
        const statuses = await this.#service("write", context, nodesToWrite);
        return statuses.map((value) => coerceStatusCode(value));
    }
    async browseWithAutomaticExpansion(nodesToBrowse, context) {
        const bytes = await this.#service("browse", context, encodeStructures(nodesToBrowse));
        return decodeStructures(bytes, BrowseResult.prototype);
    }
    async translateBrowsePaths(browsePaths, context) {
        const bytes = await this.#service("translate", context ?? null, encodeStructures(browsePaths));
        return decodeStructures(bytes, BrowsePathResult.prototype);
    }
    async call(context, methodsToCall) {
        const bytes = await this.#service("call", context, encodeStructures(methodsToCall));
        return decodeStructures(bytes, CallMethodResult.prototype);
    }
    async historyRead(context, historyReadRequest) {
        const bytes = await this.#service("historyRead", context, encodeStructure(historyReadRequest));
        return decodeStructures(bytes, HistoryReadResult.prototype);
    }
}
//# sourceMappingURL=remote_engine.js.map