/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { addElement, ContinuationPointManager, createExtObjArrayNode, ensureObjectIsSecure, removeElement, SessionContext } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { getMinOPCUADate, randomGuid } from "node-opcua-basic-types";
import { SubscriptionDiagnosticsDataType } from "node-opcua-common";
import { NodeClass, QualifiedName } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { makeNodeId, NodeId, NodeIdType, sameNodeId } from "node-opcua-nodeid";
import { ObjectRegistry } from "node-opcua-object-registry";
import { StatusCodes } from "node-opcua-status-code";
import { lowerFirstLetter, randomBytes, WatchDog } from "node-opcua-utils";
import { ServerSidePublishEngine } from "./server_publish_engine.js";
import { SubscriptionState } from "./server_subscription.js";
const debugLog = make_debugLog("server_session");
const errorLog = make_errorLog("server_session");
const doDebug = checkDebugFlag("server_session");
const theWatchDog = new WatchDog();
const registeredNodeNameSpace = 9999;
// "Read" => "readCount", the field of SessionDiagnosticsDataType that counts the service.
// There is one per service and it is needed on every response: build each name once.
const serviceCounterNames = new Map();
function serviceCounterName(counterName) {
    let propName = serviceCounterNames.get(counterName);
    if (propName === undefined) {
        propName = lowerFirstLetter(`${counterName}Count`);
        serviceCounterNames.set(counterName, propName);
    }
    return propName;
}
function on_channel_abort() {
    /* c8 ignore next */
    doDebug && debugLog("ON CHANNEL ABORT ON  SESSION!!!");
    /**
     * @event channel_aborted
     */
    this.emit("channel_aborted");
}
/** the object behind the proxies, which are nested: one per Variable exposing the object */
function unproxied(proxied) {
    let raw = proxied;
    for (;;) {
        const target = raw.$proxyTarget;
        if (!target) {
            return raw;
        }
        raw = target;
    }
}
/**
 * how long, in milliseconds, the Variables exposing the service counters may go without being
 * refreshed while the counters keep moving: the bound clientLastContactTime already lives with
 */
const serviceCounterRefreshInterval = 250;
/**
 *
 * A Server session object.
 *
 * **from OPCUA Spec 1.02:**
 *
 * * Sessions are created to be independent of the underlying communications connection. Therefore, if a communication
 *   connection fails, the Session is not immediately affected. The exact mechanism to recover from an underlying
 *   communication connection error depends on the SecureChannel mapping as described in Part 6.
 *
 * * Sessions are terminated by the Server automatically if the Client fails to issue a Service request on the Session
 *   within the timeout period negotiated by the Server in the CreateSession Service response. This protects the Server
 *   against Client failures and against situations where a failed underlying connection cannot be re-established.
 *
 * * Clients shall be prepared to submit requests in a timely manner to prevent the Session from closing automatically.
 *
 * * Clients may explicitly terminate Sessions using the CloseSession Service.
 *
 * * When a Session is terminated, all outstanding requests on the Session are aborted and BadSessionClosed StatusCodes
 *   are returned to the Client. In addition, the Server deletes the entry for the Client from its
 *   SessionDiagnosticsArray Variable and notifies any other Clients who were subscribed to this entry.
 *
 */
/**
 * headroom above the one-"abort"-listener-per-session baseline, for the handlers
 * the endpoint and the reverse-connect manager register on the same channel.
 */
const EXTRA_CHANNEL_LISTENERS = 10;
export class ServerSession extends EventEmitter {
    static registry = new ObjectRegistry();
    static maxPublishRequestInQueue = 100;
    __status = "new";
    parent;
    authenticationToken;
    nodeId;
    sessionName = "";
    publishEngine;
    sessionObject = null;
    creationDate;
    sessionTimeout;
    sessionDiagnostics;
    sessionSecurityDiagnostics;
    subscriptionDiagnosticsArray;
    channel;
    nonce;
    userIdentityToken;
    /**
     * The localeIds of the Session's last successful ActivateSession, most preferred first;
     * empty until the first one. Set only through {@link ServerSession.setLocaleIds}.
     */
    localeIds = [];
    /**
     * Set by a `userManager` during authentication to indicate that the user
     * must change the password (OPC 10000-18 §5.2.8). When true, ActivateSession
     * returns `Good_PasswordChangeRequired` so the Client can react.
     */
    passwordChangeRequired;
    clientDescription;
    channelId;
    continuationPointManager;
    /**
     * The Session's long-lived context, shared by every request currently in flight on this
     * Session. A Call service invocation must never write a per-request field (e.g.
     * RequestHeader) onto this instance - build a derived context with
     * `SessionContext#withRequestHeader` instead, one per CallRequest (see
     * OPCUAServer#_on_CallRequest).
     */
    sessionContext;
    // ISubscriber
    _watchDog;
    _watchDogData;
    keepAlive = WatchDog.emptyKeepAlive;
    _registeredNodesCounter;
    _registeredNodes;
    _registeredNodesInv;
    _cumulatedSubscriptionCount;
    _shutdownTasks = [];
    _sessionDiagnostics;
    /** the object behind this._sessionDiagnostics, and the proxy it was taken from */
    _rawSessionDiagnostics;
    _rawSessionDiagnosticsOf;
    _sessionSecurityDiagnostics;
    /** the service counters of the session diagnostics, by field name (null: no such counter) */
    _serviceCounters = new Map();
    /** the service counters that moved since the Variables exposing them were last refreshed */
    _staleServiceCounters = new Set();
    _serviceCountersRefreshTime = 0;
    channel_abort_event_handler;
    constructor(parent, server, sessionTimeout) {
        super();
        this.parent = parent; // SessionEngine
        ServerSession.registry.register(this);
        // The whole IServerBase, not a `{ userManager }` wrapper around one of
        // its fields: SessionContext.getCurrentUserRoles also consults
        // server.roleResolvers (OPC 10000-18 §4.4 identity mapping),
        // server.rolePolicyOverride and server.unresolvedPermissionPolicy.
        // Wrapping the manager alone made all three invisible to every real
        // session, so e.g. a Thumbprint rule accepted by AddIdentity was never
        // applied when the matching X509 session actually connected.
        this.sessionContext = new SessionContext({
            session: this,
            server
        });
        assert(Number.isFinite(sessionTimeout));
        assert(sessionTimeout >= 0, " sessionTimeout");
        this.sessionTimeout = sessionTimeout;
        const authenticationTokenBuf = randomBytes(16);
        this.authenticationToken = new NodeId(NodeIdType.BYTESTRING, authenticationTokenBuf);
        // the sessionId
        // the server's own namespace (1) unless it keeps its runtime nodes in one of their own
        this.nodeId = new NodeId(NodeIdType.GUID, randomGuid(), parent.diagnosticsNamespaceIndex ?? 1);
        assert(this.authenticationToken instanceof NodeId);
        assert(this.nodeId instanceof NodeId);
        this._cumulatedSubscriptionCount = 0;
        this.publishEngine = new ServerSidePublishEngine({
            maxPublishRequestInQueue: ServerSession.maxPublishRequestInQueue
        });
        this.publishEngine.setMaxListeners(100);
        theWatchDog.addSubscriber(this, this.sessionTimeout);
        this.__status = "new";
        /**
         * the continuation point manager for this session
         * @property continuationPointManager
         * @type {ContinuationPointManager}
         */
        this.continuationPointManager = new ContinuationPointManager();
        /**
         * @property creationDate
         * @type {Date}
         */
        this.creationDate = new Date();
        this._registeredNodesCounter = 0;
        this._registeredNodes = {};
        this._registeredNodesInv = {};
    }
    toJSON() {
        return {
            sessionName: this.sessionName,
            sessionId: this.nodeId.toString(),
            status: this.__status,
            clientConnectionTime: this.creationDate,
            sessionTimeout: this.sessionTimeout,
            clientDescription: this.clientDescription ? this.clientDescription.applicationName.text : ""
        };
    }
    toString() {
        return `ServerSession(sessionName="${this.sessionName}", sessionId=${this.nodeId.toString()})`;
    }
    [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.toString();
    }
    getSessionId() {
        return this.nodeId;
    }
    endpoint;
    getEndpointDescription() {
        if (!this.endpoint) {
            throw new Error("getEndpointDescription: session has no endpoint set");
        }
        return this.endpoint;
    }
    getEndpointUrl() {
        return this.endpoint?.endpointUrl ?? undefined;
    }
    dispose() {
        /* c8 ignore next */
        doDebug && debugLog("ServerSession#dispose()");
        assert(!this.sessionObject, " sessionObject has not been cleared !");
        this.parent = null;
        this.authenticationToken = new NodeId();
        if (this.publishEngine) {
            this.publishEngine.dispose();
            this.publishEngine = null;
        }
        this._sessionDiagnostics = undefined;
        this._forgetServiceCounters();
        this._registeredNodesCounter = 0;
        this._registeredNodes = {};
        this._registeredNodesInv = {};
        this.continuationPointManager = null;
        this.removeAllListeners();
        this.__status = "disposed";
        ServerSession.registry.unregister(this);
    }
    get clientConnectionTime() {
        return this.creationDate;
    }
    /**
     * return the number of milisecond since last session transaction occurs from client
     * the first transaction is the creation of the session
     */
    get clientLastContactTime() {
        const lastSeen = this._watchDogData ? this._watchDogData.lastSeen : getMinOPCUADate().getTime();
        return WatchDog.lastSeenToDuration(lastSeen);
    }
    /**
     * a Session whose timeout another thread keeps (the engine of front threads): it leaves this
     * thread's watchdog, and each keepAlive() calls `seen` instead
     */
    watchedElsewhere(seen) {
        theWatchDog.removeSubscriber(this);
        this.keepAlive = seen;
    }
    /** the security of the channel of a Session kept here for a channel of another thread (front threads) */
    remoteChannelSecurity;
    /** the security of the Session's channel */
    get channelSecurity() {
        return this.channel ?? this.remoteChannelSecurity;
    }
    get status() {
        return this.__status;
    }
    set status(value) {
        if (value === "active") {
            this._createSessionObjectInAddressSpace();
        }
        if (this.__status !== value) {
            this.emit("statusChanged", value);
        }
        this.__status = value;
    }
    /**
     * Records the localeIds of a successful ActivateSession.
     *
     * OPC 10000-4 v1.05.07 §5.7.3 ActivateSession, localeIds: "This parameter only needs to
     * be specified during the first call to ActivateSession during a single application
     * Session. If it is null or empty the Server shall keep using the current localeIds for
     * the Session." A null/empty/all-blank list is therefore a no-op, not a reset to [].
     */
    setLocaleIds(localeIds) {
        if (!localeIds) {
            return;
        }
        const cleaned = localeIds.filter((l) => typeof l === "string" && l.length > 0);
        if (cleaned.length === 0) {
            return;
        }
        this.localeIds = cleaned;
    }
    get addressSpace() {
        if (this.parent?.addressSpace) {
            return this.parent.addressSpace;
        }
        return null;
    }
    get currentPublishRequestInQueue() {
        return this.publishEngine ? this.publishEngine.pendingPublishRequestCount : 0;
    }
    /**
     * the session diagnostics themselves, for reading: every request of the session looks at
     * them (see onClientSeen), and a read through the proxy in front of them is a function call.
     * A change still has to go through this._sessionDiagnostics, the proxy.
     */
    _readableSessionDiagnostics() {
        if (this._rawSessionDiagnosticsOf !== this._sessionDiagnostics) {
            this._rawSessionDiagnosticsOf = this._sessionDiagnostics;
            this._rawSessionDiagnostics = this._sessionDiagnostics && unproxied(this._sessionDiagnostics);
        }
        return this._rawSessionDiagnostics;
    }
    updateClientLastContactTime() {
        const lastContactTime = this._readableSessionDiagnostics()?.clientLastContactTime;
        if (lastContactTime && this._sessionDiagnostics) {
            const currentTime = Date.now();
            // do not record all ticks as this may be overwhelming,
            if (currentTime - 250 >= lastContactTime.getTime()) {
                this._sessionDiagnostics.clientLastContactTime = new Date(currentTime);
            }
        }
    }
    /**
     * required for watch dog
     * @param currentTime {DateTime}
     * @private
     */
    onClientSeen() {
        this.updateClientLastContactTime();
        const current = this._readableSessionDiagnostics();
        if (current && this._sessionDiagnostics) {
            // see https://opcfoundation-onlineapplications.org/mantis/view.php?id=4111
            assert(Object.hasOwn(current, "currentMonitoredItemsCount"));
            assert(Object.hasOwn(current, "currentSubscriptionsCount"));
            assert(Object.hasOwn(current, "currentPublishRequestsInQueue"));
            // note : https://opcfoundation-onlineapplications.org/mantis/view.php?id=4111
            // sessionDiagnostics extension object uses a different spelling
            // here with an S !!!!
            const monitoredItemCount = this.currentMonitoredItemCount;
            if (current.currentMonitoredItemsCount !== monitoredItemCount) {
                this._sessionDiagnostics.currentMonitoredItemsCount = monitoredItemCount;
            }
            const subscriptionCount = this.currentSubscriptionCount;
            if (current.currentSubscriptionsCount !== subscriptionCount) {
                this._sessionDiagnostics.currentSubscriptionsCount = subscriptionCount;
            }
            const publishRequestInQueue = this.currentPublishRequestInQueue;
            if (current.currentPublishRequestsInQueue !== publishRequestInQueue) {
                this._sessionDiagnostics.currentPublishRequestsInQueue = publishRequestInQueue;
            }
        }
    }
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
    _incrementServiceCounter(propName, field) {
        let counter = this._serviceCounters.get(propName);
        if (counter === undefined) {
            const proxied = this._sessionDiagnostics[propName];
            counter = proxied ? { raw: unproxied(proxied), proxied, staleTotalCount: false, staleErrorCount: false } : null;
            this._serviceCounters.set(propName, counter);
        }
        if (!counter) {
            return false;
        }
        if (field === "totalCount") {
            counter.raw.totalCount += 1;
            counter.staleTotalCount = true;
        }
        else {
            counter.raw.errorCount += 1;
            counter.staleErrorCount = true;
        }
        this._staleServiceCounters.add(counter);
        const now = Date.now();
        if (now - this._serviceCountersRefreshTime >= serviceCounterRefreshInterval) {
            this._serviceCountersRefreshTime = now;
            this._refreshServiceCounterVariables();
        }
        return true;
    }
    /** tell the Variables exposing the service counters that the counters have moved */
    _refreshServiceCounterVariables() {
        for (const counter of this._staleServiceCounters) {
            // assigning through the proxy is what refreshes the Variable exposing the field
            if (counter.staleTotalCount) {
                counter.staleTotalCount = false;
                counter.proxied.totalCount = counter.raw.totalCount;
            }
            if (counter.staleErrorCount) {
                counter.staleErrorCount = false;
                counter.proxied.errorCount = counter.raw.errorCount;
            }
        }
        this._staleServiceCounters.clear();
    }
    _forgetServiceCounters() {
        this._serviceCounters.clear();
        this._staleServiceCounters.clear();
    }
    incrementTotalRequestCount() {
        if (this._sessionDiagnostics) {
            this._incrementServiceCounter("totalRequestCount", "totalCount");
        }
    }
    incrementRequestTotalCounter(counterName) {
        if (this._sessionDiagnostics) {
            const propName = serviceCounterName(counterName);
            // c8 ignore next
            if (!this._incrementServiceCounter(propName, "totalCount")) {
                errorLog("incrementRequestTotalCounter: cannot find", propName);
            }
        }
    }
    incrementRequestErrorCounter(counterName) {
        this.parent?.incrementRejectedRequestsCount();
        if (this._sessionDiagnostics) {
            const propName = serviceCounterName(counterName);
            // c8 ignore next
            if (!this._incrementServiceCounter(propName, "errorCount")) {
                errorLog("incrementRequestErrorCounter: cannot find", propName);
            }
        }
    }
    /**
     * returns rootFolder.objects.server.serverDiagnostics.sessionsDiagnosticsSummary.sessionDiagnosticsArray
     */
    getSessionDiagnosticsArray() {
        if (!this.addressSpace) {
            throw new Error("getSessionDiagnosticsArray: address space is not available");
        }
        const server = this.addressSpace.rootFolder.objects.server;
        return server.serverDiagnostics.sessionsDiagnosticsSummary
            .sessionDiagnosticsArray;
    }
    /**
     * returns rootFolder.objects.server.serverDiagnostics.sessionsDiagnosticsSummary.sessionSecurityDiagnosticsArray
     */
    getSessionSecurityDiagnosticsArray() {
        if (!this.addressSpace) {
            throw new Error("getSessionSecurityDiagnosticsArray: address space is not available");
        }
        const server = this.addressSpace.rootFolder.objects.server;
        return server.serverDiagnostics.sessionsDiagnosticsSummary
            .sessionSecurityDiagnosticsArray;
    }
    /**
     * number of active subscriptions
     */
    get currentSubscriptionCount() {
        return this.publishEngine ? this.publishEngine.subscriptionCount : 0;
    }
    /**
     * number of subscriptions ever created since this object is live
     */
    get cumulatedSubscriptionCount() {
        return this._cumulatedSubscriptionCount;
    }
    /**
     * number of monitored items
     */
    get currentMonitoredItemCount() {
        return this.publishEngine ? this.publishEngine.currentMonitoredItemCount : 0;
    }
    /**
     * retrieve an existing subscription by subscriptionId
     * @param subscriptionId {Number}
     */
    getSubscription(subscriptionId) {
        if (!this.publishEngine)
            return null;
        const subscription = this.publishEngine.getSubscriptionById(subscriptionId);
        if (subscription && subscription.state === SubscriptionState.CLOSED) {
            // subscription is CLOSED but has not been notified yet
            // it should be considered as excluded
            return null;
        }
        assert(!subscription || subscription.state !== SubscriptionState.CLOSED, "CLOSED subscription shall not be managed by publish engine anymore");
        return subscription;
    }
    /**
     * @param subscriptionId {Number}
     * @return {StatusCode}
     */
    deleteSubscription(subscriptionId) {
        const subscription = this.getSubscription(subscriptionId);
        if (!subscription) {
            return StatusCodes.BadSubscriptionIdInvalid;
        }
        // xx this.publishEngine.remove_subscription(subscription);
        subscription.terminate();
        if (this.currentSubscriptionCount === 0) {
            const local_publishEngine = this.publishEngine;
            local_publishEngine.cancelPendingPublishRequest();
        }
        return StatusCodes.Good;
    }
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
    close(deleteSubscriptions, reason, auditEntryId) {
        // c8 ignore next
        doDebug && debugLog(" closing session deleteSubscriptions = ", deleteSubscriptions);
        if (this.publishEngine) {
            this.publishEngine.onSessionClose();
        }
        theWatchDog.removeSubscriber(this);
        // ---------------  delete associated subscriptions ---------------------
        if (!deleteSubscriptions && this.currentSubscriptionCount !== 0) {
            // I don't know what to do yet if deleteSubscriptions is false
            errorLog("TO DO : Closing session without deleting subscription not yet implemented");
            // to do: Put subscriptions in safe place for future transfer if any
        }
        this._deleteSubscriptions();
        assert(this.currentSubscriptionCount === 0);
        // Post-Conditions
        assert(this.currentSubscriptionCount === 0);
        this.status = "closed";
        const shutdownTasks = this._shutdownTasks;
        this._shutdownTasks = [];
        const shutdownTasksDone = Promise.all(shutdownTasks.map((task) => this._runShutdownTask(task)));
        this._detach_channel();
        /**
         * @event session_closed
         * @param deleteSubscriptions {Boolean}
         * @param reason {String}
         * @param auditEntryId {String}
         */
        this.emit("session_closed", this, deleteSubscriptions, reason, auditEntryId ?? "");
        // ---------------- shut down publish engine
        if (this.publishEngine) {
            // remove subscription
            this.publishEngine.shutdown();
            assert(this.publishEngine.subscriptionCount === 0);
            this.publishEngine.dispose();
            this.publishEngine = null;
        }
        this._removeSessionObjectFromAddressSpace();
        assert(!this.sessionDiagnostics, "ServerSession#_removeSessionObjectFromAddressSpace must be called");
        assert(!this.sessionObject, "ServerSession#_removeSessionObjectFromAddressSpace must be called");
        return shutdownTasksDone.then(() => undefined);
    }
    registerSessionShutdownTask(task) {
        if (this.status === "closed" || this.status === "disposed") {
            void this._runShutdownTask(task);
            return;
        }
        this._shutdownTasks.push(task);
    }
    async _runShutdownTask(task) {
        try {
            await task();
        }
        catch (err) {
            errorLog("Session shutdown task has failed:", err.message);
        }
    }
    registerNode(nodeId) {
        assert(nodeId instanceof NodeId);
        if (nodeId.namespace === 0 && nodeId.identifierType === NodeIdType.NUMERIC) {
            return nodeId;
        }
        const key = nodeId.toString();
        const registeredNode = this._registeredNodes[key];
        if (registeredNode) {
            // already registered
            return registeredNode;
        }
        const node = this.addressSpace?.findNode(nodeId);
        if (!node) {
            return nodeId;
        }
        this._registeredNodesCounter += 1;
        const aliasNodeId = makeNodeId(this._registeredNodesCounter, registeredNodeNameSpace);
        this._registeredNodes[key] = aliasNodeId;
        this._registeredNodesInv[aliasNodeId.toString()] = node;
        return aliasNodeId;
    }
    unRegisterNode(aliasNodeId) {
        assert(aliasNodeId instanceof NodeId);
        if (aliasNodeId.namespace !== registeredNodeNameSpace) {
            return; // not a registered Node
        }
        const node = this._registeredNodesInv[aliasNodeId.toString()];
        if (!node) {
            return;
        }
        delete this._registeredNodesInv[aliasNodeId.toString()];
        delete this._registeredNodes[node.nodeId.toString()];
    }
    /** whether the client registered nodes on this session (RegisterNodes): their aliases name them in its requests */
    hasRegisteredNodes() {
        for (const _ in this._registeredNodes)
            return true;
        return false;
    }
    resolveRegisteredNode(aliasNodeId) {
        if (aliasNodeId.namespace !== registeredNodeNameSpace) {
            return aliasNodeId; // not a registered Node
        }
        const node = this._registeredNodesInv[aliasNodeId.toString()];
        if (!node) {
            return aliasNodeId;
        }
        return node.nodeId;
    }
    /**
     * true if the underlying channel has been closed or aborted...
     */
    get aborted() {
        if (!this.channel) {
            return true;
        }
        return this.channel.aborted;
    }
    /** `id`: the id the subscription keeps, when it comes from another thread of the server */
    createSubscription(parameters, id) {
        const subscription = this.parent._createSubscriptionOnSession(this, parameters, id);
        assert(!Object.hasOwn(parameters, "id"));
        this.assignSubscription(subscription);
        assert(subscription.$session === this);
        assert(subscription.sessionId instanceof NodeId);
        assert(sameNodeId(subscription.sessionId, this.nodeId));
        return subscription;
    }
    _attach_channel(channel) {
        assert(this.nonce && this.nonce instanceof Buffer);
        this.channel = channel;
        this.channelId = channel.channelId;
        const key = this.authenticationToken.toString();
        assert(!Object.hasOwn(channel.sessionTokens, key), "channel has already a session");
        channel.sessionTokens[key] = this;
        // A secure channel can carry many sessions, and each one registers its own
        // "abort" handler below - so the default ceiling of 10 is tripped by ~9
        // concurrent sessions on a single channel and reported as a leak (#422).
        // Track the session count rather than lifting the ceiling once and for all,
        // so a listener that is NOT session-bound still trips the warning.
        const sessionCount = Object.keys(channel.sessionTokens).length;
        channel.setMaxListeners(sessionCount + EXTRA_CHANNEL_LISTENERS);
        // when channel is aborting
        this.channel_abort_event_handler = on_channel_abort.bind(this);
        channel.on("abort", this.channel_abort_event_handler);
    }
    _detach_channel() {
        const channel = this.channel;
        // c8 ignore next
        if (!channel) {
            return;
            // already detached !
            // throw new Error("expecting a valid channel");
        }
        assert(this.nonce && this.nonce instanceof Buffer);
        assert(this.authenticationToken);
        const key = this.authenticationToken.toString();
        assert(Object.hasOwn(channel.sessionTokens, key));
        assert(this.channel);
        assert(typeof this.channel_abort_event_handler === "function");
        if (this.channel_abort_event_handler) {
            channel.removeListener("abort", this.channel_abort_event_handler);
        }
        delete channel.sessionTokens[key];
        // bring the ceiling back down with the session count, so a channel that
        // shed its sessions cannot silently hoard listeners (see _attach_channel)
        channel.setMaxListeners(Object.keys(channel.sessionTokens).length + EXTRA_CHANNEL_LISTENERS);
        this.channel = undefined;
        this.channelId = undefined;
    }
    _exposeSubscriptionDiagnostics(subscription) {
        // c8 ignore next
        doDebug && debugLog("ServerSession#_exposeSubscriptionDiagnostics");
        assert(subscription.$session === this);
        const subscriptionDiagnosticsArray = this._getSubscriptionDiagnosticsArray();
        const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
        assert(subscriptionDiagnostics.$subscription === subscription);
        if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
            // subscription.id,"on session", session.nodeId.toString());
            addElement(subscriptionDiagnostics, subscriptionDiagnosticsArray, this.addressSpace?.getNamespace(this.parent.diagnosticsNamespaceIndex ?? 1));
        }
    }
    _unexposeSubscriptionDiagnostics(subscription) {
        const subscriptionDiagnosticsArray = this._getSubscriptionDiagnosticsArray();
        const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
        assert(subscriptionDiagnostics instanceof SubscriptionDiagnosticsDataType);
        if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
            // subscription.id,"on session", session.nodeId.toString());
            removeElement(subscriptionDiagnosticsArray, (a) => a.subscriptionId === subscription.id);
        }
        // c8 ignore next
        doDebug && debugLog("ServerSession#_unexposeSubscriptionDiagnostics");
    }
    /**
     * used as a callback for the Watchdog
     * @private
     */
    watchdogReset() {
        // c8 ignore next
        doDebug && debugLog("Session#watchdogReset: the server session has expired and must be removed from the server");
        // the server session has expired and must be removed from the server
        this.emit("timeout");
    }
    _createSessionObjectInAddressSpace() {
        if (this.sessionObject) {
            return;
        }
        assert(!this.sessionObject, "ServerSession#_createSessionObjectInAddressSpace already called ?");
        this.sessionObject = null;
        if (!this.addressSpace) {
            // c8 ignore next
            doDebug && debugLog("ServerSession#_createSessionObjectInAddressSpace : no addressSpace");
            return; // no addressSpace
        }
        const root = this.addressSpace.rootFolder;
        assert(root, "expecting a root object");
        if (!root.objects) {
            // c8 ignore next
            doDebug && debugLog("ServerSession#_createSessionObjectInAddressSpace : no object folder");
            return false;
        }
        if (!root.objects.server) {
            // c8 ignore next
            doDebug && debugLog("ServerSession#_createSessionObjectInAddressSpace : no server object");
            return false;
        }
        // self.addressSpace.findNode(makeNodeId(ObjectIds.Server_ServerDiagnostics));
        const serverDiagnosticsNode = root.objects.server.serverDiagnostics;
        if (!serverDiagnosticsNode?.sessionsDiagnosticsSummary) {
            // c8 ignore next
            doDebug &&
                debugLog("ServerSession#_createSessionObjectInAddressSpace :" + " no serverDiagnostics.sessionsDiagnosticsSummary");
            return false;
        }
        const sessionDiagnosticsObjectType = this.addressSpace.findObjectType("SessionDiagnosticsObjectType");
        const sessionDiagnosticsDataType = this.addressSpace.findDataType("SessionDiagnosticsDataType");
        const sessionDiagnosticsVariableType = this.addressSpace.findVariableType("SessionDiagnosticsVariableType");
        const sessionSecurityDiagnosticsDataType = this.addressSpace.findDataType("SessionSecurityDiagnosticsDataType");
        const sessionSecurityDiagnosticsType = this.addressSpace.findVariableType("SessionSecurityDiagnosticsType");
        // where the Session's object, its diagnostics and those of its Subscriptions are created
        const namespace = this.addressSpace.getNamespace(this.parent.diagnosticsNamespaceIndex ?? 1);
        function createSessionDiagnosticsStuff() {
            if (sessionDiagnosticsDataType && sessionDiagnosticsVariableType) {
                // addressSpace and sessionObject were already validated/set non-null by
                // _createSessionObjectInAddressSpace / createSessionDiagnosticSummaryUAObject before this
                // synchronous helper is invoked
                if (!this.addressSpace) {
                    throw new Error("createSessionDiagnosticsStuff: address space is not available");
                }
                if (!this.sessionObject) {
                    throw new Error("createSessionDiagnosticsStuff: sessionObject is not available");
                }
                // the extension object
                this._sessionDiagnostics = this.addressSpace.constructExtensionObject(sessionDiagnosticsDataType, {});
                this._sessionDiagnostics.$session = this;
                // install property getter on property that are unlikely to change
                if (this.parent.clientDescription) {
                    this._sessionDiagnostics.clientDescription = this.parent.clientDescription;
                }
                Object.defineProperty(this._sessionDiagnostics, "clientConnectionTime", {
                    // note: sibling getters below (actualSessionTimeout, sessionId, sessionName) already
                    // guard against a null $session; this one previously accessed it unguarded (behind `this:
                    // any`), which would throw if ever read after the session was disposed. Aligned here.
                    get() {
                        return this.$session?.clientConnectionTime;
                    }
                });
                Object.defineProperty(this._sessionDiagnostics, "actualSessionTimeout", {
                    get() {
                        return this.$session?.sessionTimeout;
                    }
                });
                Object.defineProperty(this._sessionDiagnostics, "sessionId", {
                    get() {
                        return this.$session ? this.$session.nodeId : NodeId.nullNodeId;
                    }
                });
                Object.defineProperty(this._sessionDiagnostics, "sessionName", {
                    get() {
                        return this.$session ? this.$session.sessionName.toString() : "";
                    }
                });
                this.sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
                    browseName: new QualifiedName({ name: "SessionDiagnostics", namespaceIndex: 0 }),
                    namespace,
                    componentOf: this.sessionObject,
                    extensionObject: this._sessionDiagnostics,
                    minimumSamplingInterval: 2000 // 2 seconds
                });
                this._sessionDiagnostics = this.sessionDiagnostics.$extensionObject;
                assert(this._sessionDiagnostics.$session === this);
                const sessionDiagnosticsArray = this.getSessionDiagnosticsArray();
                // add sessionDiagnostics into sessionDiagnosticsArray
                addElement(this._sessionDiagnostics, sessionDiagnosticsArray);
            }
        }
        function createSessionSecurityDiagnosticsStuff() {
            if (sessionSecurityDiagnosticsDataType && sessionSecurityDiagnosticsType) {
                // addressSpace and sessionObject were already validated/set non-null by
                // _createSessionObjectInAddressSpace / createSessionDiagnosticSummaryUAObject before this
                // synchronous helper is invoked
                if (!this.addressSpace) {
                    throw new Error("createSessionSecurityDiagnosticsStuff: address space is not available");
                }
                if (!this.sessionObject) {
                    throw new Error("createSessionSecurityDiagnosticsStuff: sessionObject is not available");
                }
                // the extension object
                this._sessionSecurityDiagnostics = this.addressSpace.constructExtensionObject(sessionSecurityDiagnosticsDataType, {});
                this._sessionSecurityDiagnostics.$session = this;
                /*
                    sessionId: NodeId;
                    clientUserIdOfSession: UAString;
                    clientUserIdHistory: UAString[] | null;
                    authenticationMechanism: UAString;
                    encoding: UAString;
                    transportProtocol: UAString;
                    securityMode: MessageSecurityMode;
                    securityPolicyUri: UAString;
                    clientCertificate: ByteString;
                */
                Object.defineProperty(this._sessionSecurityDiagnostics, "sessionId", {
                    get() {
                        return this.$session?.nodeId;
                    }
                });
                Object.defineProperty(this._sessionSecurityDiagnostics, "clientUserIdOfSession", {
                    get() {
                        return ""; // UAString // TO DO : implement
                    }
                });
                Object.defineProperty(this._sessionSecurityDiagnostics, "clientUserIdHistory", {
                    get() {
                        return []; // UAString[] | null
                    }
                });
                Object.defineProperty(this._sessionSecurityDiagnostics, "authenticationMechanism", {
                    get() {
                        return "";
                    }
                });
                Object.defineProperty(this._sessionSecurityDiagnostics, "encoding", {
                    get() {
                        return "";
                    }
                });
                Object.defineProperty(this._sessionSecurityDiagnostics, "transportProtocol", {
                    get() {
                        return "opc.tcp";
                    }
                });
                Object.defineProperty(this._sessionSecurityDiagnostics, "securityMode", {
                    get() {
                        const session = this.$session;
                        return session?.channelSecurity?.securityMode;
                    }
                });
                Object.defineProperty(this._sessionSecurityDiagnostics, "securityPolicyUri", {
                    get() {
                        const session = this.$session;
                        return session?.channelSecurity?.securityPolicy;
                    }
                });
                Object.defineProperty(this._sessionSecurityDiagnostics, "clientCertificate", {
                    get() {
                        const session = this.$session;
                        return session?.channelSecurity?.clientCertificate;
                    }
                });
                this.sessionSecurityDiagnostics = sessionSecurityDiagnosticsType.instantiate({
                    browseName: new QualifiedName({ name: "SessionSecurityDiagnostics", namespaceIndex: 0 }),
                    namespace,
                    componentOf: this.sessionObject,
                    extensionObject: this._sessionSecurityDiagnostics,
                    minimumSamplingInterval: 2000 // 2 seconds
                });
                ensureObjectIsSecure(this.sessionSecurityDiagnostics);
                this._sessionSecurityDiagnostics = this.sessionSecurityDiagnostics
                    .$extensionObject;
                assert(this._sessionSecurityDiagnostics.$session === this);
                const sessionSecurityDiagnosticsArray = this.getSessionSecurityDiagnosticsArray();
                // add sessionDiagnostics into sessionDiagnosticsArray
                const node = addElement(this._sessionSecurityDiagnostics, sessionSecurityDiagnosticsArray);
                ensureObjectIsSecure(node);
            }
        }
        function createSessionDiagnosticSummaryUAObject() {
            const references = [];
            if (sessionDiagnosticsObjectType) {
                references.push({
                    isForward: true,
                    nodeId: sessionDiagnosticsObjectType,
                    referenceType: "HasTypeDefinition"
                });
            }
            this.sessionObject = namespace.createNode({
                browseName: this.sessionName || `Session-${this.nodeId.toString()}`,
                componentOf: serverDiagnosticsNode.sessionsDiagnosticsSummary,
                nodeClass: NodeClass.Object,
                nodeId: this.nodeId,
                references,
                typeDefinition: sessionDiagnosticsObjectType
            });
            createSessionDiagnosticsStuff.call(this);
            createSessionSecurityDiagnosticsStuff.call(this);
        }
        function createSubscriptionDiagnosticsArray() {
            // addressSpace was already validated non-null by _createSessionObjectInAddressSpace before this
            // synchronous helper is invoked
            if (!this.addressSpace) {
                throw new Error("createSubscriptionDiagnosticsArray: address space is not available");
            }
            const subscriptionDiagnosticsArrayType = this.addressSpace.findVariableType("SubscriptionDiagnosticsArrayType");
            if (!subscriptionDiagnosticsArrayType) {
                throw new Error("createSubscriptionDiagnosticsArray: cannot find SubscriptionDiagnosticsArrayType");
            }
            assert(subscriptionDiagnosticsArrayType.nodeId.toString() === "ns=0;i=2171");
            // sessionObject is guaranteed to be set by createSessionDiagnosticSummaryUAObject, called just before
            if (!this.sessionObject) {
                throw new Error("createSubscriptionDiagnosticsArray: sessionObject is not available");
            }
            this.subscriptionDiagnosticsArray = createExtObjArrayNode(this.sessionObject, {
                browseName: { namespaceIndex: 0, name: "SubscriptionDiagnosticsArray" },
                complexVariableType: "SubscriptionDiagnosticsArrayType",
                indexPropertyName: "subscriptionId",
                minimumSamplingInterval: 2000, // 2 seconds
                variableType: "SubscriptionDiagnosticsType"
            });
        }
        createSessionDiagnosticSummaryUAObject.call(this);
        createSubscriptionDiagnosticsArray.call(this);
        return this.sessionObject;
    }
    async resendMonitoredItemInitialValues() {
        if (!this.publishEngine)
            return;
        for (const subscription of this.publishEngine.subscriptions) {
            await subscription.resendInitialValues();
        }
    }
    /**
     *
     * @private
     */
    _removeSessionObjectFromAddressSpace() {
        // todo : dump session statistics in a file or somewhere for deeper diagnostic analysis on closed session
        if (!this.addressSpace) {
            return;
        }
        if (this.sessionDiagnostics) {
            const sessionDiagnosticsArray = this.getSessionDiagnosticsArray();
            removeElement(sessionDiagnosticsArray, (a) => sameNodeId(a.sessionId, this.getSessionId()));
            this.addressSpace.deleteNode(this.sessionDiagnostics);
            assert(this._sessionDiagnostics?.$session === this);
            if (this._sessionDiagnostics) {
                this._sessionDiagnostics.$session = null;
            }
            this._sessionDiagnostics = undefined;
            this._forgetServiceCounters();
            this.sessionDiagnostics = undefined;
        }
        if (this.sessionSecurityDiagnostics) {
            const sessionSecurityDiagnosticsArray = this.getSessionSecurityDiagnosticsArray();
            removeElement(sessionSecurityDiagnosticsArray, (a) => sameNodeId(a.sessionId, this.getSessionId()));
            this.addressSpace.deleteNode(this.sessionSecurityDiagnostics);
            assert(this._sessionSecurityDiagnostics?.$session === this);
            if (this._sessionSecurityDiagnostics) {
                this._sessionSecurityDiagnostics.$session = null;
            }
            this._sessionSecurityDiagnostics = undefined;
            this.sessionSecurityDiagnostics = undefined;
        }
        if (this.sessionObject) {
            this.addressSpace.deleteNode(this.sessionObject);
            this.sessionObject = null;
        }
    }
    /**
     *
     * @private
     */
    _getSubscriptionDiagnosticsArray() {
        if (!this.addressSpace) {
            // c8 ignore next
            if (doDebug) {
                console.warn("ServerSession#_getSubscriptionDiagnosticsArray : no addressSpace");
            }
            return null; // no addressSpace
        }
        const subscriptionDiagnosticsArray = this.subscriptionDiagnosticsArray;
        if (!subscriptionDiagnosticsArray) {
            return null; // no subscriptionDiagnosticsArray
        }
        assert(subscriptionDiagnosticsArray.browseName.toString() === "SubscriptionDiagnosticsArray");
        return subscriptionDiagnosticsArray;
    }
    assignSubscription(subscription) {
        assert(!subscription.$session);
        assert(this.nodeId instanceof NodeId);
        subscription.$session = this;
        assert(subscription.sessionId === this.nodeId);
        this._cumulatedSubscriptionCount += 1;
        // Notify the owner that a new subscription has been created
        // @event new_subscription
        // @param {Subscription} subscription
        this.emit("new_subscription", subscription);
        // add subscription diagnostics to SubscriptionDiagnosticsArray
        this._exposeSubscriptionDiagnostics(subscription);
        subscription.once("terminated", () => {
            // Notify the owner that a new subscription has been terminated
            // @event subscription_terminated
            // @param {Subscription} subscription
            this.emit("subscription_terminated", subscription);
        });
    }
    _deleteSubscriptions() {
        if (!this.publishEngine)
            return;
        const subscriptions = this.publishEngine.subscriptions;
        for (const subscription of subscriptions) {
            this.deleteSubscription(subscription.id);
        }
    }
}
//# sourceMappingURL=server_session.js.map