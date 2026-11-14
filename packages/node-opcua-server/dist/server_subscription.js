/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import chalk from "chalk";
import { SessionContext } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { SubscriptionDiagnosticsDataType } from "node-opcua-common";
import { AttributeIds, isValidDataEncoding, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { ObjectRegistry } from "node-opcua-object-registry";
import { SequenceNumberGenerator } from "node-opcua-secure-channel";
import { checkSelectClauses, EventFilter } from "node-opcua-service-filter";
import { AggregateFilter, DataChangeFilter, DataChangeNotification, EventNotificationList, MonitoredItemCreateRequest, MonitoredItemCreateResult, MonitoredItemNotification, MonitoringMode, NotificationMessage, PublishResponse, StatusChangeNotification } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { AggregateFilterResult, ContentFilterResult, EventFieldList, EventFilterResult } from "node-opcua-types";
import { TransferredSubscription } from "./i_server_side_publish_engine.js";
import { MonitoredItem } from "./monitored_item.js";
import { Queue } from "./queue.js";
import { validateFilter } from "./validate_filter.js";
const debugLog = make_debugLog("server_subscription");
const doDebug = checkDebugFlag("server_subscription");
const warningLog = make_warningLog("server_subscription");
const maxNotificationMessagesInQueue = 100;
/**
 * Bytes reserved for everything in a PublishResponse that is not a notification:
 * the response and notification-message headers, the DataChangeNotification
 * wrapper and the diagnostic-info arrays. Deliberately generous - overshooting
 * the budget costs one extra message, exceeding it costs the whole message.
 */
const notificationMessageOverhead = 2048;
export var SubscriptionState;
(function (SubscriptionState) {
    SubscriptionState[SubscriptionState["CLOSED"] = 1] = "CLOSED";
    SubscriptionState[SubscriptionState["CREATING"] = 2] = "CREATING";
    SubscriptionState[SubscriptionState["NORMAL"] = 3] = "NORMAL";
    // The keep-alive counter is not used in this state.
    SubscriptionState[SubscriptionState["LATE"] = 4] = "LATE";
    // ready to be sent, but there are no Publish requests queued. When in this state, the next Publish
    // request is processed when it is received. The keep-alive counter is not used in this state.
    SubscriptionState[SubscriptionState["KEEPALIVE"] = 5] = "KEEPALIVE";
    // alive counter to count down to 0 from its maximum.
    SubscriptionState[SubscriptionState["TERMINATED"] = 6] = "TERMINATED";
})(SubscriptionState || (SubscriptionState = {}));
function _adjust_publishing_interval(publishingInterval) {
    publishingInterval =
        publishingInterval === undefined || Number.isNaN(publishingInterval)
            ? Subscription.defaultPublishingInterval
            : publishingInterval;
    publishingInterval = Math.max(publishingInterval, Subscription.minimumPublishingInterval);
    publishingInterval = Math.min(publishingInterval, Subscription.maximumPublishingInterval);
    return publishingInterval;
}
const minimumMaxKeepAliveCount = 2;
const maximumMaxKeepAliveCount = 12000;
function _adjust_maxKeepAliveCount(maxKeepAliveCount /*,publishingInterval*/) {
    maxKeepAliveCount = maxKeepAliveCount || minimumMaxKeepAliveCount;
    maxKeepAliveCount = Math.max(maxKeepAliveCount, minimumMaxKeepAliveCount);
    maxKeepAliveCount = Math.min(maxKeepAliveCount, maximumMaxKeepAliveCount);
    return maxKeepAliveCount;
}
const MaxUint32 = 0xffffffff;
function _adjust_lifeTimeCount(lifeTimeCount, maxKeepAliveCount, publishingInterval) {
    lifeTimeCount = lifeTimeCount || 1;
    const minTicks = Math.ceil(Subscription.minimumLifetimeDuration / publishingInterval);
    const maxTicks = Math.floor(Subscription.maximumLifetimeDuration / publishingInterval);
    lifeTimeCount = Math.max(minTicks, lifeTimeCount);
    lifeTimeCount = Math.min(maxTicks, lifeTimeCount);
    // let's make sure that lifeTimeCount is at least three time maxKeepAliveCount
    // Note : the specs say ( part 3  - CreateSubscriptionParameter )
    //        "The lifetime count shall be a minimum of three times the keep keep-alive count."
    lifeTimeCount = Math.max(lifeTimeCount, Math.min(maxKeepAliveCount * 3, MaxUint32));
    return lifeTimeCount;
}
function _adjust_publishingEnable(publishingEnabled) {
    return publishingEnabled === null || publishingEnabled === undefined ? true : !!publishingEnabled;
}
function _adjust_maxNotificationsPerPublish(maxNotificationsPerPublish) {
    assert(Subscription.maxNotificationPerPublishHighLimit > 0, "Subscription.maxNotificationPerPublishHighLimit must be positive");
    maxNotificationsPerPublish = maxNotificationsPerPublish || 0;
    assert(typeof maxNotificationsPerPublish === "number");
    // must be strictly positive
    maxNotificationsPerPublish = maxNotificationsPerPublish >= 0 ? maxNotificationsPerPublish : 0;
    if (maxNotificationsPerPublish === 0) {
        // if zero then => use our HighLimit
        maxNotificationsPerPublish = Subscription.maxNotificationPerPublishHighLimit;
    }
    else {
        // if not zero then should be capped by maxNotificationPerPublishHighLimit
        maxNotificationsPerPublish = Math.min(Subscription.maxNotificationPerPublishHighLimit, maxNotificationsPerPublish);
    }
    assert(maxNotificationsPerPublish !== 0 && maxNotificationsPerPublish <= Subscription.maxNotificationPerPublishHighLimit);
    return maxNotificationsPerPublish;
}
function w(s, length) {
    return `000${s}`.padStart(length);
}
function t(d) {
    return `${w(d.getHours(), 2)}:${w(d.getMinutes(), 2)}:${w(d.getSeconds(), 2)}:${w(d.getMilliseconds(), 3)}`;
}
function _getSequenceNumbers(arr) {
    return arr.map((notificationMessage) => notificationMessage.sequenceNumber);
}
function analyzeEventFilterResult(node, eventFilter) {
    /* c8 ignore next */
    if (!(eventFilter instanceof EventFilter)) {
        throw new Error("Internal Error");
    }
    // a node of a session worker: the engine, where the event types are, checked the filter
    const checked = node.analyzeEventFilter?.(eventFilter);
    if (checked) {
        return checked;
    }
    const selectClauseResults = checkSelectClauses(node, eventFilter.selectClauses || []);
    const whereClauseResult = new ContentFilterResult();
    return new EventFilterResult({
        selectClauseDiagnosticInfos: [],
        selectClauseResults,
        whereClauseResult
    });
}
function analyzeDataChangeFilterResult(_node, dataChangeFilter) {
    assert(dataChangeFilter instanceof DataChangeFilter);
    // the opcua specification doesn't provide dataChangeFilterResult
    return null;
}
function analyzeAggregateFilterResult(_node, aggregateFilter) {
    assert(aggregateFilter instanceof AggregateFilter);
    return new AggregateFilterResult({});
}
function _process_filter(node, filter) {
    if (!filter) {
        return null;
    }
    if (filter instanceof EventFilter) {
        return analyzeEventFilterResult(node, filter);
    }
    else if (filter instanceof DataChangeFilter) {
        return analyzeDataChangeFilterResult(node, filter);
    }
    else if (filter instanceof AggregateFilter) {
        return analyzeAggregateFilterResult(node, filter);
    }
    // c8 ignore next
    throw new Error("invalid filter");
}
/**
 * @private
 */
function createSubscriptionDiagnostics(subscription) {
    assert(subscription instanceof Subscription);
    const subscriptionDiagnostics = new SubscriptionDiagnosticsDataType({});
    const sd = subscriptionDiagnostics;
    sd.$subscription = subscription;
    const defineGetter = (name, getter) => {
        Object.defineProperty(sd, name, { get: getter, configurable: true });
    };
    // "sessionId"
    defineGetter("sessionId", function () {
        if (!this.$subscription) {
            return NodeId.nullNodeId;
        }
        return this.$subscription.getSessionId();
    });
    defineGetter("subscriptionId", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.id;
    });
    defineGetter("priority", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.priority;
    });
    defineGetter("publishingInterval", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.publishingInterval;
    });
    defineGetter("maxLifetimeCount", function () {
        return this.$subscription.lifeTimeCount;
    });
    defineGetter("maxKeepAliveCount", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.maxKeepAliveCount;
    });
    defineGetter("maxNotificationsPerPublish", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.maxNotificationsPerPublish;
    });
    defineGetter("publishingEnabled", function () {
        if (!this.$subscription) {
            return false;
        }
        return this.$subscription.publishingEnabled;
    });
    defineGetter("monitoredItemCount", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.monitoredItemCount;
    });
    defineGetter("nextSequenceNumber", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.futureSequenceNumber;
    });
    defineGetter("disabledMonitoredItemCount", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.disabledMonitoredItemCount;
    });
    /* those member of self.subscriptionDiagnostics are handled directly

   modifyCount
   enableCount,
   disableCount,
   republishRequestCount,
   notificationsCount,
   publishRequestCount,
   dataChangeNotificationsCount,
   eventNotificationsCount,
  */
    /*
   those members are not updated yet in the code :
   "republishMessageRequestCount",
   "republishMessageCount",
   "transferRequestCount",
   "transferredToAltClientCount",
   "transferredToSameClientCount",
   "latePublishRequestCount",
   "unacknowledgedMessageCount",
   "discardedMessageCount",
   "monitoringQueueOverflowCount",
   "eventQueueOverflowCount"
   */
    defineGetter("currentKeepAliveCount", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.currentKeepAliveCount;
    });
    defineGetter("currentLifetimeCount", function () {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.currentLifetimeCount;
    });
    // add object in Variable SubscriptionDiagnosticArray (i=2290) ( Array of SubscriptionDiagnostics)
    // add properties in Variable to reflect
    return subscriptionDiagnostics;
}
let g_monitoredItemId = Math.ceil(Math.random() * 100000);
function getNextMonitoredItemId() {
    return g_monitoredItemId++;
}
// function myFilter<T>(t1: any, chunk: any[]): T[] {
//     return chunk.filter(filter_instanceof.bind(null, t1));
// }
// function makeNotificationData(notifications_chunk: QueueItem): NotificationData {
//     const dataChangedNotificationData = myFilter<MonitoredItemNotification>(MonitoredItemNotification, notifications_chunk);
//     const eventNotificationListData = myFilter<EventFieldList>(EventFieldList, notifications_chunk);
//     assert(notifications_chunk.length === dataChangedNotificationData.length + eventNotificationListData.length);
//     const notifications: (DataChangeNotification | EventNotificationList)[] = [];
//     // add dataChangeNotification
//     if (dataChangedNotificationData.length) {
//         const dataChangeNotification = new DataChangeNotification({
//             diagnosticInfos: [],
//             monitoredItems: dataChangedNotificationData
//         });
//         notifications.push(dataChangeNotification);
//     }
//     // add dataChangeNotification
//     if (eventNotificationListData.length) {
//         const eventNotificationList = new EventNotificationList({
//             events: eventNotificationListData
//         });
//         notifications.push(eventNotificationList);
//     }
//     return notifications.length === 0 ? null : notifications;
// }
const INVALID_ID = -1;
/**
 * The Subscription class used in the OPCUA server side.
 */
export class Subscription extends EventEmitter {
    static minimumPublishingInterval = 50; // fastest possible
    static defaultPublishingInterval = 1000; // one second
    static maximumPublishingInterval = 1000 * 60; // one minute
    static maxNotificationPerPublishHighLimit = 1000;
    static minimumLifetimeDuration = 5 * 1000; //  // we want 2 seconds minimum lifetime for any subscription
    static maximumLifetimeDuration = 60 * 60 * 1000; // 1 hour
    /**
     * maximum number of monitored item in a subscription to be used
     * when serverCapacity.maxMonitoredItems and serverCapacity.maxMonitoredItemsPerSubscription are not set.
     */
    static defaultMaxMonitoredItemCount = 20000;
    /**
     * @deprecated use serverCapacity.maxMonitoredItems and serverCapacity.maxMonitoredItemsPerSubscription instead
     */
    static get maxMonitoredItemCount() {
        return Subscription.defaultMaxMonitoredItemCount;
    }
    static registry = new ObjectRegistry();
    publishEngine;
    id;
    priority;
    /**
     * the Subscription publishing interval
     * @default 1000
     */
    publishingInterval;
    /**
     * The keep alive count defines how many times the publish interval need to
     * expires without having notifications available before the server send an
     * empty message.
     * OPCUA Spec says: a value of 0 is invalid.
     * @default 10
     *
     */
    maxKeepAliveCount;
    /**
     * The life time count defines how many times the publish interval expires without
     * having a connection to the client to deliver data.
     * If the life time count reaches maxKeepAliveCount, the subscription will
     * automatically terminate.
     * OPCUA Spec: The life-time count shall be a minimum of three times the keep keep-alive count.
     *
     * Note: this has to be interpreted as without having a PublishRequest available
     * @default 1
     */
    lifeTimeCount;
    /**
     * The maximum number of notifications that the Client wishes to receive in a
     * single Publish response. A value of zero indicates that there is no limit.
     * The number of notifications per Publish is the sum of monitoredItems in the
     * DataChangeNotification and events in the EventNotificationList.
     *
     * @property maxNotificationsPerPublish
     * @default 0
     */
    maxNotificationsPerPublish;
    publishingEnabled;
    subscriptionDiagnostics;
    publishIntervalCount;
    /**
     *  number of monitored Item
     */
    monitoredItemIdCounter;
    _state = -1;
    set state(value) {
        if (this._state !== value) {
            this._state = value;
            this.emit("stateChanged", value);
        }
    }
    get state() {
        return this._state;
    }
    messageSent;
    $session;
    /**
     * Byte budget for one NotificationMessage, or 0 when there is no limit to
     * respect. Taken from the limits the client declared when it opened the
     * channel - its maxMessageSize, and its maxChunkCount times what one chunk
     * carries: a response beyond either is refused, which surfaces as a
     * transport error on a Publish whose service result was Good (FEAT-68).
     *
     * Overridable so a test can state a budget without a channel behind it, and
     * so an application can be stricter than the transport if it wants to.
     */
    maxNotificationMessageSizeOverride = 0;
    get maxNotificationMessageSize() {
        if (this.maxNotificationMessageSizeOverride) {
            return this.maxNotificationMessageSizeOverride;
        }
        const channel = this.$session?.channel;
        const negotiated = channel?.getMaxResponseBodySize?.() ?? channel?.getTransportSettings?.()?.maxMessageSize ?? 0;
        // 0 means "no limit announced" on the wire, and is passed through as such
        return negotiated > notificationMessageOverhead ? negotiated : 0;
    }
    /**
     * Snapshot of the identity of the Session that owns this Subscription. It is retained when the
     * Subscription loses its Session (e.g. when it is moved to the orphan publish engine after a
     * Session timeout) so that a later TransferSubscriptions request can still be validated against
     * the original owner as required by OPC UA Part 4 §5.13.7.
     */
    $transferSessionIdentity;
    get sessionId() {
        return this.$session ? this.$session.nodeId : NodeId.nullNodeId;
    }
    // ServerCapabilities filter limits (OPC UA Part 5), exposed for EventFilter validation (e.g. on modify)
    get maxWhereClauseParameters() {
        return this.serverCapabilities.maxWhereClauseParameters;
    }
    get maxSelectClauseParameters() {
        return this.serverCapabilities.maxSelectClauseParameters;
    }
    get currentLifetimeCount() {
        return this._life_time_counter;
    }
    get currentKeepAliveCount() {
        return this._keep_alive_counter;
    }
    _life_time_counter;
    _keep_alive_counter = 0;
    _pending_notifications;
    _sent_notification_messages;
    _sequence_number_generator;
    monitoredItems;
    timerId;
    _hasUncollectedMonitoredItemNotifications = false;
    globalCounter;
    serverCapabilities;
    constructor(options) {
        super();
        options = options || {};
        Subscription.registry.register(this);
        assert(this.sessionId instanceof NodeId, "expecting a sessionId NodeId");
        this.publishEngine = options.publishEngine;
        this.id = options.id || INVALID_ID;
        this.priority = options.priority || 0;
        this.publishingInterval = _adjust_publishing_interval(options.publishingInterval);
        this.maxKeepAliveCount = _adjust_maxKeepAliveCount(options.maxKeepAliveCount); // , this.publishingInterval);
        this.resetKeepAliveCounter();
        this.lifeTimeCount = _adjust_lifeTimeCount(options.lifeTimeCount || 0, this.maxKeepAliveCount, this.publishingInterval);
        this.maxNotificationsPerPublish = _adjust_maxNotificationsPerPublish(options.maxNotificationsPerPublish);
        this._life_time_counter = 0;
        this.resetLifeTimeCounter();
        // notification message that are ready to be sent to the client
        this._pending_notifications = new Queue();
        this._sent_notification_messages = [];
        this._sequence_number_generator = new SequenceNumberGenerator();
        // initial state of the subscription
        this.state = SubscriptionState.CREATING;
        this.publishIntervalCount = 0;
        this.monitoredItems = new Map(); // monitored item map
        this.monitoredItemIdCounter = 0;
        this.publishingEnabled = _adjust_publishingEnable(options.publishingEnabled);
        this.subscriptionDiagnostics = createSubscriptionDiagnostics(this);
        // A boolean value that is set to TRUE to mean that either a NotificationMessage or a keep-alive
        // Message has been sent on the Subscription. It is a flag that is used to ensure that either a
        // NotificationMessage or a keep-alive Message is sent out the first time the publishing
        // timer expires.
        this.messageSent = false;
        this.timerId = null;
        this._start_timer({ firstTime: true });
        // c8 ignore next
        doDebug && debugLog(chalk.green(`creating subscription ${this.id}`));
        this.serverCapabilities = options.serverCapabilities;
        this.serverCapabilities.maxMonitoredItems =
            this.serverCapabilities.maxMonitoredItems || Subscription.defaultMaxMonitoredItemCount;
        this.serverCapabilities.maxMonitoredItemsPerSubscription =
            this.serverCapabilities.maxMonitoredItemsPerSubscription || Subscription.defaultMaxMonitoredItemCount;
        this.globalCounter = options.globalCounter;
        this.#allocateMonitoredItemId = options.monitoredItemIdAllocator ?? getNextMonitoredItemId;
    }
    #allocateMonitoredItemId;
    getSessionId() {
        return this.sessionId;
    }
    toString() {
        let str = "Subscription:\n";
        str += `  subscriptionId          ${this.id}\n`;
        str += `  sessionId          ${this.getSessionId()?.toString()}\n`;
        str += `  publishingEnabled  ${this.publishingEnabled}\n`;
        str += `  maxKeepAliveCount  ${this.maxKeepAliveCount}\n`;
        str += `  publishingInterval ${this.publishingInterval}\n`;
        str += `  lifeTimeCount      ${this.lifeTimeCount}\n`;
        str += `  maxKeepAliveCount  ${this.maxKeepAliveCount}\n`;
        return str;
    }
    toJSON() {
        return {
            id: this.id,
            sessionId: this.getSessionId() ? this.getSessionId().toString() : NodeId.nullNodeId.toString(),
            publishingInterval: this.publishingInterval,
            maxKeepAliveCount: this.maxKeepAliveCount,
            lifeTimeCount: this.lifeTimeCount,
            publishingEnabled: this.publishingEnabled,
            state: this.state !== undefined ? SubscriptionState[this.state] : "unknown",
            monitoredItemCount: this.monitoredItemCount,
            pendingNotificationsCount: this.pendingNotificationsCount
        };
    }
    [Symbol.for("nodejs.util.inspect.custom")]() {
        return this.toString();
    }
    /**
     * modify subscription parameters
     * @param param
     */
    modify(param) {
        // update diagnostic counter
        this.subscriptionDiagnostics.modifyCount += 1;
        const publishingInterval_old = this.publishingInterval;
        param.requestedPublishingInterval = param.requestedPublishingInterval || 0;
        param.requestedMaxKeepAliveCount = param.requestedMaxKeepAliveCount || this.maxKeepAliveCount;
        param.requestedLifetimeCount = param.requestedLifetimeCount || this.lifeTimeCount;
        this.publishingInterval = _adjust_publishing_interval(param.requestedPublishingInterval);
        this.maxKeepAliveCount = _adjust_maxKeepAliveCount(param.requestedMaxKeepAliveCount);
        this.lifeTimeCount = _adjust_lifeTimeCount(param.requestedLifetimeCount, this.maxKeepAliveCount, this.publishingInterval);
        this.maxNotificationsPerPublish = _adjust_maxNotificationsPerPublish(param.maxNotificationsPerPublish || 0);
        this.priority = param.priority || 0;
        this.resetLifeTimeAndKeepAliveCounters();
        if (publishingInterval_old !== this.publishingInterval) {
            // todo
        }
        this._stop_timer();
        this._start_timer({ firstTime: false });
    }
    /**
     * set publishing mode
     * @param publishingEnabled
     */
    setPublishingMode(publishingEnabled) {
        this.publishingEnabled = !!publishingEnabled;
        // update diagnostics
        if (this.publishingEnabled) {
            this.subscriptionDiagnostics.enableCount += 1;
        }
        else {
            this.subscriptionDiagnostics.disableCount += 1;
        }
        this.resetLifeTimeCounter();
        if (!publishingEnabled && this.state !== SubscriptionState.CLOSED) {
            this.state = SubscriptionState.NORMAL;
        }
        return StatusCodes.Good;
    }
    /**
     * @private
     */
    get keepAliveCounterHasExpired() {
        return this._keep_alive_counter >= this.maxKeepAliveCount || this.state === SubscriptionState.LATE;
    }
    /**
     * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
     * the CreateSubscription Service( 5.13.2).
     * @private
     */
    resetLifeTimeCounter() {
        this._life_time_counter = 0;
    }
    /**
     * @private
     */
    increaseLifeTimeCounter() {
        this._life_time_counter += 1;
        if (this._life_time_counter >= this.lifeTimeCount) {
            this.emit("lifeTimeExpired");
        }
        this.emit("lifeTimeCounterChanged", this._life_time_counter);
    }
    /**
     *  True if the subscription life time has expired.
     *
     */
    get lifeTimeHasExpired() {
        assert(this.lifeTimeCount > 0);
        return this._life_time_counter >= this.lifeTimeCount;
    }
    /**
     * number of milliseconds before this subscription times out (lifeTimeHasExpired === true);
     */
    get timeToExpiration() {
        return (this.lifeTimeCount - this._life_time_counter) * this.publishingInterval;
    }
    get timeToKeepAlive() {
        return (this.maxKeepAliveCount - this._keep_alive_counter) * this.publishingInterval;
    }
    /**
     * Terminates the subscription.
     * Calling this method will also remove any monitored items.
     *
     */
    terminate() {
        // c8 ignore next
        doDebug && debugLog("Subscription#terminate status", SubscriptionState[this.state]);
        if (this.state === SubscriptionState.CLOSED) {
            // todo verify if asserting is required here
            return;
        }
        // stop timer
        this._stop_timer();
        // c8 ignore next
        doDebug && debugLog("terminating Subscription  ", this.id, " with ", this.monitoredItemCount, " monitored items");
        // dispose all monitoredItem
        // one pass over the pending list for the whole set, not one per item
        for (const status of this.removeMonitoredItems([...this.monitoredItems.keys()])) {
            assert(status === StatusCodes.Good);
        }
        assert(this.monitoredItemCount === 0);
        if (this.$session?._unexposeSubscriptionDiagnostics) {
            this.$session._unexposeSubscriptionDiagnostics(this);
        }
        this.state = SubscriptionState.CLOSED;
        /**
         * notify the subscription owner that the subscription has been terminated.
         * @event "terminated"
         */
        this.emit("terminated");
        if (this.publishEngine) {
            this.publishEngine.on_close_subscription(this);
        }
    }
    setTriggering(triggeringItemId, linksToAdd, linksToRemove) {
        /** Bad_NothingToDo, Bad_TooManyOperations,Bad_SubscriptionIdInvalid, Bad_MonitoredItemIdInvalid */
        linksToAdd = linksToAdd || [];
        linksToRemove = linksToRemove || [];
        if (linksToAdd.length === 0 && linksToRemove.length === 0) {
            return { statusCode: StatusCodes.BadNothingToDo, addResults: [], removeResults: [] };
        }
        const triggeringItem = this.getMonitoredItem(triggeringItemId);
        const monitoredItemsToAdd = linksToAdd.map((id) => this.getMonitoredItem(id));
        const monitoredItemsToRemove = linksToRemove.map((id) => this.getMonitoredItem(id));
        if (!triggeringItem) {
            const removeResults1 = monitoredItemsToRemove.map((m) => m ? StatusCodes.Good : StatusCodes.BadMonitoredItemIdInvalid);
            const addResults1 = monitoredItemsToAdd.map((m) => m ? StatusCodes.Good : StatusCodes.BadMonitoredItemIdInvalid);
            return {
                statusCode: StatusCodes.BadMonitoredItemIdInvalid,
                addResults: addResults1,
                removeResults: removeResults1
            };
        }
        //
        // note: it seems that CTT imposed that we do remove before add
        const removeResults = monitoredItemsToRemove.map((m) => !m ? StatusCodes.BadMonitoredItemIdInvalid : triggeringItem.removeLinkItem(m.monitoredItemId));
        const addResults = monitoredItemsToAdd.map((m) => !m ? StatusCodes.BadMonitoredItemIdInvalid : triggeringItem.addLinkItem(m.monitoredItemId));
        const statusCode = StatusCodes.Good;
        // do binding
        return {
            statusCode,
            addResults,
            removeResults
        };
    }
    dispose() {
        // c8 ignore next
        if (doDebug) {
            debugLog("Subscription#dispose", this.id, this.monitoredItemCount);
        }
        assert(this.monitoredItemCount === 0, "MonitoredItems haven't been  deleted first !!!");
        assert(this.timerId === null, "Subscription timer haven't been terminated");
        if (this.subscriptionDiagnostics) {
            this.subscriptionDiagnostics.$subscription = null;
        }
        this.publishEngine = undefined;
        this._pending_notifications.clear();
        this._sent_notification_messages = [];
        this.$session = undefined;
        this.removeAllListeners();
        Subscription.registry.unregister(this);
    }
    get aborted() {
        const session = this.$session;
        if (!session) {
            return true;
        }
        return session.aborted;
    }
    /**
     * number of pending notifications
     */
    get pendingNotificationsCount() {
        return this._pending_notifications ? this._pending_notifications.size : 0;
    }
    /**
     * is 'true' if there are pending notifications for this subscription. (i.e moreNotifications)
     */
    get hasPendingNotifications() {
        return this.pendingNotificationsCount > 0;
    }
    /**
     * number of sent notifications
     */
    get sentNotificationMessageCount() {
        return this._sent_notification_messages.length;
    }
    /**
     * @internal
     */
    _flushSentNotifications() {
        const tmp = this._sent_notification_messages;
        this._sent_notification_messages = [];
        return tmp;
    }
    /**
     * number of monitored items handled by this subscription
     */
    get monitoredItemCount() {
        return this.monitoredItems.size;
    }
    /**
     * number of disabled monitored items.
     */
    get disabledMonitoredItemCount() {
        let count = 0;
        for (const monitoredItem of this.monitoredItems.values()) {
            count += monitoredItem.monitoringMode === MonitoringMode.Disabled ? 1 : 0;
        }
        return count;
    }
    /**
     * The number of unacknowledged messages saved in the republish queue.
     */
    get unacknowledgedMessageCount() {
        return this.subscriptionDiagnostics.unacknowledgedMessageCount;
    }
    /**
     * adjust monitored item sampling interval
     *  - an samplingInterval ===0 means that we use a event-base model ( no sampling)
     *  - otherwise the sampling is adjusted
     * @private
     */
    adjustSamplingInterval(samplingInterval, node) {
        if (samplingInterval < 0) {
            // - The value -1 indicates that the default sampling interval defined by the publishing
            //   interval of the Subscription is requested.
            // - Any negative number is interpreted as -1.
            samplingInterval = this.publishingInterval;
        }
        else if (samplingInterval === 0) {
            // c8 ignore next
            if (!node)
                throw new Error("Internal Error");
            // OPCUA 1.0.3 Part 4 - 5.12.1.2
            // The value 0 indicates that the Server should use the fastest practical rate.
            // The fastest supported sampling interval may be equal to 0, which indicates
            // that the data item is exception-based rather than being sampled at some period.
            // An exception-based model means that the underlying system does not require
            // sampling and reports data changes.
            const dataValueSamplingInterval = node.readAttribute(SessionContext.defaultContext, AttributeIds.MinimumSamplingInterval);
            // TODO if attributeId === AttributeIds.Value : sampling interval required here
            if (dataValueSamplingInterval.statusCode.isGood()) {
                // node provides a Minimum sampling interval ...
                samplingInterval = dataValueSamplingInterval.value.value;
                assert(samplingInterval >= 0 && samplingInterval <= MonitoredItem.maximumSamplingInterval);
                // note : at this stage, a samplingInterval===0 means that the data item is really exception-based
            }
        }
        else if (samplingInterval < MonitoredItem.minimumSamplingInterval) {
            samplingInterval = MonitoredItem.minimumSamplingInterval;
        }
        else if (samplingInterval > MonitoredItem.maximumSamplingInterval) {
            // If the requested samplingInterval is higher than the
            // maximum sampling interval supported by the Server, the maximum sampling
            // interval is returned.
            samplingInterval = MonitoredItem.maximumSamplingInterval;
        }
        const node_minimumSamplingInterval = node && node.minimumSamplingInterval ? node.minimumSamplingInterval : 0;
        samplingInterval = Math.max(samplingInterval, node_minimumSamplingInterval);
        return samplingInterval;
    }
    /**
     * create a monitored item
     * @param addressSpace - address space
     * @param timestampsToReturn  - the timestamp to return
     * @param monitoredItemCreateRequest - the parameters describing the monitored Item to create
     */
    preCreateMonitoredItem(nodeFinder, timestampsToReturn, monitoredItemCreateRequest, 
    /** the id the item keeps, when it comes from another thread of the server (TransferSubscriptions) */
    monitoredItemId) {
        assert(monitoredItemCreateRequest instanceof MonitoredItemCreateRequest);
        function handle_error(statusCode) {
            return {
                createResult: new MonitoredItemCreateResult({ statusCode }),
                monitoredItemCreateRequest
            };
        }
        const itemToMonitor = monitoredItemCreateRequest.itemToMonitor;
        const node = nodeFinder.findNode(itemToMonitor.nodeId);
        if (!node ||
            (node.nodeClass !== NodeClass.Variable && node.nodeClass !== NodeClass.Object && node.nodeClass !== NodeClass.Method)) {
            return handle_error(StatusCodes.BadNodeIdUnknown);
        }
        if (itemToMonitor.attributeId === AttributeIds.Value && !(node.nodeClass === NodeClass.Variable)) {
            // AttributeIds.Value is only valid for monitoring value of UAVariables.
            return handle_error(StatusCodes.BadAttributeIdInvalid);
        }
        if (itemToMonitor.attributeId === AttributeIds.INVALID) {
            return handle_error(StatusCodes.BadAttributeIdInvalid);
        }
        if (!itemToMonitor.indexRange.isValid()) {
            return handle_error(StatusCodes.BadIndexRangeInvalid);
        }
        // check dataEncoding applies only on Values
        if (itemToMonitor.dataEncoding.name && itemToMonitor.attributeId !== AttributeIds.Value) {
            return handle_error(StatusCodes.BadDataEncodingInvalid);
        }
        // check dataEncoding
        if (!isValidDataEncoding(itemToMonitor.dataEncoding)) {
            return handle_error(StatusCodes.BadDataEncodingUnsupported);
        }
        // The session's read permission is not checked here. It is enforced by the MonitoredItem
        // on every notification, on both the sampled and the exception-based path (see
        // MonitoredItem#_on_value_changed_exception_based and _on_sampling_timer). A session's
        // roles can change while the item is live, so the check must run per delivery, not once
        // at creation. Refusing creation here would also deny an item whose session gains access
        // later.
        // filter
        const requestedParameters = monitoredItemCreateRequest.requestedParameters;
        const filter = requestedParameters.filter;
        const statusCodeFilter = validateFilter(filter, itemToMonitor, node, {
            maxWhereClauseParameters: this.serverCapabilities.maxWhereClauseParameters,
            maxSelectClauseParameters: this.serverCapabilities.maxSelectClauseParameters
        });
        if (statusCodeFilter !== StatusCodes.Good) {
            return handle_error(statusCodeFilter);
        }
        // do we have enough room for new monitored items ?
        if (this.monitoredItemCount >= this.serverCapabilities.maxMonitoredItemsPerSubscription) {
            return handle_error(StatusCodes.BadTooManyMonitoredItems);
        }
        if (this.globalCounter.totalMonitoredItemCount >= this.serverCapabilities.maxMonitoredItems) {
            return handle_error(StatusCodes.BadTooManyMonitoredItems);
        }
        const createResult = this._createMonitoredItemStep2(timestampsToReturn, monitoredItemCreateRequest, node, monitoredItemId);
        assert(createResult.statusCode.isGood());
        const monitoredItem = this.getMonitoredItem(createResult.monitoredItemId);
        // c8 ignore next
        if (!monitoredItem) {
            throw new Error("internal error");
        }
        // TODO: fix old way to set node. !!!!
        monitoredItem.setNode(node);
        this.emit("monitoredItem", monitoredItem, itemToMonitor);
        return { monitoredItem, monitoredItemCreateRequest, createResult };
    }
    async applyOnMonitoredItem(functor) {
        for (const m of this.monitoredItems.values()) {
            await functor(m);
        }
    }
    postCreateMonitoredItem(monitoredItem, monitoredItemCreateRequest, _createResult) {
        this._createMonitoredItemStep3(monitoredItem, monitoredItemCreateRequest);
    }
    async createMonitoredItem(nodeFinder, timestampsToReturn, monitoredItemCreateRequest) {
        const { monitoredItem, createResult } = this.preCreateMonitoredItem(nodeFinder, timestampsToReturn, monitoredItemCreateRequest);
        if (!monitoredItem) {
            return createResult;
        }
        this.postCreateMonitoredItem(monitoredItem, monitoredItemCreateRequest, createResult);
        return createResult;
    }
    /**
     * get a monitoredItem by Id.
     * @param monitoredItemId : the id of the monitored item to get.
     * @return the monitored item matching monitoredItemId
     */
    getMonitoredItem(monitoredItemId) {
        return this.monitoredItems.get(monitoredItemId) || null;
    }
    /**
     * remove a monitored Item from the subscription.
     * @param monitoredItemId : the id of the monitored item to get.
     */
    removeMonitoredItem(monitoredItemId) {
        const status = this._detachMonitoredItem(monitoredItemId);
        if (status === StatusCodes.Good) {
            this._removePendingNotificationsFor(monitoredItemId);
        }
        return status;
    }
    /**
     * Remove several monitored items, purging their queued notifications in one
     * pass over the pending list.
     *
     * Removing them one at a time costs O(items x pending): dropping the queued
     * notifications of a single item walks the whole pending list, and that walk
     * is repeated for every item. The product is what hurts - it is invisible at
     * ten items and grows quadratically when a subscription with a large backlog
     * is torn down wholesale, which is exactly what DeleteMonitoredItems and
     * terminate() do.
     */
    removeMonitoredItems(monitoredItemIds) {
        const statuses = monitoredItemIds.map((id) => this._detachMonitoredItem(id));
        const removed = new Set(monitoredItemIds.filter((_id, i) => statuses[i] === StatusCodes.Good));
        if (removed.size) {
            const n = this._pending_notifications.filterOut((e) => e.monitoredItemId !== undefined && removed.has(e.monitoredItemId));
            // c8 ignore next
            doDebug && debugLog(`Removed ${n} notifications for ${removed.size} monitored items`);
        }
        return statuses;
    }
    /** everything removing a monitored item does, except purging its pending notifications */
    _detachMonitoredItem(monitoredItemId) {
        // c8 ignore next
        doDebug && debugLog("Removing monitoredIem ", monitoredItemId);
        const monitoredItem = this.monitoredItems.get(monitoredItemId);
        if (!monitoredItem) {
            return StatusCodes.BadMonitoredItemIdInvalid;
        }
        monitoredItem.terminate();
        /**
         *
         * notify that a monitored item has been removed from the subscription
         * @param monitoredItem {MonitoredItem}
         */
        this.emit("removeMonitoredItem", monitoredItem);
        monitoredItem.dispose();
        this.monitoredItems.delete(monitoredItemId);
        this.globalCounter.totalMonitoredItemCount -= 1;
        return StatusCodes.Good;
    }
    /**
     * rue if monitored Item have uncollected Notifications
     */
    get hasUncollectedMonitoredItemNotifications() {
        if (this._hasUncollectedMonitoredItemNotifications) {
            return true;
        }
        for (const monitoredItem of this.monitoredItems.values()) {
            if (monitoredItem.hasMonitoredItemNotifications) {
                this._hasUncollectedMonitoredItemNotifications = true;
                return true;
            }
        }
        return false;
    }
    get subscriptionId() {
        return this.id;
    }
    getMessageForSequenceNumber(sequenceNumber) {
        const notification_message = this._sent_notification_messages.find((e) => e.sequenceNumber === sequenceNumber);
        return notification_message || null;
    }
    /**
     * returns true if the notification has expired
     * @param notification
     */
    notificationHasExpired(notification) {
        assert(Object.hasOwn(notification, "start_tick"));
        assert(Number.isFinite(notification.start_tick + this.maxKeepAliveCount));
        return notification.start_tick + this.maxKeepAliveCount < this.publishIntervalCount;
    }
    /**
     *  returns in an array the sequence numbers of the notifications that have been sent
     *  and that haven't been acknowledged yet.
     */
    /** what another thread of the server needs to carry on this subscription (see continueFrom) */
    exportTransferState() {
        return {
            id: this.id,
            publishingInterval: this.publishingInterval,
            lifeTimeCount: this.lifeTimeCount,
            maxKeepAliveCount: this.maxKeepAliveCount,
            maxNotificationsPerPublish: this.maxNotificationsPerPublish,
            publishingEnabled: this.publishingEnabled,
            priority: this.priority,
            nextSequenceNumber: this._sequence_number_generator.future(),
            sentNotificationMessages: [...this._sent_notification_messages],
            monitoredItems: [...this.monitoredItems.values()].map((monitoredItem) => ({
                monitoredItemId: monitoredItem.monitoredItemId,
                timestampsToReturn: monitoredItem.timestampsToReturn,
                linkedItems: [...monitoredItem.linkedItems],
                request: new MonitoredItemCreateRequest({
                    itemToMonitor: monitoredItem.itemToMonitor,
                    monitoringMode: monitoredItem.monitoringMode,
                    requestedParameters: {
                        clientHandle: monitoredItem.clientHandle,
                        samplingInterval: monitoredItem.samplingInterval,
                        filter: monitoredItem.filter,
                        queueSize: monitoredItem.queueSize,
                        discardOldest: monitoredItem.discardOldest
                    }
                })
            }))
        };
    }
    /**
     * the data changes and events of its items not published yet, taken out of this subscription: they go
     * with it to the session of another thread, whose first Publish carries them (requeueNotifications)
     */
    takePendingNotifications() {
        this._harvestMonitoredItems();
        const ofAnItem = (e) => e.monitoredItemId !== undefined && !(e.notification instanceof StatusChangeNotification);
        const taken = [];
        for (const e of this._pending_notifications.values()) {
            if (ofAnItem(e))
                taken.push({ monitoredItemId: e.monitoredItemId, notification: e.notification });
        }
        this._pending_notifications.filterOut(ofAnItem);
        return taken;
    }
    /** the notifications another thread took (takePendingNotifications), to publish as if collected here */
    requeueNotifications(notifications) {
        for (const { monitoredItemId, notification } of notifications)
            this._addNotificationMessage(notification, monitoredItemId);
    }
    /** a subscription carried over from another thread: its sequence numbers and the messages not acknowledged */
    continueFrom(nextSequenceNumber, sentNotificationMessages) {
        this._sequence_number_generator._set(nextSequenceNumber);
        this._sent_notification_messages = [...sentNotificationMessages];
    }
    getAvailableSequenceNumbers() {
        const availableSequenceNumbers = _getSequenceNumbers(this._sent_notification_messages);
        return availableSequenceNumbers;
    }
    /**
     * acknowledges a notification identified by its sequence number
     */
    acknowledgeNotification(sequenceNumber) {
        // c8 ignore next
        doDebug && debugLog("acknowledgeNotification ", sequenceNumber);
        let foundIndex = -1;
        this._sent_notification_messages.forEach((e, index) => {
            if (e.sequenceNumber === sequenceNumber) {
                foundIndex = index;
            }
        });
        if (foundIndex === -1) {
            // c8 ignore next
            if (doDebug) {
                debugLog(chalk.red("acknowledging sequence FAILED !!! "), chalk.cyan(sequenceNumber.toString()));
            }
            return StatusCodes.BadSequenceNumberUnknown;
        }
        else {
            // c8 ignore next
            if (doDebug) {
                debugLog(chalk.yellow("acknowledging sequence "), chalk.cyan(sequenceNumber.toString()));
            }
            this._sent_notification_messages.splice(foundIndex, 1);
            this.subscriptionDiagnostics.unacknowledgedMessageCount--;
            return StatusCodes.Good;
        }
    }
    /**
     * getMonitoredItems is used to get information about monitored items of a subscription.Its intended
     * use is defined in Part 4. This method is the implementation of the Standard OPCUA GetMonitoredItems Method.
     * from spec:
     * This method can be used to get the  list of monitored items in a subscription if CreateMonitoredItems
     * failed due to a network interruption and the client does not know if the creation succeeded in the server.
     *
     */
    getMonitoredItems() {
        const monitoredItems = [...this.monitoredItems.keys()];
        const monitoredItemCount = monitoredItems.length;
        const result = {
            clientHandles: new Uint32Array(monitoredItemCount),
            serverHandles: new Uint32Array(monitoredItemCount),
            statusCode: StatusCodes.Good
        };
        for (let index = 0; index < monitoredItemCount; index++) {
            const serverHandle = monitoredItems[index];
            const monitoredItem = this.getMonitoredItem(serverHandle);
            // c8 ignore next
            if (!monitoredItem) {
                throw new Error("monitoredItem is null");
            }
            result.clientHandles[index] = monitoredItem.clientHandle;
            // TODO:  serverHandle is defined anywhere in the OPCUA Specification 1.02
            //        I am not sure what shall be reported for serverHandle...
            //        using monitoredItem.monitoredItemId instead...
            //        May be a clarification in the OPCUA Spec is required.
            result.serverHandles[index] = serverHandle;
        }
        return result;
    }
    /**
     * @private
     */
    async resendInitialValues() {
        this._keep_alive_counter = 0;
        try {
            const promises = [];
            for (const monitoredItem of this.monitoredItems.values()) {
                promises.push((async () => {
                    try {
                        monitoredItem.resendInitialValue();
                    }
                    catch (err) {
                        warningLog("resendInitialValues:", monitoredItem.node?.nodeId.toString(), "error:", err.message);
                    }
                })());
            }
            await Promise.all(promises);
        }
        catch (err) {
            warningLog("resendInitialValues: error:", err.message);
        }
        // make sure data will be sent immediately
        this._keep_alive_counter = this.maxKeepAliveCount - 1;
        this.state = SubscriptionState.NORMAL;
        this._harvestMonitoredItems();
    }
    /**
     * @private
     */
    notifyTransfer() {
        // OPCUA UA Spec 1.0.3 : part 3 - page 82 - 5.13.7 TransferSubscriptions:
        // If the Server transfers the Subscription to the new Session, the Server shall issue
        // a StatusChangeNotification notificationMessage with the status code
        // Good_SubscriptionTransferred to the old Session.
        // c8 ignore next
        doDebug && debugLog(chalk.red(" Subscription => Notifying Transfer                                  "));
        const notificationData = new StatusChangeNotification({
            status: StatusCodes.GoodSubscriptionTransferred
        });
        if (this.publishEngine?.pendingPublishRequestCount) {
            // the GoodSubscriptionTransferred can be processed immediately
            this._addNotificationMessage(notificationData);
            // c8 ignore next
            doDebug && debugLog(chalk.red("pendingPublishRequestCount"), this.publishEngine?.pendingPublishRequestCount);
            this._publish_pending_notifications();
        }
        else {
            // c8 ignore next
            doDebug && debugLog(chalk.red("Cannot  send GoodSubscriptionTransferred => lets create a TransferredSubscription "));
            // c8 ignore next
            if (!this.publishEngine) {
                warningLog("notifyTransfer: publishEngine is not available");
                return;
            }
            const ts = new TransferredSubscription({
                generator: this._sequence_number_generator,
                id: this.id,
                publishEngine: this.publishEngine
            });
            ts._pending_notification = notificationData;
            this.publishEngine._closed_subscriptions.push(ts);
        }
    }
    /**
     *
     *  the server invokes the resetLifeTimeAndKeepAliveCounters method of the subscription
     *  when the server  has send a Publish Response, so that the subscription
     *  can reset its life time counter.
     *
     * @private
     */
    resetLifeTimeAndKeepAliveCounters() {
        this.resetLifeTimeCounter();
        this.resetKeepAliveCounter();
    }
    _updateCounters(notificationMessage) {
        for (const notificationData of notificationMessage.notificationData || []) {
            // update diagnostics
            if (notificationData instanceof DataChangeNotification) {
                const nbNotifs = notificationData.monitoredItems?.length || 0;
                this.subscriptionDiagnostics.dataChangeNotificationsCount += nbNotifs;
                this.subscriptionDiagnostics.notificationsCount += nbNotifs;
            }
            else if (notificationData instanceof EventNotificationList) {
                const nbNotifs = notificationData.events?.length || 0;
                this.subscriptionDiagnostics.eventNotificationsCount += nbNotifs;
                this.subscriptionDiagnostics.notificationsCount += nbNotifs;
            }
            else {
                assert(notificationData instanceof StatusChangeNotification);
                // TODO
                // note: :there is no way to count StatusChangeNotifications in opcua yet.
            }
        }
    }
    /**
     *  _publish_pending_notifications send a "notification" event:
     *
     * @private
     *
     * precondition
     *     - pendingPublishRequestCount > 0
     */
    _publish_pending_notifications() {
        const publishEngine = this.publishEngine;
        // c8 ignore next
        if (!publishEngine) {
            throw new Error("publishEngine is null");
        }
        const subscriptionId = this.id;
        // preconditions
        assert(publishEngine.pendingPublishRequestCount > 0);
        assert(this.hasPendingNotifications);
        const notificationMessage = this._popNotificationToSend();
        if (notificationMessage.notificationData?.length === 0) {
            return; // nothing to do
        }
        const moreNotifications = this.hasPendingNotifications;
        this.emit("notification", notificationMessage);
        // Update counters ....
        this._updateCounters(notificationMessage);
        assert(Object.hasOwn(notificationMessage, "sequenceNumber"));
        assert(Object.hasOwn(notificationMessage, "notificationData"));
        // update diagnostics
        this.subscriptionDiagnostics.publishRequestCount += 1;
        const response = new PublishResponse({
            moreNotifications,
            notificationMessage: {
                notificationData: notificationMessage.notificationData,
                sequenceNumber: this._get_next_sequence_number()
            },
            subscriptionId
        });
        this._sent_notification_messages.push(response.notificationMessage);
        // get available sequence number;
        const availableSequenceNumbers = this.getAvailableSequenceNumbers();
        assert(!response.notificationMessage ||
            availableSequenceNumbers[availableSequenceNumbers.length - 1] === response.notificationMessage.sequenceNumber);
        response.availableSequenceNumbers = availableSequenceNumbers;
        publishEngine._send_response(this, response);
        this.messageSent = true;
        this.subscriptionDiagnostics.unacknowledgedMessageCount++;
        this.resetLifeTimeAndKeepAliveCounters();
        // c8 ignore next
        if (doDebug) {
            debugLog("Subscription sending a notificationMessage subscriptionId=", subscriptionId, "sequenceNumber = ", notificationMessage.sequenceNumber.toString(), notificationMessage.notificationData?.map((x) => x?.constructor.name).join(" "));
            // debugLog(notificationMessage.toString());
        }
        if (this.state !== SubscriptionState.CLOSED) {
            assert((notificationMessage.notificationData?.length || 0) > 0, "We are not expecting a keep-alive message here");
            this.state = SubscriptionState.NORMAL;
            // c8 ignore next
            doDebug && debugLog(`subscription ${this.id}${chalk.bgYellow(" set to NORMAL")}`);
        }
    }
    process_subscription() {
        assert((this.publishEngine?.pendingPublishRequestCount || 0) > 0);
        if (!this.publishingEnabled) {
            // no publish to do, except keep alive
            // c8 ignore next
            doDebug && debugLog("    -> no publish to do, except keep alive");
            this._process_keepAlive();
            return;
        }
        if (!this.hasPendingNotifications && this.hasUncollectedMonitoredItemNotifications) {
            // collect notification from monitored items
            this._harvestMonitoredItems();
        }
        // let process them first
        if (this.hasPendingNotifications) {
            this._publish_pending_notifications();
            if (this.state !== SubscriptionState.CLOSED) {
                // c8 ignore next
                if (doDebug) {
                    debugLog("    -> message sent => flush what is left with the next queued PublishRequest");
                }
                setImmediate(this._flushRemainingNotifications.bind(this));
            }
        }
        else {
            this._process_keepAlive();
        }
    }
    /**
     * Whatever did not fit in the message just sent (moreNotifications), or was queued by a
     * monitored item meanwhile, goes out with the next queued PublishRequest without waiting for
     * the publishing timer; with no request queued the subscription is LATE so the next Publish
     * serves it on arrival.
     *
     * This used to be a full _tick, which also counted a publishing cycle: publishIntervalCount,
     * the lifetime counter and, through _process_keepAlive, the keep-alive counter all moved on,
     * so a subscription owed its keep-alive one cycle after a data message instead of
     * maxKeepAliveCount cycles (Part 4 5.13.1.1: the keep-alive counter counts *publishing
     * cycles* with nothing to report). With maxKeepAliveCount at its minimum of 2, that
     * keep-alive fell due at the very next tick and, being overdue, was served ahead of a
     * sibling that had never been served (FEAT-37: CTT Subscription Publish Min 05 003
     * queues exactly five Publish requests for five subscriptions, so the stolen request left
     * one subscription without any response).
     */
    _flushRemainingNotifications() {
        if (this.state === SubscriptionState.CLOSED || !this.publishingEnabled) {
            return;
        }
        if (!this.hasPendingNotifications && !this.hasUncollectedMonitoredItemNotifications) {
            return;
        }
        const publishEngine = this.publishEngine;
        if (!publishEngine) {
            return;
        }
        if (publishEngine.pendingPublishRequestCount === 0) {
            // c8 ignore next
            doDebug && debugLog(`subscription ${this.id} set to LATE: more notifications, no PublishRequest`);
            this.state = SubscriptionState.LATE;
            return;
        }
        if (publishEngine.feedReadySubscriptions) {
            publishEngine.feedReadySubscriptions();
        }
        else {
            this.process_subscription();
        }
    }
    _process_keepAlive() {
        // Still inside the very first publishing cycle: nothing may be sent yet.
        // OPC 10000-4 5.13.1 has the first Message go out "at the end of the first
        // publishing cycle", and _start_timer pre-loads the keep-alive counter to
        // maxKeepAliveCount - 1 precisely so the first *tick* emits it. A
        // PublishRequest arriving before that tick reaches here through
        // process_subscription and would find the counter already at its limit,
        // sending the keep-alive immediately: CTT Subscription Basic 018 asks for
        // the first Publish response after 1 RevisedPublishingInterval and measured
        // 19 ms. publishIntervalCount is 0 until the first tick.
        if (this.publishIntervalCount === 0) {
            return;
        }
        this.increaseKeepAliveCounter();
        if (this.keepAliveCounterHasExpired) {
            // c8 ignore next
            doDebug && debugLog(`     ->  _process_keepAlive => keepAliveCounterHasExpired`);
            if (this._sendKeepAliveResponse()) {
                this.resetLifeTimeAndKeepAliveCounters();
            }
            else {
                // c8 ignore next
                doDebug &&
                    debugLog("     -> subscription.state === LATE , " +
                        "because keepAlive Response cannot be send due to lack of PublishRequest");
                if (this.messageSent || this.keepAliveCounterHasExpired) {
                    this.state = SubscriptionState.LATE;
                }
            }
        }
    }
    _stop_timer() {
        if (this.timerId) {
            // c8 ignore next
            doDebug && debugLog(chalk.bgWhite.blue("Subscription#_stop_timer subscriptionId="), this.id);
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }
    _start_timer({ firstTime }) {
        // c8 ignore next
        doDebug &&
            debugLog(chalk.bgWhite.blue("Subscription#_start_timer  subscriptionId="), this.id, " publishingInterval = ", this.publishingInterval);
        assert(this.timerId === null);
        // from the spec:
        // When a Subscription is created, the first Message is sent at the end of the first publishing cycle to
        // inform the Client that the Subscription is operational. A NotificationMessage is sent if there are
        // Notifications ready to be reported. If there are none, a keep-alive Message is sent instead that
        // contains a sequence number of 1, indicating that the first NotificationMessage has not yet been sent.
        // This is the only time a keep-alive Message is sent without waiting for the maximum keep-alive count
        // to be reached, as specified in (f) above.
        // make sure that a keep-alive Message will be send at the end of the first publishing cycle
        // if there are no Notifications ready.
        this._keep_alive_counter = this.maxKeepAliveCount - 1;
        if (firstTime) {
            assert(this.messageSent === false);
            assert(this.state === SubscriptionState.CREATING);
        }
        assert(this.publishingInterval >= Subscription.minimumPublishingInterval);
        this.timerId = setInterval(this._tick.bind(this), this.publishingInterval);
    }
    _get_future_sequence_number() {
        return this._sequence_number_generator ? this._sequence_number_generator.future() : 0;
    }
    get futureSequenceNumber() {
        return this._get_future_sequence_number();
    }
    // counter
    _get_next_sequence_number() {
        return this._sequence_number_generator ? this._sequence_number_generator.next() : 0;
    }
    get nextSequenceNumber() {
        return this._get_next_sequence_number();
    }
    /**
     * @private
     */
    _tick() {
        // c8 ignore next
        if (doDebug) {
            debugLog(`Subscription#_tick id ${this.id} aborted=${this.aborted} state=${SubscriptionState[this.state]}`);
        }
        if (this.state === SubscriptionState.CLOSED) {
            warningLog(`Warning: Subscription#_tick id ${this.id}  called while subscription is CLOSED`);
            return;
        }
        this.discardOldSentNotifications();
        // c8 ignore next
        if (doDebug) {
            debugLog(`${t(new Date())}  ${this._life_time_counter}/${this.lifeTimeCount}${chalk.cyan("   Subscription#_tick")}`, "  processing subscriptionId=", this.id, "hasUncollectedMonitoredItemNotifications = ", this.hasUncollectedMonitoredItemNotifications, " publishingIntervalCount =", this.publishIntervalCount);
        }
        // give a chance to the publish engine to cancel timed out publish requests
        this.publishEngine?._on_tick();
        this.publishIntervalCount += 1;
        if (this.state === SubscriptionState.LATE) {
            this.increaseLifeTimeCounter();
        }
        if (this.lifeTimeHasExpired) {
            /* c8 ignore next */
            doDebug && debugLog(chalk.red.bold(`Subscription ${this.id} has expired !!!!! => Terminating`));
            /**
             * notify the subscription owner that the subscription has expired by exceeding its life time.
             * @event expired
             *
             */
            this.emit("expired");
            // notify new terminated status only when subscription has timeout.
            doDebug && debugLog("adding StatusChangeNotification notification message for BadTimeout subscription = ", this.id);
            this._addNotificationMessage(new StatusChangeNotification({ status: StatusCodes.BadTimeout }));
            // kill timer and delete monitored items and transfer pending notification messages
            this.terminate();
            return;
        }
        const publishEngine = this.publishEngine;
        if (!publishEngine) {
            throw new Error("publishEngine is null");
        }
        // c8 ignore next
        doDebug && debugLog("Subscription#_tick  self._pending_notifications= ", this._pending_notifications.size);
        // A disabled subscription holds its notifications back (SetPublishingMode, Part 4 5.13.4)
        // and owes nothing but its keep-alive, under its own id: what its monitored items have
        // queued must neither make it LATE nor send it to the engine's arbitration, which only
        // serves subscriptions that may publish (FEAT-35: CTT Subscription Basic 014/044/046/048).
        const hasNotificationsToPublish = this.publishingEnabled && (this.hasPendingNotifications || this.hasUncollectedMonitoredItemNotifications);
        if (publishEngine.pendingPublishRequestCount === 0 && hasNotificationsToPublish) {
            // c8 ignore next
            doDebug &&
                debugLog("subscription set to LATE  hasPendingNotifications = ", this.hasPendingNotifications, " hasUncollectedMonitoredItemNotifications =", this.hasUncollectedMonitoredItemNotifications);
            this.state = SubscriptionState.LATE;
            return;
        }
        if (publishEngine.pendingPublishRequestCount > 0) {
            if (hasNotificationsToPublish) {
                // A sibling subscription on this same session may deserve the next queued
                // PublishRequest more (higher priority, or waited longer at equal priority).
                // Let the engine arbitrate across every ready subscription it owns instead of
                // this one serving itself just because its own timer fired first (FEAT-24).
                // Fall back to self-service for lightweight engine doubles (unit tests) that
                // only ever attach a single subscription.
                if (publishEngine.feedReadySubscriptions) {
                    publishEngine.feedReadySubscriptions();
                }
                else {
                    this.process_subscription();
                }
            }
            else {
                this._process_keepAlive();
            }
        }
        else {
            if (this.state !== SubscriptionState.LATE) {
                this._process_keepAlive();
            }
            else {
                this.resetKeepAliveCounter();
            }
        }
    }
    /**
     * @private
     */
    _sendKeepAliveResponse() {
        const future_sequence_number = this._get_future_sequence_number();
        if (this.publishEngine?.send_keep_alive_response(this.id, future_sequence_number)) {
            this.messageSent = true;
            // c8 ignore next
            doDebug &&
                debugLog(`    -> Subscription#_sendKeepAliveResponse subscriptionId ${this.id} future_sequence_number ${future_sequence_number}`);
            /**
             * notify the subscription owner that a keepalive message has to be sent.
             * @event keepalive
             *
             */
            this.emit("keepalive", future_sequence_number);
            this.state = SubscriptionState.KEEPALIVE;
            return true;
        }
        return false;
    }
    /**
     * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
     * the CreateSubscription Service( 5.13.2).
     * @private
     */
    resetKeepAliveCounter() {
        this._keep_alive_counter = 0;
        // c8 ignore next
        doDebug &&
            debugLog("     -> subscriptionId", this.id, " Resetting keepAliveCounter = ", this._keep_alive_counter, this.maxKeepAliveCount);
    }
    /**
     * @private
     */
    increaseKeepAliveCounter() {
        this._keep_alive_counter += 1;
        // c8 ignore next
        doDebug &&
            debugLog("     -> subscriptionId", this.id, " Increasing keepAliveCounter = ", this._keep_alive_counter, this.maxKeepAliveCount);
    }
    /**
     * @private
     */
    _addNotificationMessage(notificationData, monitoredItemId) {
        // c8 ignore next
        doDebug && debugLog(chalk.yellow("Subscription#_addNotificationMessage"), notificationData.toString());
        const { notification, size } = this._degradeIfUndeliverable(notificationData);
        this._pending_notifications.push({
            monitoredItemId,
            notification,
            size,
            publishTime: new Date(),
            start_tick: this.publishIntervalCount
        });
    }
    /**
     * A value larger than the whole message budget can never reach this client:
     * it will not fit even alone in a message. Sending it anyway makes the
     * transport tear the channel down, taking every other subscription on that
     * channel with it, and dropping it silently leaves the client waiting for a
     * value that will never come.
     *
     * So the notification is kept and only its payload is replaced: same
     * clientHandle, same timestamps, a status of BadResponseTooLarge - "the
     * response message size exceeds limits set by the client or server", which
     * is exactly what happened - and no value. The client learns which item
     * failed, the subscription lives, and the item recovers by itself when its
     * value next fits, the status change being a change like any other.
     */
    _degradeIfUndeliverable(notificationData) {
        const budget = this.maxNotificationMessageSize;
        if (!budget || !(notificationData instanceof MonitoredItemNotification)) {
            return { notification: notificationData, size: undefined };
        }
        // Measured once, here, and carried on the queue entry: binaryStoreSize
        // walks the whole structure, and the batching loop needs the same number
        // later. Cheap per notification - a traversal, no copying - but it is the
        // hottest path in the server and there is no reason to walk twice.
        const size = notificationData.binaryStoreSize();
        // compared against an empty message, not the remaining room: a value that
        // would have fitted alone must be deferred, never degraded
        if (size + notificationMessageOverhead <= budget) {
            return { notification: notificationData, size };
        }
        warningLog(`a value for monitored item clientHandle=${notificationData.clientHandle} is ${size} bytes,` +
            ` more than this channel can carry (${budget}); reporting BadResponseTooLarge instead`);
        const degraded = new MonitoredItemNotification({
            clientHandle: notificationData.clientHandle,
            value: new DataValue({
                statusCode: StatusCodes.BadResponseTooLarge,
                sourceTimestamp: notificationData.value?.sourceTimestamp,
                serverTimestamp: notificationData.value?.serverTimestamp
            })
        });
        return { notification: degraded, size: degraded.binaryStoreSize() };
    }
    /**
     * @internal
     * @param monitoredItemId
     */
    _removePendingNotificationsFor(monitoredItemId) {
        const nbRemovedNotification = this._pending_notifications.filterOut((e) => e.monitoredItemId === monitoredItemId);
        doDebug && debugLog(`Removed ${nbRemovedNotification} notifications`);
    }
    /**
     * Extract the next Notification that is ready to be sent to the client.
     * @return the Notification to send._pending_notifications
     */
    _popNotificationToSend() {
        assert(this._pending_notifications.size > 0);
        const notificationMessage = new NotificationMessage({
            sequenceNumber: 0xffffffff,
            notificationData: [],
            publishTime: new Date()
        }); //
        const dataChangeNotifications = new DataChangeNotification({
            monitoredItems: []
        });
        const eventNotificationList = new EventNotificationList({
            events: []
        });
        let statusChangeNotification;
        let i = 0;
        let hasEventFieldList = 0;
        let hasMonitoredItemNotification = 0;
        const m = this.maxNotificationsPerPublish;
        // The count is only half the bound. What a client actually refuses is a
        // message longer than the maxMessageSize it declared in its Hello, and a
        // count cannot express that: a Boolean notification and one carrying a
        // 64 kB ByteString differ by four orders of magnitude, so no constant is
        // right for both. Bytes are therefore accumulated too, and whichever
        // limit is reached first ends the message; the rest stays queued and
        // goes out on the next publish under moreNotifications.
        const budget = this.maxNotificationMessageSize;
        let bytes = budget ? notificationMessageOverhead : 0;
        while (i < m && this._pending_notifications.size > 0) {
            if (hasEventFieldList || hasMonitoredItemNotification) {
                const notification1 = this._pending_notifications.first()?.notification;
                if (notification1 instanceof StatusChangeNotification) {
                    break;
                }
            }
            if (budget) {
                const entry = this._pending_notifications.first();
                const next = entry?.notification;
                // measured at capture; recomputed only if this entry predates a
                // channel that announced a limit, when none was measured then
                const size = next && !(next instanceof StatusChangeNotification) ? (entry?.size ?? next.binaryStoreSize()) : 0;
                // `i > 0` is what guarantees progress: the first notification of
                // a message is always taken, however heavy it is, so an outsized
                // value leads the next message rather than being deferred for
                // ever behind an empty one.
                if (i > 0 && bytes + size > budget) {
                    break;
                }
                bytes += size;
            }
            const notification = this._pending_notifications.shift()?.notification;
            if (notification instanceof MonitoredItemNotification) {
                assert(notification.clientHandle !== 4294967295);
                dataChangeNotifications.monitoredItems?.push(notification);
                hasMonitoredItemNotification = 1;
            }
            else if (notification instanceof EventFieldList) {
                eventNotificationList.events?.push(notification);
                hasEventFieldList = 1;
            }
            else if (notification instanceof StatusChangeNotification) {
                // to do
                statusChangeNotification = notification;
                break;
            }
            i += 1;
        }
        if (dataChangeNotifications.monitoredItems?.length) {
            notificationMessage.notificationData?.push(dataChangeNotifications);
        }
        if (eventNotificationList.events?.length) {
            notificationMessage.notificationData?.push(eventNotificationList);
        }
        if (statusChangeNotification) {
            notificationMessage.notificationData?.push(statusChangeNotification);
        }
        return notificationMessage;
    }
    /**
     * discardOldSentNotification find all sent notification message that have expired keep-alive
     * and destroy them.
     * @private
     *
     * Subscriptions maintain a retransmission queue of sent  NotificationMessages.
     * NotificationMessages are retained in this queue until they are acknowledged or until they have
     * been in the queue for a minimum of one keep-alive interval.
     *
     */
    discardOldSentNotifications() {
        // Sessions maintain a retransmission queue of sent NotificationMessages. NotificationMessages
        // are retained in this queue until they are acknowledged. The Session shall maintain a
        // retransmission queue size of at least two times the number of Publish requests per Session the
        // Server supports.  Clients are required to acknowledge NotificationMessages as they are received. In the
        // case of a retransmission queue overflow, the oldest sent NotificationMessage gets deleted. If a
        // Subscription is transferred to another Session, the queued NotificationMessages for this
        // Subscription are moved from the old to the new Session.
        if (maxNotificationMessagesInQueue < this._sent_notification_messages.length) {
            doDebug && debugLog("discardOldSentNotifications = ", this._sent_notification_messages.length);
            this._sent_notification_messages.splice(0, this._sent_notification_messages.length - maxNotificationMessagesInQueue);
        }
    }
    /**
     * @param timestampsToReturn
     * @param monitoredItemCreateRequest
     * @param node
     * @private
     */
    _createMonitoredItemStep2(timestampsToReturn, monitoredItemCreateRequest, node, givenMonitoredItemId) {
        // note : most of the parameter inconsistencies shall have been handled by the caller
        // any error here will raise an assert here
        assert(monitoredItemCreateRequest instanceof MonitoredItemCreateRequest);
        const itemToMonitor = monitoredItemCreateRequest.itemToMonitor;
        // xx check if attribute Id invalid (we only support Value or EventNotifier )
        // xx assert(itemToMonitor.attributeId !== AttributeIds.INVALID);
        this.monitoredItemIdCounter += 1;
        const monitoredItemId = givenMonitoredItemId ?? this.#allocateMonitoredItemId();
        const requestedParameters = monitoredItemCreateRequest.requestedParameters;
        // adjust requestedParameters.samplingInterval
        requestedParameters.samplingInterval = this.adjustSamplingInterval(requestedParameters.samplingInterval, node);
        // reincorporate monitoredItemId and itemToMonitor into the requestedParameters
        const options = requestedParameters;
        options.monitoredItemId = monitoredItemId;
        options.itemToMonitor = itemToMonitor;
        options.minSupportedSampleRate = this.serverCapabilities.minSupportedSampleRate;
        const monitoredItem = new MonitoredItem(options);
        monitoredItem.timestampsToReturn = timestampsToReturn;
        monitoredItem.$subscription = this;
        assert(monitoredItem.monitoredItemId === monitoredItemId);
        this.monitoredItems.set(monitoredItemId, monitoredItem);
        this.globalCounter.totalMonitoredItemCount += 1;
        assert(monitoredItem.clientHandle !== 4294967295);
        const filterResult = _process_filter(node, requestedParameters.filter);
        const monitoredItemCreateResult = new MonitoredItemCreateResult({
            filterResult,
            monitoredItemId,
            revisedQueueSize: monitoredItem.queueSize,
            revisedSamplingInterval: monitoredItem.samplingInterval,
            statusCode: StatusCodes.Good
        });
        // this.emit("monitoredItem", monitoredItem, itemToMonitor);
        return monitoredItemCreateResult;
    }
    /**
     *
     * @param monitoredItem
     * @param monitoredItemCreateRequest
     * @private
     */
    _createMonitoredItemStep3(monitoredItem, monitoredItemCreateRequest) {
        if (!monitoredItem) {
            return;
        }
        assert(monitoredItem.monitoringMode === MonitoringMode.Invalid);
        assert(typeof monitoredItem.samplingFunc === "function", " expecting a sampling function here");
        const monitoringMode = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
        monitoredItem.setMonitoringMode(monitoringMode);
    }
    _harvestMonitoredItems() {
        for (const monitoredItem of this.monitoredItems.values()) {
            const notifications_chunks = monitoredItem.extractMonitoredItemNotifications();
            for (const chunk of notifications_chunks) {
                this._addNotificationMessage(chunk, monitoredItem.monitoredItemId);
            }
        }
        this._hasUncollectedMonitoredItemNotifications = false;
    }
}
assert(Subscription.maximumPublishingInterval < 2147483647, "maximumPublishingInterval cannot exceed (2**31-1) ms ");
//# sourceMappingURL=server_subscription.js.map