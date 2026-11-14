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
import type { ServerState } from "node-opcua-common";
import { DataValue } from "node-opcua-data-value";
import { type NodeId } from "node-opcua-nodeid";
import { type HistoryReadRequest, HistoryReadResult } from "node-opcua-service-history";
import { TransferResult } from "node-opcua-service-subscription";
import { type StatusCode } from "node-opcua-status-code";
import { ApplicationDescription, type BrowseDescription, type BrowsePath, BrowsePathResult, BrowseResult, BuildInfo, type CallMethodRequest, type CallMethodResultOptions, type ReadRequestOptions, type WriteValue } from "node-opcua-types";
import type { INodeFinder } from "../monitorable_node.js";
import type { OPCUAServerOptions } from "../opcua_server.js";
import { ServerCapabilities } from "../server_capabilities.js";
import type { ClosingReason, CreateSessionOption } from "../server_engine.js";
import type { IServerEngineForServer } from "../server_engine_interface.js";
import { ServerSession, type ServerSessionParent } from "../server_session.js";
import type { Subscription } from "../server_subscription.js";
import { type EngineServerState, type SessionActivation, type SessionRecord, type SessionState } from "./protocol.js";
import type { EngineChannel, RemoteCompactBackend } from "./remote_backend.js";
export declare class RemoteEngine extends EventEmitter implements IServerEngineForServer, ServerSessionParent {
    #private;
    _internalState: "creating" | "initializing" | "initialized" | "shutdown" | "disposed";
    readonly serverCapabilities: ServerCapabilities;
    readonly isAuditing: boolean;
    /** where the Sessions get their NodeId: the engine's (see OPCUAServerOptions.diagnosticsNamespaceUri) */
    readonly diagnosticsNamespaceIndex: number;
    /** a front holds no address space: the engine's is the only one */
    readonly addressSpace: AddressSpace | null;
    clientDescription?: ApplicationDescription;
    protected readonly sessions: Map<string, ServerSession>;
    /** the store this front reads in place */
    get backend(): RemoteCompactBackend;
    constructor(state: EngineServerState, channel: EngineChannel, backend: RemoteCompactBackend);
    initialize(_options: OPCUAServerOptions, callback: (err?: Error | null) => void): void;
    shutdown(): Promise<void>;
    dispose(): void;
    isStarted(): boolean;
    getServerState(): ServerState;
    /** the state of the one server is the engine's: a front starting or stopping does not change it */
    setServerState(_serverState: ServerState): void;
    setShutdownTime(_date: Date): void;
    getInApplicationSetup(): boolean;
    setInApplicationSetup(_value: boolean): void;
    get buildInfo(): BuildInfo;
    registerCompactNamespace(_namespaceUri: string): number;
    get currentSessionCount(): number;
    get rejectedSessionCount(): number;
    get rejectedRequestsCount(): number;
    get sessionAbortCount(): number;
    incrementRejectedSessionCount(): void;
    incrementSecurityRejectedSessionCount(): void;
    incrementRejectedRequestsCount(): void;
    /** room for one more session, made by the engine for all the fronts */
    admitSession(): Promise<boolean>;
    createSession(options?: CreateSessionOption): ServerSession;
    getSession(authenticationToken: NodeId, activeOnly?: boolean): ServerSession | null;
    /** the tokens of the sessions this thread holds */
    sessionTokens(): IterableIterator<string>;
    getOldestInactiveSession(): ServerSession | null;
    /** answered once the engine has closed its record too: the client then sees the session counted out */
    closeSession(authenticationToken: NodeId, deleteSubscriptions: boolean, reason: ClosingReason, auditEntryId?: string): Promise<void>;
    /** the engine closed this session (timeout, room made for another): the front closes its half */
    sessionClosedByEngine(token: string, reason: string): void;
    /**
     * a session of this front another front goes on with: its state. The session is set aside, still
     * attached to its channel, until the engine says whether the other front activated it (forgetSession)
     */
    releaseSession(token: string): SessionState | null;
    /** the session set aside was activated on another front */
    forgetSession(token: string): void;
    /** the ActivateSession on another front was refused: this front goes on with the session it set aside */
    restoreSession(token: string): void;
    /**
     * a session taken from another front whose ActivateSession was refused here: it goes back there,
     * untouched, as a refused ActivateSession leaves a session of a single-thread server.
     * Resolves once the engine has handed it back.
     */
    returnSession(session: ServerSession): Promise<void> | undefined;
    /**
     * a session another front holds, taken over before an ActivateSession on a channel of this one;
     * `server` resolves the roles of its user, as for the sessions this front creates
     */
    takeSession(authenticationToken: NodeId, server: IServerBase): Promise<ServerSession | null>;
    /** the session worker that hosts the subscriptions of a session; -1 for none */
    workerOf(token: string): Promise<number>;
    /** a session of this thread rebuilt from what another thread knows of it */
    protected sessionFrom(record: SessionRecord, activation: SessionActivation | null, server: IServerBase): ServerSession;
    /** an event raised in this front: the engine raises it on its Server object */
    raiseEvent(eventType: string, fields: Record<string, Uint8Array>): void;
    /** an ActivateSession goes through: the engine learns the user (its roles) and the new channel */
    sessionActivated(session: ServerSession): Promise<void> | undefined;
    recordOf(session: ServerSession): SessionRecord;
    activationOf(session: ServerSession): SessionActivation | null;
    /** what a session did (seen, a service counter), which the engine's record counts at the end of the turn */
    noteActivity(token: string, counter: string | null, error: number): void;
    get currentSubscriptionCount(): number;
    get publishingIntervalCount(): number;
    _createSubscriptionOnSession(_session: ServerSession, _parameters: unknown, _id?: number): Subscription;
    findOrphanSubscription(_subscriptionId: number): Subscription | null;
    mayDeleteOrphanSubscription(_session: ServerSession, _subscription: Subscription): boolean;
    deleteOrphanSubscription(_subscription: Subscription): StatusCode;
    transferSubscription(_session: ServerSession, _subscriptionId: number, _sendInitialValues: boolean): Promise<TransferResult>;
    prepareMonitoredItems(): Promise<void> | undefined;
    monitoredItemsReady(): Promise<void> | undefined;
    get nodeFinder(): INodeFinder;
    prepareRead(context: ISessionContext, readRequest: ReadRequestOptions, callback: (err?: Error | null) => void): void;
    readSync(context: ISessionContext, readRequest: ReadRequestOptions): DataValue[];
    refreshValues(_nodesToRefresh: unknown, _maxAge: number, callback: (err: Error | null, dataValues?: DataValue[]) => void): void;
    write(context: ISessionContext, nodesToWrite: WriteValue[]): Promise<StatusCode[]>;
    /** a Write of WriteValues as the client encoded them (their count, then them), to the engine as they are */
    writeEncoded(context: ISessionContext, nodesToWrite: Uint8Array): Promise<StatusCode[]>;
    browseWithAutomaticExpansion(nodesToBrowse: BrowseDescription[], context: ISessionContext): Promise<BrowseResult[]>;
    translateBrowsePaths(browsePaths: BrowsePath[], context?: ISessionContext): Promise<BrowsePathResult[]>;
    call(context: ISessionContext, methodsToCall: CallMethodRequest[]): Promise<CallMethodResultOptions[]>;
    historyRead(context: ISessionContext, historyReadRequest: HistoryReadRequest): Promise<HistoryReadResult[]>;
}
//# sourceMappingURL=remote_engine.d.ts.map