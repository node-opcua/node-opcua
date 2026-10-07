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
import type { AddressSpace, IServerBase, ISessionContext } from "node-opcua-address-space";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import type { ServerState } from "node-opcua-common";
import { type DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { decodeExtensionObject, encodeExtensionObject } from "node-opcua-extension-object";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { encodedNodesToWrite } from "node-opcua-secure-channel";
import { type HistoryReadRequest, HistoryReadResult } from "node-opcua-service-history";
import { TransferResult } from "node-opcua-service-subscription";
import { coerceStatusCode, type StatusCode, StatusCodes } from "node-opcua-status-code";
import {
    ApplicationDescription,
    type BrowseDescription,
    type BrowsePath,
    BrowsePathResult,
    BrowseResult,
    BuildInfo,
    type CallMethodRequest,
    CallMethodResult,
    type CallMethodResultOptions,
    EndpointDescription,
    MessageSecurityMode,
    ReadRequest,
    type ReadRequestOptions,
    type ReadValueIdOptions,
    type UserIdentityToken,
    type WriteValue
} from "node-opcua-types";
import type { INodeFinder } from "../monitorable_node.js";
import type { OPCUAServerOptions } from "../opcua_server.js";
import { ServerCapabilities } from "../server_capabilities.js";
import type { ClosingReason, CreateSessionOption } from "../server_engine.js";
import type { IServerEngineForServer } from "../server_engine_interface.js";
import { ServerSession, type ServerSessionParent } from "../server_session.js";
import type { Subscription } from "../server_subscription.js";
import {
    type ChannelSecurityDescriptor,
    decodeStructure,
    decodeStructures,
    EngineCount,
    type EngineServerState,
    encodedDataValuesOf,
    encodeStructure,
    encodeStructures,
    type FrontRequest,
    type FrontToEngine,
    type ServiceKind,
    type SessionActivation,
    type SessionRecord,
    type SessionState
} from "./protocol.js";
import type { EngineChannel, RemoteCompactBackend } from "./remote_backend.js";

function bytesOfExtensionObject(token: UserIdentityToken | undefined): Uint8Array | null {
    if (!token) return null;
    const size = new BinaryStreamSizeCalculator();
    encodeExtensionObject(token, size);
    const stream = new BinaryStream(size.length);
    encodeExtensionObject(token, stream);
    return new Uint8Array(stream.buffer.subarray(0, size.length));
}

function securityOf(session: ServerSession): ChannelSecurityDescriptor {
    const security = session.channelSecurity;
    return {
        securityMode: security?.securityMode ?? MessageSecurityMode.None,
        securityPolicy: security?.securityPolicy ?? "",
        clientCertificate: security?.clientCertificate ? new Uint8Array(security.clientCertificate) : null
    };
}

function tokenOf(context: ISessionContext | null): string | null {
    const session = context?.session as { authenticationToken?: NodeId } | undefined;
    return session?.authenticationToken ? session.authenticationToken.toString() : null;
}

/** the half of a session a front keeps: what it does goes to the engine's record of it, once a turn */
class FrontSession extends ServerSession {
    readonly #engine: RemoteEngine;
    constructor(engine: RemoteEngine, server: IServerBase, sessionTimeout: number) {
        super(engine, server, sessionTimeout);
        this.#engine = engine;
        this.watchedElsewhere(() => engine.noteActivity(this.authenticationToken.toString(), null, 0));
    }
    public override incrementTotalRequestCount(): void {
        super.incrementTotalRequestCount();
        this.#engine.noteActivity(this.authenticationToken.toString(), "", 0);
    }
    public override incrementRequestTotalCounter(counterName: string): void {
        super.incrementRequestTotalCounter(counterName);
        this.#engine.noteActivity(this.authenticationToken.toString(), counterName, 0);
    }
    public override incrementRequestErrorCounter(counterName: string): void {
        super.incrementRequestErrorCounter(counterName);
        this.#engine.noteActivity(this.authenticationToken.toString(), counterName, 1);
    }
}

export class RemoteEngine extends EventEmitter implements IServerEngineForServer, ServerSessionParent {
    public _internalState: "creating" | "initializing" | "initialized" | "shutdown" | "disposed" = "creating";
    public readonly serverCapabilities: ServerCapabilities;
    public readonly isAuditing: boolean;
    /** where the Sessions get their NodeId: the engine's (see OPCUAServerOptions.diagnosticsNamespaceUri) */
    public readonly diagnosticsNamespaceIndex: number;
    /** a front holds no address space: the engine's is the only one */
    public readonly addressSpace: AddressSpace | null = null;
    public clientDescription?: ApplicationDescription;
    readonly #buildInfo: BuildInfo;
    readonly #counts: Int32Array;
    readonly #channel: EngineChannel;
    readonly #backend: RemoteCompactBackend;
    protected readonly sessions = new Map<string, ServerSession>();
    // the session worker that hosts the subscriptions of each session, once the engine assigned it
    readonly #workerOf = new Map<string, Promise<number>>();
    // what prepareRead fetched from the engine for the items of a Read, until readSync takes it
    readonly #fetched = new WeakMap<object, DataValue>();
    // the activity of the sessions in this turn, sent to the engine at its end
    #seen = new Set<string>();
    #counters: [string, string, number][] = [];
    #rejected = 0;
    #securityRejected = 0;
    #rejectedRequests = 0;
    #activityScheduled = false;
    // sessions this front closed because the engine did: not to be closed there again
    readonly #closedByEngine = new Set<string>();

    constructor(state: EngineServerState, channel: EngineChannel, backend: RemoteCompactBackend) {
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

    public initialize(_options: OPCUAServerOptions, callback: (err?: Error | null) => void): void {
        this._internalState = "initialized";
        setImmediate(() => callback());
    }

    public async shutdown(): Promise<void> {
        this._internalState = "shutdown";
        // the sessions stay with the engine: a client may come back through another front
        for (const session of this.sessions.values()) this.#drop(session);
        this.#flushActivity();
    }

    public dispose(): void {
        this._internalState = "disposed";
    }

    public isStarted(): boolean {
        return this._internalState === "initialized";
    }

    public getServerState(): ServerState {
        return Atomics.load(this.#counts, EngineCount.ServerState) as ServerState;
    }

    /** the state of the one server is the engine's: a front starting or stopping does not change it */
    public setServerState(_serverState: ServerState): void {}

    public setShutdownTime(_date: Date): void {}

    public getInApplicationSetup(): boolean {
        return false;
    }

    public setInApplicationSetup(_value: boolean): void {}

    public get buildInfo(): BuildInfo {
        return this.#buildInfo;
    }

    public registerCompactNamespace(_namespaceUri: string): number {
        throw new Error("FrontOPCUAServer: namespaces are registered on the engine (FrontThreadEngine.registerNamespace)");
    }

    // ------------------------------------------------------------------ sessions

    public get currentSessionCount(): number {
        return Atomics.load(this.#counts, EngineCount.Sessions);
    }

    public get rejectedSessionCount(): number {
        return Atomics.load(this.#counts, EngineCount.RejectedSessions);
    }

    public get rejectedRequestsCount(): number {
        return Atomics.load(this.#counts, EngineCount.RejectedRequests);
    }

    public get sessionAbortCount(): number {
        return Atomics.load(this.#counts, EngineCount.SessionAborts);
    }

    public incrementRejectedSessionCount(): void {
        this.#rejected++;
        this.#scheduleActivity();
    }

    public incrementSecurityRejectedSessionCount(): void {
        this.#securityRejected++;
        this.#scheduleActivity();
    }

    public incrementRejectedRequestsCount(): void {
        this.#rejectedRequests++;
        this.#scheduleActivity();
    }

    /** room for one more session, made by the engine for all the fronts */
    public admitSession(): Promise<boolean> {
        return this.#channel.call<boolean>({ kind: "admitSession" });
    }

    public createSession(options?: CreateSessionOption): ServerSession {
        const sessionTimeout = options?.sessionTimeout || 1000;
        this.clientDescription = options?.clientDescription || new ApplicationDescription({});
        const session = new FrontSession(this, options?.server ?? {}, sessionTimeout);
        this.sessions.set(session.authenticationToken.toString(), session);
        // the server names the session, gives it its endpoint and its channel before it answers
        const token = session.authenticationToken.toString();
        this.#workerOf.set(
            token,
            new Promise<number>((resolve) =>
                queueMicrotask(() => {
                    if (session.status === "closed") return resolve(-1);
                    resolve(this.#channel.call<number>({ kind: "sessionCreated", session: this.recordOf(session) }));
                })
            )
        );
        return session;
    }

    public getSession(authenticationToken: NodeId, activeOnly?: boolean): ServerSession | null {
        if (!authenticationToken) return null;
        const session = this.sessions.get(authenticationToken.toString());
        if (!session) return null;
        if (activeOnly && session.status !== "active") return null;
        return session;
    }

    /** the tokens of the sessions this thread holds */
    public sessionTokens(): IterableIterator<string> {
        return this.sessions.keys();
    }

    public getOldestInactiveSession(): ServerSession | null {
        return null;
    }

    /** answered once the engine has closed its record too: the client then sees the session counted out */
    public closeSession(
        authenticationToken: NodeId,
        deleteSubscriptions: boolean,
        reason: ClosingReason,
        auditEntryId?: string
    ): Promise<void> {
        const token = authenticationToken.toString();
        const session = this.sessions.get(token);
        if (!session) {
            throw new Error(`cannot find session with this authenticationToken ${token}`);
        }
        this.sessions.delete(token);
        this.#workerOf.delete(token);
        session.close(deleteSubscriptions, reason, auditEntryId);
        session.dispose();
        if (this.#closedByEngine.delete(token)) return Promise.resolve();
        return this.#channel.call<unknown>({ kind: "closeSession", token, deleteSubscriptions, reason }).then(() => undefined);
    }

    /** the engine closed this session (timeout, room made for another): the front closes its half */
    public sessionClosedByEngine(token: string, reason: string): void {
        const session = this.sessions.get(token);
        if (!session) return;
        this.#closedByEngine.add(token);
        void this.closeSession(session.authenticationToken, true, reason as ClosingReason);
    }

    /** a session of this front another front goes on with: its state, and this front forgets it */
    public releaseSession(token: string): SessionState | null {
        const session = this.sessions.get(token);
        if (!session) return null;
        const state: SessionState = {
            record: this.recordOf(session),
            activation: this.activationOf(session),
            nonce: session.nonce ? new Uint8Array(session.nonce) : null,
            // the engine knows it too, and overwrites it
            worker: -1
        };
        this.#drop(session);
        return state;
    }

    /**
     * a session another front holds, taken over before an ActivateSession on a channel of this one;
     * `server` resolves the roles of its user, as for the sessions this front creates
     */
    public async takeSession(authenticationToken: NodeId, server: IServerBase): Promise<ServerSession | null> {
        const known = this.getSession(authenticationToken);
        if (known) return known;
        const state = await this.#channel.call<SessionState | null>({ kind: "takeSession", token: authenticationToken.toString() });
        if (!state) return null;
        const session = this.sessionFrom(state.record, state.activation, server);
        session.nonce = state.nonce ? Buffer.from(state.nonce) : undefined;
        this.#workerOf.set(state.record.token, Promise.resolve(state.worker));
        return session;
    }

    /** the session worker that hosts the subscriptions of a session; -1 for none */
    public workerOf(token: string): Promise<number> {
        return this.#workerOf.get(token) ?? Promise.resolve(-1);
    }

    /** a session of this thread rebuilt from what another thread knows of it */
    protected sessionFrom(record: SessionRecord, activation: SessionActivation | null, server: IServerBase): ServerSession {
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
                    undefined) as UserIdentityToken | undefined;
            }
            session.setLocaleIds(activation.localeIds);
            session.status = "active";
        }
        this.sessions.set(record.token, session);
        return session;
    }

    /** an event raised in this front: the engine raises it on its Server object */
    public raiseEvent(eventType: string, fields: Record<string, Uint8Array>): void {
        this.#tell({ kind: "raiseEvent", eventType, fields });
    }

    /** an ActivateSession went through: the engine learns the user (its roles) and the new channel */
    public sessionActivated(session: ServerSession): void {
        const activation = this.activationOf(session);
        if (activation) this.#tell({ kind: "sessionActivated", activation });
    }

    public recordOf(session: ServerSession): SessionRecord {
        return {
            nodeId: session.nodeId.toString(),
            token: session.authenticationToken.toString(),
            sessionTimeout: session.sessionTimeout,
            sessionName: session.sessionName,
            clientDescription: encodeStructure(session.clientDescription ?? new ApplicationDescription({})),
            endpoint: session.endpoint ? encodeStructure(session.endpoint) : null,
            security: securityOf(session)
        };
    }

    public activationOf(session: ServerSession): SessionActivation | null {
        if (session.status !== "active") return null;
        return {
            token: session.authenticationToken.toString(),
            roles: session.sessionContext.getCurrentUserRoles().map((role) => role.toString()),
            userIdentityToken: bytesOfExtensionObject(session.userIdentityToken),
            localeIds: [...session.localeIds],
            security: securityOf(session)
        };
    }

    /** what a session did (seen, a service counter), which the engine's record counts at the end of the turn */
    public noteActivity(token: string, counter: string | null, error: number): void {
        if (counter === null) this.#seen.add(token);
        else this.#counters.push([token, counter, error]);
        this.#scheduleActivity();
    }

    /** forgets a session without closing it: it lives on with the engine */
    #drop(session: ServerSession): void {
        const token = session.authenticationToken.toString();
        this.sessions.delete(token);
        session._detach_channel();
    }

    #scheduleActivity(): void {
        if (this.#activityScheduled) return;
        this.#activityScheduled = true;
        setImmediate(() => this.#flushActivity());
    }

    #flushActivity(): void {
        this.#activityScheduled = false;
        if (
            this.#seen.size === 0 &&
            this.#counters.length === 0 &&
            this.#rejected + this.#securityRejected + this.#rejectedRequests === 0
        ) {
            return;
        }
        const activity: FrontToEngine = {
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
    #tell(request: FrontRequest): void {
        void this.#channel.call<unknown>(request);
    }

    // ------------------------------------------------------------------ subscriptions (session workers, to come)

    public get currentSubscriptionCount(): number {
        return Atomics.load(this.#counts, EngineCount.Subscriptions);
    }

    public get publishingIntervalCount(): number {
        return Atomics.load(this.#counts, EngineCount.PublishingIntervals);
    }

    public _createSubscriptionOnSession(_session: ServerSession, _parameters: unknown, _id?: number): Subscription {
        throw new Error("FrontOPCUAServer: subscriptions are not served by this front yet");
    }

    public findOrphanSubscription(_subscriptionId: number): Subscription | null {
        return null;
    }

    public deleteOrphanSubscription(_subscription: Subscription): StatusCode {
        return StatusCodes.BadSubscriptionIdInvalid;
    }

    public async transferSubscription(
        _session: ServerSession,
        _subscriptionId: number,
        _sendInitialValues: boolean
    ): Promise<TransferResult> {
        return new TransferResult({ statusCode: StatusCodes.BadSubscriptionIdInvalid });
    }

    public prepareMonitoredItems(): Promise<void> | undefined {
        return undefined;
    }

    public get nodeFinder(): INodeFinder {
        throw new Error("FrontOPCUAServer: subscriptions are not served by this front yet");
    }

    // ------------------------------------------------------------------ services

    #service<T>(service: ServiceKind, context: ISessionContext | null, request: Uint8Array): Promise<T> {
        return this.#channel.call<T>({ kind: "service", service, token: tokenOf(context), request });
    }

    public prepareRead(context: ISessionContext, readRequest: ReadRequestOptions, callback: (err?: Error | null) => void): void {
        const nodesToRead = (readRequest.nodesToRead ?? []) as ReadValueIdOptions[];
        const remote = nodesToRead.filter((nodeToRead) => !this.#backend.canReadInPlace(nodeToRead));
        if (remote.length === 0) {
            callback();
            return;
        }
        const request = new ReadRequest({
            nodesToRead: remote,
            maxAge: readRequest.maxAge ?? 0,
            timestampsToReturn: readRequest.timestampsToReturn ?? TimestampsToReturn.Source
        });
        this.#service<Uint8Array>("read", context, encodeStructure(request))
            .then((bytes) => {
                // the values go into the Read response as the engine encoded them
                const values = encodedDataValuesOf(bytes);
                for (let k = 0; k < remote.length; k++) this.#fetched.set(remote[k], values[k]);
                callback();
            })
            .catch((err: Error) => callback(err));
    }

    public readSync(context: ISessionContext, readRequest: ReadRequestOptions): DataValue[] {
        const nodesToRead = (readRequest.nodesToRead ?? []) as ReadValueIdOptions[];
        const maxAge = readRequest.maxAge ?? 0;
        return nodesToRead.map((nodeToRead) => {
            const fetched = this.#fetched.get(nodeToRead);
            if (fetched) {
                this.#fetched.delete(nodeToRead);
                return fetched;
            }
            return this.#backend.read(context, nodeToRead, maxAge, readRequest.timestampsToReturn);
        });
    }

    public refreshValues(
        _nodesToRefresh: unknown,
        _maxAge: number,
        callback: (err: Error | null, dataValues?: DataValue[]) => void
    ): void {
        // the engine refreshes them as it runs the service
        callback(null, []);
    }

    public async write(context: ISessionContext, nodesToWrite: WriteValue[]): Promise<StatusCode[]> {
        // the WriteValues as the client encoded them, when they arrived that way and are unchanged
        const items = encodedNodesToWrite(nodesToWrite) ?? encodeStructures(nodesToWrite);
        const statuses = await this.#service<number[]>("write", context, items);
        return statuses.map((value) => coerceStatusCode(value));
    }

    public async browseWithAutomaticExpansion(
        nodesToBrowse: BrowseDescription[],
        context: ISessionContext
    ): Promise<BrowseResult[]> {
        const bytes = await this.#service<Uint8Array>("browse", context, encodeStructures(nodesToBrowse));
        return decodeStructures(bytes, BrowseResult.prototype);
    }

    public async translateBrowsePaths(browsePaths: BrowsePath[]): Promise<BrowsePathResult[]> {
        const bytes = await this.#service<Uint8Array>("translate", null, encodeStructures(browsePaths));
        return decodeStructures(bytes, BrowsePathResult.prototype);
    }

    public async call(context: ISessionContext, methodsToCall: CallMethodRequest[]): Promise<CallMethodResultOptions[]> {
        const bytes = await this.#service<Uint8Array>("call", context, encodeStructures(methodsToCall));
        return decodeStructures(bytes, CallMethodResult.prototype);
    }

    public async historyRead(context: ISessionContext, historyReadRequest: HistoryReadRequest): Promise<HistoryReadResult[]> {
        const bytes = await this.#service<Uint8Array>("historyRead", context, encodeStructure(historyReadRequest));
        return decodeStructures(bytes, HistoryReadResult.prototype);
    }
}
