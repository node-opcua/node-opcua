/**
 * @module node-opcua-server
 */
// tslint:disable:no-console

import { EventEmitter } from "events";
import * as chalk from "chalk";

import { AddressSpace, BaseNode, Duration, UAObjectType } from "node-opcua-address-space";
import { checkSelectClauses } from "node-opcua-address-space";
import { SessionContext } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { Byte, UInt32 } from "node-opcua-basic-types";
import { SubscriptionDiagnosticsDataType } from "node-opcua-common";
import { NodeClass, AttributeIds, isValidDataEncoding } from "node-opcua-data-model";
import { TimestampsToReturn } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { ObjectRegistry } from "node-opcua-object-registry";
import { SequenceNumberGenerator } from "node-opcua-secure-channel";
import { EventFilter } from "node-opcua-service-filter";
import { AggregateFilter } from "node-opcua-service-subscription";
import {
    DataChangeNotification,
    EventNotificationList,
    MonitoringMode,
    MonitoredItemCreateResult,
    MonitoredItemNotification,
    PublishResponse,
    NotificationMessage,
    StatusChangeNotification,
    DataChangeFilter,
    MonitoredItemCreateRequest
} from "node-opcua-service-subscription";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { AggregateFilterResult, ContentFilterResult, EventFieldList, EventFilterResult, NotificationData } from "node-opcua-types";
import { Queue } from "./queue";

import { MonitoredItem, MonitoredItemOptions, QueueItem } from "./monitored_item";
import { ServerSession } from "./server_session";
import { validateFilter } from "./validate_filter";
import { IServerSidePublishEngine, TransferredSubscription } from "./i_server_side_publish_engine";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);
const maxNotificationMessagesInQueue = 100;

export interface SubscriptionDiagnosticsDataTypePriv extends SubscriptionDiagnosticsDataType {
    $subscription: Subscription;
}

export enum SubscriptionState {
    CLOSED = 1, // The Subscription has not yet been created or has terminated.
    CREATING = 2, // The Subscription is being created
    NORMAL = 3, // The Subscription is cyclically checking for Notifications from its MonitoredItems.
    // The keep-alive counter is not used in this state.
    LATE = 4, // The publishing timer has expired and there are Notifications available or a keep-alive Message is
    // ready to be sent, but there are no Publish requests queued. When in this state, the next Publish
    // request is processed when it is received. The keep-alive counter is not used in this state.
    KEEPALIVE = 5, // The Subscription is cyclically checking for Notification
    // alive counter to count down to 0 from its maximum.
    TERMINATED = 6
}

function _adjust_publishing_interval(publishingInterval?: number): number {
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

function _adjust_maxKeepAliveCount(maxKeepAliveCount?: number /*,publishingInterval*/): number {
    maxKeepAliveCount = maxKeepAliveCount || minimumMaxKeepAliveCount;
    maxKeepAliveCount = Math.max(maxKeepAliveCount, minimumMaxKeepAliveCount);
    maxKeepAliveCount = Math.min(maxKeepAliveCount, maximumMaxKeepAliveCount);
    return maxKeepAliveCount;
}

function _adjust_lifeTimeCount(lifeTimeCount: number, maxKeepAliveCount: number, publishingInterval: number): number {
    lifeTimeCount = lifeTimeCount || 1;

    // let's make sure that lifeTimeCount is at least three time maxKeepAliveCount
    // Note : the specs say ( part 3  - CreateSubscriptionParameter )
    //        "The lifetime count shall be a minimum of three times the keep keep-alive count."
    lifeTimeCount = Math.max(lifeTimeCount, maxKeepAliveCount * 3);

    const minTicks = Math.ceil(Subscription.minimumLifetimeDuration / publishingInterval);
    const maxTicks = Math.floor(Subscription.maximumLifetimeDuration / publishingInterval);

    lifeTimeCount = Math.max(minTicks, lifeTimeCount);
    lifeTimeCount = Math.min(maxTicks, lifeTimeCount);
    return lifeTimeCount;
}

function _adjust_publishingEnable(publishingEnabled?: boolean | null): boolean {
    return publishingEnabled === null || publishingEnabled === undefined ? true : !!publishingEnabled;
}

function _adjust_maxNotificationsPerPublish(maxNotificationsPerPublish?: number): number {
    assert(Subscription.maxNotificationPerPublishHighLimit > 0, "Subscription.maxNotificationPerPublishHighLimit must be positive");

    maxNotificationsPerPublish = maxNotificationsPerPublish || 0;
    assert(typeof maxNotificationsPerPublish === "number");

    // must be strictly positive
    maxNotificationsPerPublish = maxNotificationsPerPublish >= 0 ? maxNotificationsPerPublish : 0;

    if (maxNotificationsPerPublish === 0) {
        // if zero then => use our HighLimit
        maxNotificationsPerPublish = Subscription.maxNotificationPerPublishHighLimit;
    } else {
        // if not zero then should be capped by maxNotificationPerPublishHighLimit
        maxNotificationsPerPublish = Math.min(Subscription.maxNotificationPerPublishHighLimit, maxNotificationsPerPublish);
    }

    assert(maxNotificationsPerPublish !== 0 && maxNotificationsPerPublish <= Subscription.maxNotificationPerPublishHighLimit);
    return maxNotificationsPerPublish;
}

function w(s: string | number, length: number): string {
    return ("000" + s).padStart(length);
}

function t(d: Date): string {
    return w(d.getHours(), 2) + ":" + w(d.getMinutes(), 2) + ":" + w(d.getSeconds(), 2) + ":" + w(d.getMilliseconds(), 3);
}

function _getSequenceNumbers(arr: NotificationMessage[]): number[] {
    return arr.map((notificationMessage) => notificationMessage.sequenceNumber);
}

function analyseEventFilterResult(node: BaseNode, eventFilter: EventFilter): EventFilterResult {
    /* istanbul ignore next */
    if (!(eventFilter instanceof EventFilter)) {
        throw new Error("Internal Error");
    }

    const selectClauseResults = checkSelectClauses(node as UAObjectType, eventFilter.selectClauses || []);

    const whereClauseResult = new ContentFilterResult();

    return new EventFilterResult({
        selectClauseDiagnosticInfos: [],
        selectClauseResults,
        whereClauseResult
    });
}

function analyseDataChangeFilterResult(node: BaseNode, dataChangeFilter: DataChangeFilter): null {
    assert(dataChangeFilter instanceof DataChangeFilter);
    // the opcua specification doesn't provide dataChangeFilterResult
    return null;
}

function analyseAggregateFilterResult(node: BaseNode, aggregateFilter: AggregateFilter): AggregateFilterResult {
    assert(aggregateFilter instanceof AggregateFilter);
    return new AggregateFilterResult({});
}

function _process_filter(node: BaseNode, filter: any): EventFilterResult | AggregateFilterResult | null {
    if (!filter) {
        return null;
    }

    if (filter instanceof EventFilter) {
        return analyseEventFilterResult(node, filter);
    } else if (filter instanceof DataChangeFilter) {
        return analyseDataChangeFilterResult(node, filter);
    } else if (filter instanceof AggregateFilter) {
        return analyseAggregateFilterResult(node, filter);
    }
    // istanbul ignore next
    throw new Error("invalid filter");
}

/**
 * @private
 */
function createSubscriptionDiagnostics(subscription: Subscription): SubscriptionDiagnosticsDataTypePriv {
    assert(subscription instanceof Subscription);

    const subscriptionDiagnostics = new SubscriptionDiagnosticsDataType({});

    const subscription_subscriptionDiagnostics = subscriptionDiagnostics as SubscriptionDiagnosticsDataTypePriv as any;
    subscription_subscriptionDiagnostics.$subscription = subscription;
    // "sessionId"
    subscription_subscriptionDiagnostics.__defineGetter__(
        "sessionId",
        function (this: SubscriptionDiagnosticsDataTypePriv): NodeId {
            if (!this.$subscription) {
                return NodeId.nullNodeId;
            }
            return this.$subscription.getSessionId();
        }
    );
    subscription_subscriptionDiagnostics.__defineGetter__(
        "subscriptionId",
        function (this: SubscriptionDiagnosticsDataTypePriv): number {
            if (!this.$subscription) {
                return 0;
            }
            return this.$subscription.id;
        }
    );
    subscription_subscriptionDiagnostics.__defineGetter__("priority", function (this: SubscriptionDiagnosticsDataTypePriv): number {
        if (!this.$subscription) {
            return 0;
        }
        return this.$subscription.priority;
    });
    subscription_subscriptionDiagnostics.__defineGetter__(
        "publishingInterval",
        function (this: SubscriptionDiagnosticsDataTypePriv): number {
            if (!this.$subscription) {
                return 0;
            }
            return this.$subscription.publishingInterval;
        }
    );
    subscription_subscriptionDiagnostics.__defineGetter__("maxLifetimeCount", function (this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.lifeTimeCount;
    });
    subscription_subscriptionDiagnostics.__defineGetter__(
        "maxKeepAliveCount",
        function (this: SubscriptionDiagnosticsDataTypePriv): number {
            if (!this.$subscription) {
                return 0;
            }
            return this.$subscription.maxKeepAliveCount;
        }
    );
    subscription_subscriptionDiagnostics.__defineGetter__(
        "maxNotificationsPerPublish",
        function (this: SubscriptionDiagnosticsDataTypePriv): number {
            if (!this.$subscription) {
                return 0;
            }
            return this.$subscription.maxNotificationsPerPublish;
        }
    );
    subscription_subscriptionDiagnostics.__defineGetter__(
        "publishingEnabled",
        function (this: SubscriptionDiagnosticsDataTypePriv): boolean {
            if (!this.$subscription) {
                return false;
            }
            return this.$subscription.publishingEnabled;
        }
    );
    subscription_subscriptionDiagnostics.__defineGetter__(
        "monitoredItemCount",
        function (this: SubscriptionDiagnosticsDataTypePriv): number {
            if (!this.$subscription) {
                return 0;
            }
            return this.$subscription.monitoredItemCount;
        }
    );
    subscription_subscriptionDiagnostics.__defineGetter__(
        "nextSequenceNumber",
        function (this: SubscriptionDiagnosticsDataTypePriv): number {
            if (!this.$subscription) {
                return 0;
            }
            return this.$subscription._get_future_sequence_number();
        }
    );
    subscription_subscriptionDiagnostics.__defineGetter__(
        "disabledMonitoredItemCount",
        function (this: SubscriptionDiagnosticsDataTypePriv): number {
            if (!this.$subscription) {
                return 0;
            }
            return this.$subscription.disabledMonitoredItemCount;
        }
    );

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
   "eventQueueOverFlowCount"
   */
    subscription_subscriptionDiagnostics.__defineGetter__(
        "currentKeepAliveCount",
        function (this: SubscriptionDiagnosticsDataTypePriv): number {
            if (!this.$subscription) {
                return 0;
            }
            return this.$subscription.currentKeepAliveCount;
        }
    );
    subscription_subscriptionDiagnostics.__defineGetter__(
        "currentLifetimeCount",
        function (this: SubscriptionDiagnosticsDataTypePriv): number {
            if (!this.$subscription) {
                return 0;
            }
            return this.$subscription.currentLifetimeCount;
        }
    );
    // add object in Variable SubscriptionDiagnosticArray (i=2290) ( Array of SubscriptionDiagnostics)
    // add properties in Variable to reflect
    return subscriptionDiagnostics as SubscriptionDiagnosticsDataTypePriv;
}

interface IGlobalMonitoredItemCounter {
    totalMonitoredItemCount: number;
}

export interface SubscriptionOptions {
    sessionId?: NodeId;
    /**
     * (default:1000) the publishing interval.
     */
    publishingInterval?: number;
    /**
     * (default:10) the max Life Time Count
     */
    maxKeepAliveCount?: number;

    lifeTimeCount?: number;
    /**
     * (default:true)
     */
    publishingEnabled?: boolean;
    /**
     * (default:0)
     */
    maxNotificationsPerPublish?: number;
    /**
     * subscription priority Byte:(0-255)
     */
    priority?: number;

    publishEngine?: IServerSidePublishEngine;
    /**
     *  a unique identifier
     */
    id?: number;

    serverCapabilities: ServerCapabilitiesPartial;
    globalCounter: IGlobalMonitoredItemCounter;
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

export type Notification = DataChangeNotification | EventNotificationList | StatusChangeNotification;
export type Counter = number;

export interface ModifySubscriptionParameters {
    /**
     *     requestedPublishingInterval =0 means fastest possible
     */
    requestedPublishingInterval?: Duration;
    /*
     * requestedLifetimeCount=0 means no change
     */
    requestedLifetimeCount?: Counter;
    /**
     * requestedMaxKeepAliveCount  ===0 means no change
     */
    requestedMaxKeepAliveCount?: Counter;
    maxNotificationsPerPublish?: Counter;
    priority?: Byte;
}

export interface GetMonitoredItemsResult {
    /**
     * array of serverHandles for all MonitoredItems of the subscription
     * identified by subscriptionId.
     */
    serverHandles: Uint32Array;
    /**
     *  array of clientHandles for all MonitoredItems of the subscription
     *  identified by subscriptionId.
     */
    clientHandles: Uint32Array;
    statusCode: StatusCode;
}

export interface InternalNotification {
    monitoredItemId?: number;
    notification: QueueItem | StatusChangeNotification;
    publishTime: Date;
    start_tick: number;
}

export interface InternalCreateMonitoredItemResult {
    monitoredItem?: MonitoredItem;
    monitoredItemCreateRequest: MonitoredItemCreateRequest;
    createResult: MonitoredItemCreateResult;
}

export interface MonitoredItemBase {
    node: any | null;
}
export type CreateMonitoredItemHook = (subscription: Subscription, monitoredItem: MonitoredItemBase) => Promise<StatusCode>;
export type DeleteMonitoredItemHook = (subscription: Subscription, monitoredItem: MonitoredItemBase) => Promise<StatusCode>;

export interface ServerCapabilitiesPartial {
    maxMonitoredItems: UInt32;
    maxMonitoredItemsPerSubscription: UInt32;
}

/**
 * The Subscription class used in the OPCUA server side.
 */
export class Subscription extends EventEmitter {
    public static minimumPublishingInterval = 50; // fastest possible
    public static defaultPublishingInterval = 1000; // one second
    public static maximumPublishingInterval: number = 1000 * 60; // one minute
    public static maxNotificationPerPublishHighLimit = 1000;
    public static minimumLifetimeDuration = 5 * 1000; //  // we want 2 seconds minimum lifetime for any subscription
    public static maximumLifetimeDuration = 60 * 60 * 1000; // 1 hour

    /**
     * maximum number of monitored item in a subscription to be used
     * when serverCapacity.maxMonitoredItems and serverCapacity.maxMonitoredItemsPerSubscription are not set.
     */
    public static defaultMaxMonitoredItemCount = 20000;

    /**
     * @deprecated use serverCapacity.maxMonitoredItems and serverCapacity.maxMonitoredItemsPerSubscription instead
     */
    protected static get maxMonitoredItemCount() {
        return Subscription.defaultMaxMonitoredItemCount;
    }

    public static registry = new ObjectRegistry();

    public publishEngine?: IServerSidePublishEngine;
    public id: number;
    public priority: number;
    /**
     * the Subscription publishing interval
     * @default 1000
     */
    public publishingInterval: number;
    /**
     * The keep alive count defines how many times the publish interval need to
     * expires without having notifications available before the server send an
     * empty message.
     * OPCUA Spec says: a value of 0 is invalid.
     * @default 10
     *
     */
    public maxKeepAliveCount: number;
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
    public lifeTimeCount: number;
    /**
     * The maximum number of notifications that the Client wishes to receive in a
     * single Publish response. A value of zero indicates that there is no limit.
     * The number of notifications per Publish is the sum of monitoredItems in the
     * DataChangeNotification and events in the EventNotificationList.
     *
     * @property maxNotificationsPerPublish
     * @default 0
     */
    public maxNotificationsPerPublish: number;
    public publishingEnabled: boolean;
    public subscriptionDiagnostics: SubscriptionDiagnosticsDataTypePriv;
    public publishIntervalCount: number;
    /**
     *  number of monitored Item
     */
    public monitoredItemIdCounter: number;

    private _state: SubscriptionState = -1 as SubscriptionState;
    public set state(value: SubscriptionState) {
        if (this._state !== value) {
            this._state = value;
            this.emit("stateChanged", value);
        }
    }
    public get state(): SubscriptionState {
        return this._state;
    }

    public messageSent: boolean;
    public $session?: ServerSession;

    public get sessionId(): NodeId {
        return this.$session ? this.$session.nodeId : NodeId.nullNodeId;
    }

    public get currentLifetimeCount(): number {
        return this._life_time_counter;
    }
    public get currentKeepAliveCount(): number {
        return this._keep_alive_counter;
    }

    private _life_time_counter: number;
    private _keep_alive_counter = 0;
    private _pending_notifications: Queue<InternalNotification>;
    private _sent_notification_messages: NotificationMessage[];
    private readonly _sequence_number_generator: SequenceNumberGenerator;
    private readonly monitoredItems: { [key: number]: MonitoredItem };
    private timerId: any;
    private _hasUncollectedMonitoredItemNotifications = false;

    private globalCounter: IGlobalMonitoredItemCounter;
    private serverCapabilities: ServerCapabilitiesPartial;

    constructor(options: SubscriptionOptions) {
        super();

        options = options || {};

        Subscription.registry.register(this);

        assert(this.sessionId instanceof NodeId, "expecting a sessionId NodeId");

        this.publishEngine = options.publishEngine!;

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
        this._pending_notifications = new Queue<InternalNotification>();

        this._sent_notification_messages = [];

        this._sequence_number_generator = new SequenceNumberGenerator();

        // initial state of the subscription
        this.state = SubscriptionState.CREATING;

        this.publishIntervalCount = 0;

        this.monitoredItems = {}; // monitored item map

        this.monitoredItemIdCounter = 0;

        this.publishingEnabled = _adjust_publishingEnable(options.publishingEnabled);

        this.subscriptionDiagnostics = createSubscriptionDiagnostics(this);

        // A boolean value that is set to TRUE to mean that either a NotificationMessage or a keep-alive
        // Message has been sent on the Subscription. It is a flag that is used to ensure that either a
        // NotificationMessage or a keep-alive Message is sent out the first time the publishing
        // timer expires.
        this.messageSent = false;

        this.timerId = null;
        this._start_timer();

        debugLog(chalk.green(`creating subscription ${this.id}`));

        this.serverCapabilities = options.serverCapabilities;
        this.serverCapabilities.maxMonitoredItems =
            this.serverCapabilities.maxMonitoredItems || Subscription.defaultMaxMonitoredItemCount;
        this.serverCapabilities.maxMonitoredItemsPerSubscription =
            this.serverCapabilities.maxMonitoredItemsPerSubscription || Subscription.defaultMaxMonitoredItemCount;
        this.globalCounter = options.globalCounter;
    }

    public getSessionId(): NodeId {
        return this.sessionId;
    }

    public toString(): string {
        let str = "Subscription:\n";
        str += "  subscriptionId          " + this.id + "\n";
        str += "  sessionId          " + this.getSessionId().toString() + "\n";

        str += "  publishingEnabled  " + this.publishingEnabled + "\n";
        str += "  maxKeepAliveCount  " + this.maxKeepAliveCount + "\n";
        str += "  publishingInterval " + this.publishingInterval + "\n";
        str += "  lifeTimeCount      " + this.lifeTimeCount + "\n";
        str += "  maxKeepAliveCount  " + this.maxKeepAliveCount + "\n";
        return str;
    }

    /**
     * modify subscription parameters
     * @param param
     */
    public modify(param: ModifySubscriptionParameters): void {
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
        this._start_timer();
    }

    /**
     * set publishing mode
     * @param publishingEnabled
     */
    public setPublishingMode(publishingEnabled: boolean): StatusCode {
        this.publishingEnabled = !!publishingEnabled;
        // update diagnostics
        if (this.publishingEnabled) {
            this.subscriptionDiagnostics.enableCount += 1;
        } else {
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
    public get keepAliveCounterHasExpired(): boolean {
        return this._keep_alive_counter >= this.maxKeepAliveCount || this.state === SubscriptionState.LATE;
    }

    /**
     * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
     * the CreateSubscription Service( 5.13.2).
     * @private
     */
    public resetLifeTimeCounter(): void {
        this._life_time_counter = 0;
    }

    /**
     * @private
     */
    public increaseLifeTimeCounter(): void {
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
    public get lifeTimeHasExpired(): boolean {
        assert(this.lifeTimeCount > 0);
        return this._life_time_counter >= this.lifeTimeCount;
    }

    /**
     * number of milliseconds before this subscription times out (lifeTimeHasExpired === true);
     */
    public get timeToExpiration(): number {
        return (this.lifeTimeCount - this._life_time_counter) * this.publishingInterval;
    }

    public get timeToKeepAlive(): number {
        return (this.maxKeepAliveCount - this._keep_alive_counter) * this.publishingInterval;
    }

    /**
     * Terminates the subscription.
     * Calling this method will also remove any monitored items.
     *
     */
    public terminate(): void {
        assert(arguments.length === 0);
        debugLog("Subscription#terminate status", SubscriptionState[this.state]);

        if (this.state === SubscriptionState.CLOSED) {
            // todo verify if asserting is required here
            return;
        }

        // stop timer
        this._stop_timer();

        debugLog("terminating Subscription  ", this.id, " with ", this.monitoredItemCount, " monitored items");

        // dispose all monitoredItem
        const keys = Object.keys(this.monitoredItems);

        for (const key of keys) {
            const status = this.removeMonitoredItem(parseInt(key, 10));
            assert(status === StatusCodes.Good);
        }
        assert(this.monitoredItemCount === 0);

        if (this.$session) {
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

    public setTriggering(
        triggeringItemId: number,
        linksToAdd: number[] | null,
        linksToRemove: number[] | null
    ): { statusCode: StatusCode; addResults: StatusCode[]; removeResults: StatusCode[] } {
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
            const removeResults1: StatusCode[] = monitoredItemsToRemove.map((m) =>
                m ? StatusCodes.Good : StatusCodes.BadMonitoredItemIdInvalid
            );
            const addResults1: StatusCode[] = monitoredItemsToAdd.map((m) =>
                m ? StatusCodes.Good : StatusCodes.BadMonitoredItemIdInvalid
            );
            return {
                statusCode: StatusCodes.BadMonitoredItemIdInvalid,

                addResults: addResults1,
                removeResults: removeResults1
            };
        }
        //
        // note: it seems that CTT imposed that we do remove before add
        const removeResults = monitoredItemsToRemove.map((m) =>
            !m ? StatusCodes.BadMonitoredItemIdInvalid : triggeringItem.removeLinkItem(m.monitoredItemId)
        );
        const addResults = monitoredItemsToAdd.map((m) =>
            !m ? StatusCodes.BadMonitoredItemIdInvalid : triggeringItem.addLinkItem(m.monitoredItemId)
        );

        const statusCode: StatusCode = StatusCodes.Good;

        // do binding

        return {
            statusCode,

            addResults,
            removeResults
        };
    }
    public dispose(): void {
        if (doDebug) {
            debugLog("Subscription#dispose", this.id, this.monitoredItemCount);
        }

        assert(this.monitoredItemCount === 0, "MonitoredItems haven't been  deleted first !!!");
        assert(this.timerId === null, "Subscription timer haven't been terminated");

        if (this.subscriptionDiagnostics) {
            (this.subscriptionDiagnostics as SubscriptionDiagnosticsDataTypePriv).$subscription = null as any as Subscription;
        }

        this.publishEngine = undefined;
        this._pending_notifications.clear();
        this._sent_notification_messages = [];

        this.$session = undefined;
        this.removeAllListeners();

        Subscription.registry.unregister(this);
    }

    public get aborted(): boolean {
        const session = this.$session;
        if (!session) {
            return true;
        }
        return session.aborted;
    }

    /**
     * number of pending notifications
     */
    public get pendingNotificationsCount(): number {
        return this._pending_notifications ? this._pending_notifications.size : 0;
    }

    /**
     * is 'true' if there are pending notifications for this subscription. (i.e moreNotifications)
     */
    public get hasPendingNotifications(): boolean {
        return this.pendingNotificationsCount > 0;
    }

    /**
     * number of sent notifications
     */
    public get sentNotificationMessageCount(): number {
        return this._sent_notification_messages.length;
    }

    /**
     * @internal
     */
    public _flushSentNotifications(): NotificationMessage[] {
        const tmp = this._sent_notification_messages;
        this._sent_notification_messages = [];
        return tmp;
    }
    /**
     * number of monitored items handled by this subscription
     */
    public get monitoredItemCount(): number {
        return Object.keys(this.monitoredItems).length;
    }

    /**
     * number of disabled monitored items.
     */
    public get disabledMonitoredItemCount(): number {
        return Object.values(this.monitoredItems).reduce((cumul: any, monitoredItem: MonitoredItem) => {
            return cumul + (monitoredItem.monitoringMode === MonitoringMode.Disabled ? 1 : 0);
        }, 0);
    }

    /**
     * The number of unacknowledged messages saved in the republish queue.
     */
    public get unacknowledgedMessageCount(): number {
        return this.subscriptionDiagnostics.unacknowledgedMessageCount;
    }

    /**
     * adjust monitored item sampling interval
     *  - an samplingInterval ===0 means that we use a event-base model ( no sampling)
     *  - otherwise the sampling is adjusted
     * @private
     */
    public adjustSamplingInterval(samplingInterval: number, node: BaseNode): number {
        if (samplingInterval < 0) {
            // - The value -1 indicates that the default sampling interval defined by the publishing
            //   interval of the Subscription is requested.
            // - Any negative number is interpreted as -1.
            samplingInterval = this.publishingInterval;
        } else if (samplingInterval === 0) {
            // OPCUA 1.0.3 Part 4 - 5.12.1.2
            // The value 0 indicates that the Server should use the fastest practical rate.

            // The fastest supported sampling interval may be equal to 0, which indicates
            // that the data item is exception-based rather than being sampled at some period.
            // An exception-based model means that the underlying system does not require
            // sampling and reports data changes.

            const dataValueSamplingInterval = node.readAttribute(
                SessionContext.defaultContext,
                AttributeIds.MinimumSamplingInterval
            );

            // TODO if attributeId === AttributeIds.Value : sampling interval required here
            if (dataValueSamplingInterval.statusCode === StatusCodes.Good) {
                // node provides a Minimum sampling interval ...
                samplingInterval = dataValueSamplingInterval.value.value;
                assert(samplingInterval >= 0 && samplingInterval <= MonitoredItem.maximumSamplingInterval);

                // note : at this stage, a samplingInterval===0 means that the data item is really exception-based
            }
        } else if (samplingInterval < MonitoredItem.minimumSamplingInterval) {
            samplingInterval = MonitoredItem.minimumSamplingInterval;
        } else if (samplingInterval > MonitoredItem.maximumSamplingInterval) {
            // If the requested samplingInterval is higher than the
            // maximum sampling interval supported by the Server, the maximum sampling
            // interval is returned.
            samplingInterval = MonitoredItem.maximumSamplingInterval;
        }

        const node_minimumSamplingInterval =
            node && (node as any).minimumSamplingInterval ? (node as any).minimumSamplingInterval : 0;

        samplingInterval = Math.max(samplingInterval, node_minimumSamplingInterval);

        return samplingInterval;
    }

    /**
     * create a monitored item
     * @param addressSpace - address space
     * @param timestampsToReturn  - the timestamp to return
     * @param monitoredItemCreateRequest - the parameters describing the monitored Item to create
     */
    public preCreateMonitoredItem(
        addressSpace: AddressSpace,
        timestampsToReturn: TimestampsToReturn,
        monitoredItemCreateRequest: MonitoredItemCreateRequest
    ): InternalCreateMonitoredItemResult {
        assert(monitoredItemCreateRequest instanceof MonitoredItemCreateRequest);

        function handle_error(statusCode: StatusCode): InternalCreateMonitoredItemResult {
            return {
                createResult: new MonitoredItemCreateResult({ statusCode }),
                monitoredItemCreateRequest
            };
        }

        const itemToMonitor = monitoredItemCreateRequest.itemToMonitor;

        const node = addressSpace.findNode(itemToMonitor.nodeId);
        if (!node) {
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

        // check that item can be read by current user session

        // filter
        const requestedParameters = monitoredItemCreateRequest.requestedParameters;
        const filter = requestedParameters.filter;
        const statusCodeFilter = validateFilter(filter, itemToMonitor, node);
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

        const createResult = this._createMonitoredItemStep2(timestampsToReturn, monitoredItemCreateRequest, node);

        assert(createResult.statusCode === StatusCodes.Good);

        const monitoredItem = this.getMonitoredItem(createResult.monitoredItemId);
        // istanbul ignore next
        if (!monitoredItem) {
            throw new Error("internal error");
        }

        // TODO: fix old way to set node. !!!!
        monitoredItem.setNode(node);

        this.emit("monitoredItem", monitoredItem, itemToMonitor);

        return { monitoredItem, monitoredItemCreateRequest, createResult };
    }

    public async applyOnMonitoredItem(functor: (monitoredItem: MonitoredItem) => Promise<void>): Promise<void> {
        for (const m of Object.values(this.monitoredItems)) {
            await functor(m);
        }
    }

    public postCreateMonitoredItem(
        monitoredItem: MonitoredItem,
        monitoredItemCreateRequest: MonitoredItemCreateRequest,
        createResult: MonitoredItemCreateResult
    ): void {
        this._createMonitoredItemStep3(monitoredItem, monitoredItemCreateRequest);
    }

    public createMonitoredItem(
        addressSpace: AddressSpace,
        timestampsToReturn: TimestampsToReturn,
        monitoredItemCreateRequest: MonitoredItemCreateRequest
    ): MonitoredItemCreateResult {
        const { monitoredItem, createResult } = this.preCreateMonitoredItem(
            addressSpace,
            timestampsToReturn,
            monitoredItemCreateRequest
        );
        this.postCreateMonitoredItem(monitoredItem!, monitoredItemCreateRequest, createResult);
        return createResult;
    }
    /**
     * get a monitoredItem by Id.
     * @param monitoredItemId : the id of the monitored item to get.
     * @return the monitored item matching monitoredItemId
     */
    public getMonitoredItem(monitoredItemId: number): MonitoredItem | null {
        return this.monitoredItems[monitoredItemId] || null;
    }

    /**
     * remove a monitored Item from the subscription.
     * @param monitoredItemId : the id of the monitored item to get.
     */
    public removeMonitoredItem(monitoredItemId: number): StatusCode {
        debugLog("Removing monitoredIem ", monitoredItemId);
        if (!Object.prototype.hasOwnProperty.call(this.monitoredItems, monitoredItemId.toString())) {
            return StatusCodes.BadMonitoredItemIdInvalid;
        }

        const monitoredItem = this.monitoredItems[monitoredItemId];

        monitoredItem.terminate();

        monitoredItem.dispose();

        /**
         *
         * notify that a monitored item has been removed from the subscription
         * @param monitoredItem {MonitoredItem}
         */
        this.emit("removeMonitoredItem", monitoredItem);

        delete this.monitoredItems[monitoredItemId];
        this.globalCounter.totalMonitoredItemCount -= 1;

        this._removePendingNotificationsFor(monitoredItemId);
        // flush pending notifications
        // assert(this._pending_notifications.size === 0);
        return StatusCodes.Good;
    }

    /**
     * rue if monitored Item have uncollected Notifications
     */
    public get hasUncollectedMonitoredItemNotifications(): boolean {
        if (this._hasUncollectedMonitoredItemNotifications) {
            return true;
        }
        const keys = Object.keys(this.monitoredItems);
        const n = keys.length;
        for (let i = 0; i < n; i++) {
            const key = parseInt(keys[i], 10);
            const monitoredItem = this.monitoredItems[key];
            if (monitoredItem.hasMonitoredItemNotifications) {
                this._hasUncollectedMonitoredItemNotifications = true;
                return true;
            }
        }
        return false;
    }

    public get subscriptionId(): number {
        return this.id;
    }

    public getMessageForSequenceNumber(sequenceNumber: number): NotificationMessage | null {
        const notification_message = this._sent_notification_messages.find((e) => e.sequenceNumber === sequenceNumber);
        return notification_message || null;
    }

    /**
     * returns true if the notification has expired
     * @param notification
     */
    public notificationHasExpired(notification: { start_tick: number }): boolean {
        assert(Object.prototype.hasOwnProperty.call(notification, "start_tick"));
        assert(isFinite(notification.start_tick + this.maxKeepAliveCount));
        return notification.start_tick + this.maxKeepAliveCount < this.publishIntervalCount;
    }

    /**
     *  returns in an array the sequence numbers of the notifications that have been sent
     *  and that haven't been acknowledged yet.
     */
    public getAvailableSequenceNumbers(): number[] {
        const availableSequenceNumbers = _getSequenceNumbers(this._sent_notification_messages);
        return availableSequenceNumbers;
    }

    /**
     * acknowledges a notification identified by its sequence number
     */
    public acknowledgeNotification(sequenceNumber: number): StatusCode {
        debugLog("acknowledgeNotification ", sequenceNumber);
        let foundIndex = -1;
        this._sent_notification_messages.forEach((e: NotificationMessage, index: number) => {
            if (e.sequenceNumber === sequenceNumber) {
                foundIndex = index;
            }
        });

        if (foundIndex === -1) {
            if (doDebug) {
                debugLog(chalk.red("acknowledging sequence FAILED !!! "), chalk.cyan(sequenceNumber.toString()));
            }
            return StatusCodes.BadSequenceNumberUnknown;
        } else {
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
    public getMonitoredItems(): GetMonitoredItemsResult {
        const monitoredItems = Object.keys(this.monitoredItems);
        const monitoredItemCount = monitoredItems.length;
        const result: GetMonitoredItemsResult = {
            clientHandles: new Uint32Array(monitoredItemCount),
            serverHandles: new Uint32Array(monitoredItemCount),
            statusCode: StatusCodes.Good
        };
        for (let index = 0; index < monitoredItemCount; index++) {
            const monitoredItemId = monitoredItems[index];
            const serverHandle = parseInt(monitoredItemId, 10);
            const monitoredItem = this.getMonitoredItem(serverHandle)!;
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
    public async resendInitialValues(): Promise<void> {
        const promises: Promise<void>[] = [];
        for (const monitoredItem of Object.values(this.monitoredItems)) {
            assert(monitoredItem.clientHandle !== 4294967295);
            promises.push(monitoredItem.resendInitialValues());
        }
        await Promise.all(promises);
        this._harvestMonitoredItems();
    }

    /**
     * @private
     */
    public notifyTransfer(): void {
        // OPCUA UA Spec 1.0.3 : part 3 - page 82 - 5.13.7 TransferSubscriptions:
        // If the Server transfers the Subscription to the new Session, the Server shall issue
        // a StatusChangeNotification notificationMessage with the status code
        // Good_SubscriptionTransferred to the old Session.
        debugLog(chalk.red(" Subscription => Notifying Transfer                                  "));

        const notificationData = new StatusChangeNotification({
            status: StatusCodes.GoodSubscriptionTransferred
        });

        if (this.publishEngine!.pendingPublishRequestCount) {
            // the GoodSubscriptionTransferred can be processed immediately
            this._addNotificationMessage(notificationData);
            debugLog(chalk.red("pendingPublishRequestCount"), this.publishEngine?.pendingPublishRequestCount);
            this._publish_pending_notifications();
        } else {
            debugLog(chalk.red("Cannot  send GoodSubscriptionTransferred => lets create a TransferredSubscription "));
            const ts = new TransferredSubscription({
                generator: this._sequence_number_generator,
                id: this.id,
                publishEngine: this.publishEngine
            });

            ts._pending_notification = notificationData;
            (this.publishEngine as any)._closed_subscriptions.push(ts);
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
    public resetLifeTimeAndKeepAliveCounters(): void {
        this.resetLifeTimeCounter();
        this.resetKeepAliveCounter();
    }

    private _updateCounters(notificationMessage: NotificationMessage) {
        for (const notificationData of notificationMessage.notificationData || []) {
            // update diagnostics
            if (notificationData instanceof DataChangeNotification) {
                const nbNotifs = notificationData.monitoredItems!.length;
                this.subscriptionDiagnostics.dataChangeNotificationsCount += nbNotifs;
                this.subscriptionDiagnostics.notificationsCount += nbNotifs;
            } else if (notificationData instanceof EventNotificationList) {
                const nbNotifs = notificationData.events!.length;
                this.subscriptionDiagnostics.eventNotificationsCount += nbNotifs;
                this.subscriptionDiagnostics.notificationsCount += nbNotifs;
            } else {
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
     * @precondition
     *     - pendingPublishRequestCount > 0
     */
    public _publish_pending_notifications(): void {
        const publishEngine = this.publishEngine!;
        const subscriptionId = this.id;
        // preconditions
        assert(publishEngine!.pendingPublishRequestCount > 0);
        assert(this.hasPendingNotifications);

        const notificationMessage = this._popNotificationToSend();
        if (notificationMessage.notificationData!.length === 0) {
            return; // nothing to do
        }
        const moreNotifications = this.hasPendingNotifications;

        this.emit("notification", notificationMessage);
        // Update counters ....
        this._updateCounters(notificationMessage);

        assert(Object.prototype.hasOwnProperty.call(notificationMessage, "sequenceNumber"));
        assert(Object.prototype.hasOwnProperty.call(notificationMessage, "notificationData"));
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
        assert(
            !response.notificationMessage ||
                availableSequenceNumbers[availableSequenceNumbers.length - 1] === response.notificationMessage.sequenceNumber
        );
        response.availableSequenceNumbers = availableSequenceNumbers;

        publishEngine._send_response(this, response);

        this.messageSent = true;

        this.subscriptionDiagnostics.unacknowledgedMessageCount++;

        this.resetLifeTimeAndKeepAliveCounters();

        if (doDebug) {
            debugLog(
                "Subscription sending a notificationMessage subscriptionId=",
                subscriptionId,
                "sequenceNumber = ",
                notificationMessage.sequenceNumber.toString(),
                notificationMessage.notificationData?.map((x) => x?.constructor.name).join(" ")
            );
            // debugLog(notificationMessage.toString());
        }

        if (this.state !== SubscriptionState.CLOSED) {
            assert(notificationMessage.notificationData!.length > 0, "We are not expecting a keep-alive message here");
            this.state = SubscriptionState.NORMAL;
            debugLog("subscription " + this.id + chalk.bgYellow(" set to NORMAL"));
        }
    }

    public process_subscription(): void {
        assert(this.publishEngine!.pendingPublishRequestCount > 0);

        if (!this.publishingEnabled) {
            // no publish to do, except keep alive
            debugLog("    -> no publish to do, except keep alive");
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

            if (this.state === SubscriptionState.NORMAL && this.hasPendingNotifications) {
                // istanbul ignore next
                if (doDebug) {
                    debugLog("    -> pendingPublishRequestCount > 0 " + "&& normal state => re-trigger tick event immediately ");
                }

                // let process an new publish request
                setImmediate(this._tick.bind(this));
            }
        } else {
            this._process_keepAlive();
        }
    }

    public _get_future_sequence_number(): number {
        return this._sequence_number_generator ? this._sequence_number_generator.future() : 0;
    }

    private _process_keepAlive() {
        this.increaseKeepAliveCounter();

        if (this.keepAliveCounterHasExpired) {
            debugLog(`     ->  _process_keepAlive => keepAliveCounterHasExpired`);
            if (this._sendKeepAliveResponse()) {
                this.resetLifeTimeAndKeepAliveCounters();
            } else {
                debugLog(
                    "     -> subscription.state === LATE , " +
                        "because keepAlive Response cannot be send due to lack of PublishRequest"
                );
                if (this.messageSent || this.keepAliveCounterHasExpired) {
                    this.state = SubscriptionState.LATE;
                }
            }
        }
    }

    private _stop_timer() {
        if (this.timerId) {
            debugLog(chalk.bgWhite.blue("Subscription#_stop_timer subscriptionId="), this.id);
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    private _start_timer() {
        debugLog(
            chalk.bgWhite.blue("Subscription#_start_timer  subscriptionId="),
            this.id,
            " publishingInterval = ",
            this.publishingInterval
        );

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
        this._keep_alive_counter = 0; // this.maxKeepAliveCount;
        assert(this.messageSent === false);
        assert(this.state === SubscriptionState.CREATING);

        assert(this.publishingInterval >= Subscription.minimumPublishingInterval);
        this.timerId = setInterval(this._tick.bind(this), this.publishingInterval);
    }

    // counter
    private _get_next_sequence_number(): number {
        return this._sequence_number_generator ? this._sequence_number_generator.next() : 0;
    }

    /**
     * @private
     */
    private _tick() {
        // istanbul ignore next
        if (doDebug) {
            debugLog(`Subscription#_tick id ${this.id} aborted=${this.aborted} state=${SubscriptionState[this.state]}`);
        }
        if (this.state === SubscriptionState.CLOSED) {
            warningLog(`Warning: Subscription#_tick id ${this.id}  called while subscription is CLOSED`);
            return;
        }

        this.discardOldSentNotifications();

        // istanbul ignore next
        if (doDebug) {
            debugLog(
                t(new Date()) + "  " + this._life_time_counter + "/" + this.lifeTimeCount + chalk.cyan("   Subscription#_tick"),
                "  processing subscriptionId=",
                this.id,
                "hasUncollectedMonitoredItemNotifications = ",
                this.hasUncollectedMonitoredItemNotifications,
                " publishingIntervalCount =",
                this.publishIntervalCount
            );
        }

        // give a chance to the publish engine to cancel timed out publish requests
        this.publishEngine!._on_tick();

        this.publishIntervalCount += 1;

        if (this.state === SubscriptionState.LATE) {
            this.increaseLifeTimeCounter();
        }

        if (this.lifeTimeHasExpired) {
            /* istanbul ignore next */
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

        const publishEngine = this.publishEngine!;

        // istanbul ignore next
        doDebug && debugLog("Subscription#_tick  self._pending_notifications= ", this._pending_notifications.size);

        if (
            publishEngine.pendingPublishRequestCount === 0 &&
            (this.hasPendingNotifications || this.hasUncollectedMonitoredItemNotifications)
        ) {
            // istanbul ignore next
            doDebug &&
                debugLog(
                    "subscription set to LATE  hasPendingNotifications = ",
                    this.hasPendingNotifications,
                    " hasUncollectedMonitoredItemNotifications =",
                    this.hasUncollectedMonitoredItemNotifications
                );

            this.state = SubscriptionState.LATE;
            return;
        }

        if (publishEngine.pendingPublishRequestCount > 0) {
            if (this.hasPendingNotifications) {
                // simply pop pending notification and send it
                this.process_subscription();
            } else if (this.hasUncollectedMonitoredItemNotifications) {
                this.process_subscription();
            } else {
                this._process_keepAlive();
            }
        } else {
            if (this.state !== SubscriptionState.LATE) {
                this._process_keepAlive();
            } else {
                this.resetKeepAliveCounter();
            }
        }
    }

    /**
     * @private
     */
    private _sendKeepAliveResponse(): boolean {
        const future_sequence_number = this._get_future_sequence_number();

        if (this.publishEngine!.send_keep_alive_response(this.id, future_sequence_number)) {
            this.messageSent = true;
            // istanbul ignore next
            doDebug &&
                debugLog(
                    `    -> Subscription#_sendKeepAliveResponse subscriptionId ${this.id} future_sequence_number ${future_sequence_number}`
                );
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
    private resetKeepAliveCounter(): void {
        this._keep_alive_counter = 0;

        // istanbul ignore next
        doDebug &&
            debugLog(
                "     -> subscriptionId",
                this.id,
                " Resetting keepAliveCounter = ",
                this._keep_alive_counter,
                this.maxKeepAliveCount
            );
    }

    /**
     * @private
     */
    private increaseKeepAliveCounter() {
        this._keep_alive_counter += 1;

        // istanbul ignore next
        doDebug &&
            debugLog(
                "     -> subscriptionId",
                this.id,
                " Increasing keepAliveCounter = ",
                this._keep_alive_counter,
                this.maxKeepAliveCount
            );
    }

    /**
     * @private
     */
    private _addNotificationMessage(notificationData: QueueItem | StatusChangeNotification, monitoredItemId?: number) {
        // istanbul ignore next
        doDebug && debugLog(chalk.yellow("Subscription#_addNotificationMessage"), notificationData.toString());

        this._pending_notifications.push({
            monitoredItemId,
            notification: notificationData,
            publishTime: new Date(),
            start_tick: this.publishIntervalCount
        });
    }

    /**
     * @internal
     * @param monitoredItemId
     */
    private _removePendingNotificationsFor(monitoredItemId: number) {
        const nbRemovedNotification = this._pending_notifications.filterOut((e) => e.monitoredItemId === monitoredItemId);
        doDebug && debugLog(`Removed ${nbRemovedNotification} notifications`);
    }
    /**
     * Extract the next Notification that is ready to be sent to the client.
     * @return the Notification to send._pending_notifications
     */
    private _popNotificationToSend(): NotificationMessage {
        assert(this._pending_notifications.size > 0);

        const notificationMessage = new NotificationMessage({
            sequenceNumber: 0xffffffff,
            notificationData: [],
            publishTime: new Date()
        }); //

        const dataChangeNotifications: DataChangeNotification = new DataChangeNotification({
            monitoredItems: []
        });
        const eventNotificationList: EventNotificationList = new EventNotificationList({
            events: []
        });

        let statusChangeNotification: StatusChangeNotification | undefined;

        let i = 0;
        let hasEventFieldList = 0;
        let hasMonitoredItemNotification = 0;
        const m = this.maxNotificationsPerPublish;
        while (i < m && this._pending_notifications.size > 0) {
            if (hasEventFieldList || hasMonitoredItemNotification) {
                const notification1 = this._pending_notifications.first()!.notification;
                if (notification1 instanceof StatusChangeNotification) {
                    break;
                }
            }
            const notification = this._pending_notifications.shift()!.notification;
            if (notification instanceof MonitoredItemNotification) {
                assert(notification.clientHandle !== 4294967295);
                dataChangeNotifications.monitoredItems!.push(notification);
                hasMonitoredItemNotification = 1;
            } else if (notification instanceof EventFieldList) {
                eventNotificationList.events!.push(notification);
                hasEventFieldList = 1;
            } else if (notification instanceof StatusChangeNotification) {
                // to do
                statusChangeNotification = notification;
                break;
            }
            i += 1;
        }

        if (dataChangeNotifications.monitoredItems!.length) {
            notificationMessage.notificationData!.push(dataChangeNotifications);
        }
        if (eventNotificationList.events!.length) {
            notificationMessage.notificationData!.push(eventNotificationList);
        }
        if (statusChangeNotification) {
            notificationMessage.notificationData!.push(statusChangeNotification);
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
    private discardOldSentNotifications() {
        // Sessions maintain a retransmission queue of sent NotificationMessages. NotificationMessages
        // are retained in this queue until they are acknowledged. The Session shall maintain a
        // retransmission queue size of at least two times the number of Publish requests per Session the
        // Server supports.  Clients are required to acknowledge NotificationMessages as they are received. In the
        // case of a retransmission queue overflow, the oldest sent NotificationMessage gets deleted. If a
        // Subscription is transferred to another Session, the queued NotificationMessages for this
        // Subscription are moved from the old to the new Session.
        if (maxNotificationMessagesInQueue <= this._sent_notification_messages.length) {
            doDebug && debugLog("discardOldSentNotifications = ", this._sent_notification_messages.length);
            this._sent_notification_messages.splice(this._sent_notification_messages.length - maxNotificationMessagesInQueue);
        }
    }

    /**
     * @param timestampsToReturn
     * @param monitoredItemCreateRequest
     * @param node
     * @private
     */
    private _createMonitoredItemStep2(
        timestampsToReturn: TimestampsToReturn,
        monitoredItemCreateRequest: MonitoredItemCreateRequest,
        node: BaseNode
    ): MonitoredItemCreateResult {
        // note : most of the parameter inconsistencies shall have been handled by the caller
        // any error here will raise an assert here

        assert(monitoredItemCreateRequest instanceof MonitoredItemCreateRequest);
        const itemToMonitor = monitoredItemCreateRequest.itemToMonitor;

        // xx check if attribute Id invalid (we only support Value or EventNotifier )
        // xx assert(itemToMonitor.attributeId !== AttributeIds.INVALID);

        this.monitoredItemIdCounter += 1;

        const monitoredItemId = getNextMonitoredItemId();

        const requestedParameters = monitoredItemCreateRequest.requestedParameters;

        // adjust requestedParameters.samplingInterval
        requestedParameters.samplingInterval = this.adjustSamplingInterval(requestedParameters.samplingInterval, node);

        // reincorporate monitoredItemId and itemToMonitor into the requestedParameters
        const options = requestedParameters as any as MonitoredItemOptions;

        options.monitoredItemId = monitoredItemId;
        options.itemToMonitor = itemToMonitor;

        const monitoredItem = new MonitoredItem(options);
        monitoredItem.timestampsToReturn = timestampsToReturn;
        monitoredItem.$subscription = this;

        assert(monitoredItem.monitoredItemId === monitoredItemId);

        this.monitoredItems[monitoredItemId] = monitoredItem;
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
    public _createMonitoredItemStep3(
        monitoredItem: MonitoredItem | null,
        monitoredItemCreateRequest: MonitoredItemCreateRequest
    ): void {
        if (!monitoredItem) {
            return;
        }
        assert(monitoredItem.monitoringMode === MonitoringMode.Invalid);
        assert(typeof monitoredItem.samplingFunc === "function", " expecting a sampling function here");
        const monitoringMode = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
        monitoredItem.setMonitoringMode(monitoringMode);
    }

    private _harvestMonitoredItems() {
        for (const monitoredItem of Object.values(this.monitoredItems)) {
            const notifications_chunks = monitoredItem.extractMonitoredItemNotifications();
            for (const chunk of notifications_chunks) {
                this._addNotificationMessage(chunk, monitoredItem.monitoredItemId);
            }
        }
        this._hasUncollectedMonitoredItemNotifications = false;
    }
}

assert(Subscription.maximumPublishingInterval < 2147483647, "maximumPublishingInterval cannot exceed (2**31-1) ms ");
