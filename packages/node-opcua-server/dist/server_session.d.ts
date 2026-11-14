/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { type AddressSpace, ContinuationPointManager, type DTSessionDiagnostics, type DTSessionSecurityDiagnostics, type IServerBase, type ISessionBase, type UADynamicVariableArray, type UAObject, type UASessionDiagnosticsVariable, type UASessionSecurityDiagnostics } from "node-opcua-address-space";
import type { ISessionContext, SessionShutdownTask } from "node-opcua-address-space-base";
import { type SessionDiagnosticsDataType, type SessionSecurityDiagnosticsDataType, SubscriptionDiagnosticsDataType } from "node-opcua-common";
import type { Certificate } from "node-opcua-crypto/web";
import { NodeId } from "node-opcua-nodeid";
import { ObjectRegistry } from "node-opcua-object-registry";
import type { IServerSession, IServerSessionBase, ServerSecureChannelLayer } from "node-opcua-secure-channel";
import { type StatusCode } from "node-opcua-status-code";
import type { ApplicationDescription, CreateSubscriptionRequestOptions, EndpointDescription, MessageSecurityMode, UserIdentityToken } from "node-opcua-types";
import { type ISubscriber, type IWatchdogData2, WatchDog } from "node-opcua-utils";
import type { ServerEngine } from "./server_engine.js";
import { ServerSidePublishEngine } from "./server_publish_engine.js";
import { type Subscription } from "./server_subscription.js";
export type SessionStatus = "new" | "active" | "screwed" | "disposed" | "closed";
/** what a Session asks of the engine it belongs to */
export type ServerSessionParent = Pick<ServerEngine, "addressSpace" | "clientDescription" | "incrementRejectedRequestsCount" | "_createSubscriptionOnSession" | "diagnosticsNamespaceIndex">;
/** the security of the channel a Session is on, as its diagnostics show it */
export interface SessionChannelSecurity {
    securityMode: MessageSecurityMode;
    securityPolicy: string;
    clientCertificate: Certificate | null;
}
export declare class ServerSession extends EventEmitter implements ISubscriber, ISessionBase, IServerSession, IServerSessionBase {
    static registry: ObjectRegistry;
    static maxPublishRequestInQueue: number;
    __status: SessionStatus;
    parent: ServerSessionParent;
    authenticationToken: NodeId;
    nodeId: NodeId;
    sessionName: string;
    publishEngine: ServerSidePublishEngine;
    sessionObject: UAObject | null;
    readonly creationDate: Date;
    sessionTimeout: number;
    sessionDiagnostics?: UASessionDiagnosticsVariable<DTSessionDiagnostics>;
    sessionSecurityDiagnostics?: UASessionSecurityDiagnostics<DTSessionSecurityDiagnostics>;
    subscriptionDiagnosticsArray?: UADynamicVariableArray<SubscriptionDiagnosticsDataType>;
    channel?: ServerSecureChannelLayer;
    nonce?: Buffer;
    userIdentityToken?: UserIdentityToken;
    /**
     * The localeIds of the Session's last successful ActivateSession, most preferred first;
     * empty until the first one. Set only through {@link ServerSession.setLocaleIds}.
     */
    localeIds: string[];
    /**
     * Set by a `userManager` during authentication to indicate that the user
     * must change the password (OPC 10000-18 §5.2.8). When true, ActivateSession
     * returns `Good_PasswordChangeRequired` so the Client can react.
     */
    passwordChangeRequired?: boolean;
    clientDescription?: ApplicationDescription;
    channelId?: number | null;
    continuationPointManager: ContinuationPointManager;
    /**
     * The Session's long-lived context, shared by every request currently in flight on this
     * Session. A Call service invocation must never write a per-request field (e.g.
     * RequestHeader) onto this instance - build a derived context with
     * `SessionContext#withRequestHeader` instead, one per CallRequest (see
     * OPCUAServer#_on_CallRequest).
     */
    sessionContext: ISessionContext;
    _watchDog?: WatchDog;
    _watchDogData?: IWatchdogData2;
    keepAlive: () => void;
    private _registeredNodesCounter;
    private _registeredNodes;
    private _registeredNodesInv;
    private _cumulatedSubscriptionCount;
    private _shutdownTasks;
    private _sessionDiagnostics?;
    /** the object behind this._sessionDiagnostics, and the proxy it was taken from */
    private _rawSessionDiagnostics?;
    private _rawSessionDiagnosticsOf?;
    private _sessionSecurityDiagnostics?;
    /** the service counters of the session diagnostics, by field name (null: no such counter) */
    private _serviceCounters;
    /** the service counters that moved since the Variables exposing them were last refreshed */
    private _staleServiceCounters;
    private _serviceCountersRefreshTime;
    private channel_abort_event_handler?;
    constructor(parent: ServerSessionParent, server: IServerBase, sessionTimeout: number);
    toJSON(): Record<string, string | number | Date | null | undefined>;
    toString(): string;
    getSessionId(): NodeId;
    endpoint?: EndpointDescription;
    getEndpointDescription(): EndpointDescription;
    getEndpointUrl(): string | undefined;
    dispose(): void;
    get clientConnectionTime(): Date;
    /**
     * return the number of milisecond since last session transaction occurs from client
     * the first transaction is the creation of the session
     */
    get clientLastContactTime(): number;
    /**
     * a Session whose timeout another thread keeps (the engine of front threads): it leaves this
     * thread's watchdog, and each keepAlive() calls `seen` instead
     */
    watchedElsewhere(seen: () => void): void;
    /** the security of the channel of a Session kept here for a channel of another thread (front threads) */
    remoteChannelSecurity?: SessionChannelSecurity;
    /** the security of the Session's channel */
    get channelSecurity(): SessionChannelSecurity | undefined;
    get status(): SessionStatus;
    set status(value: SessionStatus);
    /**
     * Records the localeIds of a successful ActivateSession.
     *
     * OPC 10000-4 v1.05.07 §5.7.3 ActivateSession, localeIds: "This parameter only needs to
     * be specified during the first call to ActivateSession during a single application
     * Session. If it is null or empty the Server shall keep using the current localeIds for
     * the Session." A null/empty/all-blank list is therefore a no-op, not a reset to [].
     */
    setLocaleIds(localeIds?: ReadonlyArray<string | null> | null): void;
    get addressSpace(): AddressSpace | null;
    get currentPublishRequestInQueue(): number;
    /**
     * the session diagnostics themselves, for reading: every request of the session looks at
     * them (see onClientSeen), and a read through the proxy in front of them is a function call.
     * A change still has to go through this._sessionDiagnostics, the proxy.
     */
    private _readableSessionDiagnostics;
    updateClientLastContactTime(): void;
    /**
     * required for watch dog
     * @param currentTime {DateTime}
     * @private
     */
    onClientSeen(): void;
    /**
     * increment a service counter of the session diagnostics.
     *
     * The counter is incremented on the object itself, not through the proxy in front of it:
     * a write through the proxy looks up the Variable exposing the field and refreshes its
     * timestamps, and two counters move on every request. The Variables take their value from
     * this very object whenever they are read or sampled, so the count they report is exact at
     * once. What is bounded instead is how often they are told about it: at once for a session
     * that is not busy, and every serviceCounterRefreshInterval for one that is.
     *
     * @returns false if the session diagnostics have no such counter
     */
    private _incrementServiceCounter;
    /** tell the Variables exposing the service counters that the counters have moved */
    private _refreshServiceCounterVariables;
    private _forgetServiceCounters;
    incrementTotalRequestCount(): void;
    incrementRequestTotalCounter(counterName: string): void;
    incrementRequestErrorCounter(counterName: string): void;
    /**
     * returns rootFolder.objects.server.serverDiagnostics.sessionsDiagnosticsSummary.sessionDiagnosticsArray
     */
    getSessionDiagnosticsArray(): UADynamicVariableArray<SessionDiagnosticsDataType>;
    /**
     * returns rootFolder.objects.server.serverDiagnostics.sessionsDiagnosticsSummary.sessionSecurityDiagnosticsArray
     */
    getSessionSecurityDiagnosticsArray(): UADynamicVariableArray<SessionSecurityDiagnosticsDataType>;
    /**
     * number of active subscriptions
     */
    get currentSubscriptionCount(): number;
    /**
     * number of subscriptions ever created since this object is live
     */
    get cumulatedSubscriptionCount(): number;
    /**
     * number of monitored items
     */
    get currentMonitoredItemCount(): number;
    /**
     * retrieve an existing subscription by subscriptionId
     * @param subscriptionId {Number}
     */
    getSubscription(subscriptionId: number): Subscription | null;
    /**
     * @param subscriptionId {Number}
     * @return {StatusCode}
     */
    deleteSubscription(subscriptionId: number): StatusCode;
    /**
     * close a ServerSession, this will also delete the subscriptions if the flag is set.
     *
     * Spec extract:
     *
     * If a Client invokes the CloseSession Service then all Subscriptions associated with the Session are also deleted
     * if the deleteSubscriptions flag is set to TRUE. If a Server terminates a Session for any other reason,
     * Subscriptions associated with the Session, are not deleted. Each Subscription has its own lifetime to protect
     * against data loss in the case of a Session termination. In these cases, the Subscription can be reassigned to
     * another Client before its lifetime expires.
     *
     * @param deleteSubscriptions : should we delete subscription ?
     * @param [reason = "CloseSession"] the reason for closing the session
     *         (shall be "Timeout", "Terminated" or "CloseSession")
     * @param [auditEntryId] the RequestHeader.auditEntryId of the CloseSession request that caused
     *        this close, when there is one (part 5 6.4.3 ClientAuditEntryId). Absent for a
     *        server-initiated close (Timeout, Terminated, Forcing), where there is no client request.
     * @returns a Promise that resolves when the shutdown tasks have settled.
     *        The Session is already closed when the call returns: all the steps up to
     *        the wait for the shutdown tasks run synchronously.
     */
    close(deleteSubscriptions: boolean, reason: string, auditEntryId?: string): Promise<void>;
    registerSessionShutdownTask(task: SessionShutdownTask): void;
    private _runShutdownTask;
    registerNode(nodeId: NodeId): NodeId;
    unRegisterNode(aliasNodeId: NodeId): void;
    /** whether the client registered nodes on this session (RegisterNodes): their aliases name them in its requests */
    hasRegisteredNodes(): boolean;
    resolveRegisteredNode(aliasNodeId: NodeId): NodeId;
    /**
     * true if the underlying channel has been closed or aborted...
     */
    get aborted(): boolean;
    /** `id`: the id the subscription keeps, when it comes from another thread of the server */
    createSubscription(parameters: CreateSubscriptionRequestOptions, id?: number): Subscription;
    _attach_channel(channel: ServerSecureChannelLayer): void;
    _detach_channel(): void;
    _exposeSubscriptionDiagnostics(subscription: Subscription): void;
    _unexposeSubscriptionDiagnostics(subscription: Subscription): void;
    /**
     * used as a callback for the Watchdog
     * @private
     */
    watchdogReset(): void;
    private _createSessionObjectInAddressSpace;
    resendMonitoredItemInitialValues(): Promise<void>;
    /**
     *
     * @private
     */
    private _removeSessionObjectFromAddressSpace;
    /**
     *
     * @private
     */
    private _getSubscriptionDiagnosticsArray;
    private assignSubscription;
    private _deleteSubscriptions;
}
//# sourceMappingURL=server_session.d.ts.map