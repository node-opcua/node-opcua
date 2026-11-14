/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { AddressSpace, type CompactAddressSpace, type IServerBase, type ISessionContext } from "node-opcua-address-space";
import type { CreateSubscriptionRequestLike } from "node-opcua-client";
import { ServerDiagnosticsSummaryDataType, ServerState, ServerStatusDataType } from "node-opcua-common";
import { type LocalizedTextLike } from "node-opcua-data-model";
import type { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { ObjectRegistry } from "node-opcua-object-registry";
import type { BrowseResult } from "node-opcua-service-browse";
import { ApplicationDescription } from "node-opcua-service-endpoints";
import type { HistoryReadRequest, HistoryReadResult, HistoryReadValueId } from "node-opcua-service-history";
import { TransferResult } from "node-opcua-service-subscription";
import { type StatusCode } from "node-opcua-status-code";
import { ApplicationType, type BrowseDescription, type BrowseDescriptionOptions, type BrowsePath, type BrowsePathResult, type BuildInfo, type BuildInfoOptions, type CallMethodRequest, type CallMethodResultOptions, type MonitoredItemCreateRequest, type ReadRequestOptions, ReadValueId, type WriteValue } from "node-opcua-types";
import { HistoryServerCapabilities, type HistoryServerCapabilitiesOptions } from "./history_server_capabilities.js";
import type { IAddressSpaceAccessor } from "./i_address_space_accessor.js";
import type { INodeFinder } from "./monitorable_node.js";
import type { OPCUAServerOptions } from "./opcua_server.js";
import { ServerCapabilities, type ServerCapabilitiesOptions } from "./server_capabilities.js";
import { ServerSession } from "./server_session.js";
import { Subscription } from "./server_subscription.js";
export declare function setNextSubscriptionId(n: number): void;
export type StringGetter = () => string;
export type StringArrayGetter = () => string[];
export type ApplicationTypeGetter = () => ApplicationType;
export type BooleanGetter = () => boolean;
export interface ServerConfigurationOptions {
    applicationUri?: string | StringGetter;
    applicationType?: ApplicationType | ApplicationTypeGetter;
    hasSecureElement?: boolean | BooleanGetter;
    multicastDnsEnabled?: boolean | BooleanGetter;
    productUri?: string | StringGetter;
    /**
     * The SupportedPrivateKeyFormats specifies the PrivateKey formats supported by the Server.
     * Possible values include “PEM” (see RFC 5958) or “PFX” (see PKCS #12).
     * @default ["PEM"]
     */
    supportedPrivateKeyFormat: string[] | StringArrayGetter;
    /**
     * The ServerCapabilities Property specifies the capabilities from Annex D
     * ( see https://reference.opcfoundation.org/GDS/v104/docs/D)  which the Server supports. The value is
     * the same as the value reported to the LocalDiscoveryServer when the Server calls the RegisterServer2 Service.
     */
    serverCapabilities?: string[] | StringArrayGetter;
}
export interface ServerEngineOptions {
    applicationUri: string | StringGetter;
    buildInfo?: BuildInfoOptions;
    isAuditing?: boolean;
    /**
     * set to true to enable serverDiagnostics
     */
    serverDiagnosticsEnabled?: boolean;
    serverCapabilities?: ServerCapabilitiesOptions;
    historyServerCapabilities?: HistoryServerCapabilitiesOptions;
    serverConfiguration?: ServerConfigurationOptions;
    /**
     * the namespace of the nodes the server creates while it runs: Sessions (their NodeId, their
     * object and diagnostics) and the diagnostics of Subscriptions. Registered at initialize; the
     * server's own namespace (1) when not given.
     */
    diagnosticsNamespaceUri?: string;
    /**
     * OPC UA Part 4 §5.13.7 (TransferSubscriptions): an anonymous session's Subscription may only be
     * transferred over a Sign or SignAndEncrypt channel to a client with the same ApplicationUri.
     * `false` (the default) enforces the rule; `true` relaxes it and accepts anonymous-to-anonymous
     * transfers over an unsecured channel (the behaviour before 2.183.0). See OPCUAServerOptions.
     * @default false
     */
    allowAnonymousSubscriptionTransferOnUnsecuredChannel?: boolean;
}
export interface CreateSessionOption {
    clientDescription?: ApplicationDescription;
    sessionTimeout?: number;
    server?: IServerBase;
    /** the ids of a Session created elsewhere (a front thread) that this engine keeps the record of */
    ids?: {
        nodeId: NodeId;
        authenticationToken: NodeId;
    };
}
export type ClosingReason = "Timeout" | "Terminated" | "CloseSession" | "Forcing";
export type ServerEngineShutdownTask = (this: ServerEngine) => void | Promise<void>;
/**
 *
 */
export declare class ServerEngine extends EventEmitter implements IAddressSpaceAccessor {
    #private;
    static readonly registry: ObjectRegistry;
    isAuditing: boolean;
    allowAnonymousSubscriptionTransferOnUnsecuredChannel: boolean;
    serverDiagnosticsSummary: ServerDiagnosticsSummaryDataType;
    serverDiagnosticsEnabled: boolean;
    serverCapabilities: ServerCapabilities;
    historyServerCapabilities: HistoryServerCapabilities;
    serverConfiguration: ServerConfigurationOptions;
    clientDescription?: ApplicationDescription;
    addressSpace: AddressSpace | null;
    /** the namespace of the Sessions and of the diagnostics of the Subscriptions (see diagnosticsNamespaceUri) */
    get diagnosticsNamespaceIndex(): number;
    /** the compact address space, when the engine was initialized with one */
    compactAddressSpace: CompactAddressSpace | null;
    addressSpaceAccessor: IAddressSpaceAccessor | null;
    _internalState: "creating" | "initializing" | "initialized" | "shutdown" | "disposed";
    private _sessions;
    private _closedSessions;
    /** the sessions of _sessions, by the bytes of their authentication token: see getSession */
    private _sessionsByToken;
    private _orphanPublishEngine?;
    private _shutdownTasks;
    private _applicationUri;
    private _expectedShutdownTime;
    private _serverStatus;
    private _globalCounter;
    private _serverArrayProvider?;
    constructor(options?: ServerEngineOptions);
    isStarted(): boolean;
    dispose(): void;
    get startTime(): Date;
    get currentTime(): Date;
    get buildInfo(): BuildInfo;
    /**
     * register a function that will be called when the server will perform its shut down.
     */
    registerShutdownTask(task: ServerEngineShutdownTask): void;
    /**
     */
    shutdown(): Promise<void>;
    /**
     * the number of active sessions
     */
    get currentSessionCount(): number;
    /**
     * the cumulated number of sessions that have been opened since this object exists
     */
    get cumulatedSessionCount(): number;
    /**
     * the number of active subscriptions.
     */
    get currentSubscriptionCount(): number;
    /**
     * the cumulated number of subscriptions that have been created since this object exists
     */
    get cumulatedSubscriptionCount(): number;
    get rejectedSessionCount(): number;
    get rejectedRequestsCount(): number;
    get sessionAbortCount(): number;
    get sessionTimeoutCount(): number;
    get publishingIntervalCount(): number;
    incrementSessionTimeoutCount(): void;
    incrementSessionAbortCount(): void;
    incrementRejectedRequestsCount(): void;
    /**
     * increment rejected session count (also increment rejected requests count)
     */
    incrementRejectedSessionCount(): void;
    incrementSecurityRejectedRequestsCount(): void;
    /**
     * increment rejected session count (also increment rejected requests count)
     */
    incrementSecurityRejectedSessionCount(): void;
    setShutdownTime(date: Date): void;
    setShutdownReason(reason: LocalizedTextLike): void;
    /**
     * @return the approximate number of seconds until the server will be shut down. The
     * value is only relevant once the state changes into SHUTDOWN.
     */
    secondsTillShutdown(): number;
    /**
     * the name of the server
     */
    get serverName(): string;
    /**
     * the server urn
     */
    get serverNameUrn(): string;
    /**
     * Install a provider that contributes additional entries to the `Server_ServerArray`
     * variable (ns=0;i=2254).
     *
     * OPC 10000-17 (GDS) Annex C.2 requires an aggregating server to expose the ServerUri
     * of every aggregated server in its ServerArray, so that `ExpandedNodeId.serverIndex`
     * values returned by services such as `FindAlias` can be resolved by clients.
     *
     * The ServerArray value served to clients is `[serverNameUrn, ...provider()]`:
     * index 0 always remains this server's own URI, and the provider supplies the
     * entries for indices 1..n.
     *
     * Index-stability contract: a `serverIndex` handed out to clients must keep
     * designating the same server for the lifetime of this server. The provider must
     * therefore never reorder or compact its array when a server is withdrawn; instead
     * it must leave an empty-string hole at the withdrawn position so that subsequent
     * indices do not shift.
     *
     * The provider is consulted on every read of the variable, so its result should be
     * cheap to compute (e.g. a cached array). Pass `null` to remove a previously
     * installed provider. The provider may be installed before or after the server is
     * started.
     */
    setServerArrayProvider(provider: (() => string[]) | null): void;
    /**
     * the urn of the server namespace
     */
    get serverNamespaceUrn(): string;
    get serverStatus(): ServerStatusDataType;
    setServerState(serverState: ServerState): void;
    getServerState(): ServerState;
    /**
     * Set the `ServerConfiguration.InApplicationSetup` property
     * in the address space.
     *
     * This flag indicates whether the server is currently in
     * its initial application setup phase (e.g. waiting for
     * GDS provisioning).
     */
    setInApplicationSetup(value: boolean): void;
    /**
     * Read the current value of
     * `ServerConfiguration.InApplicationSetup`.
     *
     * Returns `false` if the property does not exist in
     * the address space.
     */
    getInApplicationSetup(): boolean;
    getServerDiagnosticsEnabledFlag(): boolean;
    /**
     *
     */
    initialize(options: OPCUAServerOptions, callback: (err?: Error | null) => void): void;
    browseWithAutomaticExpansion(nodesToBrowse: BrowseDescription[], context: ISessionContext): Promise<BrowseResult[]>;
    browse(context: ISessionContext, nodesToBrowse: BrowseDescriptionOptions[]): Promise<BrowseResult[]>;
    read(context: ISessionContext, readRequest: ReadRequestOptions): Promise<DataValue[]>;
    /** read, without a promise: see AddressSpaceAccessor#readSync */
    readSync(context: ISessionContext, readRequest: ReadRequestOptions): DataValue[];
    write(context: ISessionContext, nodesToWrite: WriteValue[]): Promise<StatusCode[]>;
    call(context: ISessionContext, methodsToCall: CallMethodRequest[]): Promise<CallMethodResultOptions[]>;
    historyRead(context: ISessionContext, historyReadRequest: HistoryReadRequest): Promise<HistoryReadResult[]>;
    /**
     * whether one more Session fits (OPC 10000-4 5.6.2): when the server is full, the oldest Session
     * not activated yet is closed to make room, and a Session is refused only if none is
     */
    admitSession(): Promise<boolean>;
    getOldestInactiveSession(): ServerSession | null;
    /**
     * create a new server session object.
     */
    createSession(options?: CreateSessionOption): ServerSession;
    /**
     * @param authenticationToken
     * @param deleteSubscriptions {Boolean} : true if session's subscription shall be deleted
     * @param {String} [reason = "CloseSession"] the reason for closing the session (
     *                 shall be "Timeout", "Terminated" or "CloseSession")
     * @param [auditEntryId] the RequestHeader.auditEntryId of the CloseSession request that caused
     *        this close, when there is one. See ServerSession#close.
     *
     *
     * what the specs say:
     * -------------------
     *
     * If a Client invokes the CloseSession Service then all Subscriptions associated with the Session are also deleted
     * if the deleteSubscriptions flag is set to TRUE. If a Server terminates a Session for any other reason,
     * Subscriptions associated with the Session, are not deleted. Each Subscription has its own lifetime to protect
     * against data loss in the case of a Session termination. In these cases, the Subscription can be reassigned to
     * another Client before its lifetime expires.
     */
    closeSession(authenticationToken: NodeId, deleteSubscriptions: boolean, reason: ClosingReason, auditEntryId?: string): Promise<void>;
    findSubscription(subscriptionId: number): Subscription | null;
    findOrphanSubscription(subscriptionId: number): Subscription | null;
    /**
     * OPC 10000-4: a Session may delete an orphaned Subscription only when it acts for the user that
     * owns it, the same ownership rule TransferSubscriptions applies. The identity kept on the
     * Subscription at the moment of orphaning answers this; when it cannot be established we fail
     * closed (return false).
     */
    mayDeleteOrphanSubscription(session: ServerSession, subscription: Subscription): boolean;
    deleteOrphanSubscription(subscription: Subscription): StatusCode;
    /**
     * @param session           {ServerSession}  - the new session that will own the subscription
     * @param subscriptionId    {IntegerId}      - the subscription Id to transfer
     * @param sendInitialValues {Boolean}        - true if initial values will be resent.
     * @return                  {TransferResult}
     */
    transferSubscription(session: ServerSession, subscriptionId: number, sendInitialValues: boolean): Promise<TransferResult>;
    /**
     * retrieve a session by its authenticationToken.
     *
     * @param authenticationToken
     * @param activeOnly
     * @return {ServerSession}
     */
    /** A snapshot of all sessions currently tracked by the engine (active and pending). */
    getSessions(): ServerSession[];
    getSession(authenticationToken: NodeId, activeOnly?: boolean): ServerSession | null;
    translateBrowsePaths(browsePaths: BrowsePath[], context?: ISessionContext): Promise<BrowsePathResult[]>;
    translateBrowsePath(browsePath: BrowsePath, context?: ISessionContext): Promise<BrowsePathResult>;
    /**
     * where the nodes to monitor are found: the node objects, and the compact address space for
     * the namespaces it serves
     */
    get nodeFinder(): INodeFinder;
    /**
     * a namespace of the application served by the compact address space: registered on the
     * node objects as well, so that the NamespaceArray and the indexes are one; nodes are then
     * added through the compact space's own API (addVariable, addObject, bindings)
     */
    registerCompactNamespace(namespaceUri: string): number;
    /**
     *
     * performs a call to ```asyncRefresh``` on all variable nodes that provide an async refresh func.
     *
     * @param nodesToRefresh {Array<ReadValueId|HistoryReadValueId>}  an array containing the node to consider
     * Each element of the array shall be of the form { nodeId: <xxx>, attributeIds: <value> }.
     * @param maxAge {number}  the maximum age of the value to be read, in milliseconds.
     * @param callback
     *
     */
    /**
     * what a Read needs before its values are read: the asynchronous Variables refreshed (a front
     * thread's engine fetches there what it cannot read in place, see RemoteEngine)
     */
    prepareRead(context: ISessionContext, readRequest: ReadRequestOptions, callback: (err?: Error | null) => void): void;
    /**
     * before the items of a CreateMonitoredItems are created: what must be fetched to find their
     * nodes synchronously. Nothing here, where every node is (a session worker fetches them).
     */
    prepareMonitoredItems(_context: ISessionContext, _itemsToCreate: MonitoredItemCreateRequest[]): Promise<void> | undefined;
    /**
     * once the items of a CreateMonitoredItems (or a SetMonitoringMode, a ModifyMonitoredItems) are made: what
     * they must wait for before the client hears of them. Nothing here, where items sample this engine's nodes
     * directly (a session worker waits for its engine to watch them).
     */
    monitoredItemsReady(): Promise<void> | undefined;
    refreshValues(nodesToRefresh: ReadValueId[] | HistoryReadValueId[], maxAge: number, 
    /**
     * @param err
     * @param dataValues an array containing value read
     * The array length matches the number of  nodeIds that are candidate for an
     * async refresh (i.e: nodes that are of type Variable with asyncRefresh func }
     */
    callback: (err: Error | null, dataValues?: DataValue[]) => void, 
    /** the session context of the read: given to the refresh function of each Variable */
    context?: ISessionContext): void;
    private _exposeSubscriptionDiagnostics;
    protected _unexposeSubscriptionDiagnostics(subscription: Subscription): void;
    /**
     * create a new subscription
     * @return {Subscription}
     */
    /** `id`: the id the subscription keeps, when it comes from another thread of the server */
    _createSubscriptionOnSession(session: ServerSession, request: CreateSubscriptionRequestLike, id?: number): Subscription;
    /**
     */
    private __internal_bindMethod;
    private _getServerSubscriptionDiagnosticsArrayNode;
}
//# sourceMappingURL=server_engine.d.ts.map