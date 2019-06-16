/**
 * @module node-opcua-server
 */
// tslint:disable:no-console

import {TimestampsToReturn} from "node-opcua-data-value";

// tslint:disable-next-line:no-var-requires
const Dequeue = require("dequeue");
import chalk from "chalk";
import {EventEmitter} from "events";
import * as _ from "underscore";
import * as util from "util";

import {AddressSpace, BaseNode, Duration, UAObjectType, UAVariable} from "node-opcua-address-space";
import {checkSelectClauses} from "node-opcua-address-space";
import {SessionContext} from "node-opcua-address-space";
import {assert} from "node-opcua-assert";
import {Byte} from "node-opcua-basic-types";
import {SessionDiagnosticsDataType, SubscriptionDiagnosticsDataType} from "node-opcua-common";
import {NodeClass} from "node-opcua-data-model";
import {AttributeIds} from "node-opcua-data-model";
import {isValidDataEncoding} from "node-opcua-data-model";
import {checkDebugFlag, make_debugLog} from "node-opcua-debug";
import {ExtensionObject} from "node-opcua-extension-object";
import {
    NodeId
} from "node-opcua-nodeid";
import {ObjectRegistry} from "node-opcua-object-registry";
import {
    SequenceNumberGenerator
} from "node-opcua-secure-channel";
import {EventFilter} from "node-opcua-service-filter";
import {AggregateFilter} from "node-opcua-service-subscription";
import {
    DataChangeNotification,
    EventNotificationList,
    MonitoringMode,
    NotificationMessage,
    StatusChangeNotification
} from "node-opcua-service-subscription";
import {
    DataChangeFilter,
    MonitoredItemCreateRequest
} from "node-opcua-service-subscription";
import {
    StatusCode,
    StatusCodes
} from "node-opcua-status-code";
import {
    AggregateFilterResult,
    ContentFilterResult,
    EventFieldList,
    EventFilterResult,
    MonitoredItemCreateResult,
    MonitoredItemNotification,
    SubscriptionDiagnosticsDataTypeOptions
} from "node-opcua-types";

import {MonitoredItem, MonitoredItemOptions} from "./monitored_item";
import {ServerSession} from "./server_session";
import {validateFilter} from "./validate_filter";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const maxNotificationMessagesInQueue = 100;

export interface SubscriptionDiagnosticsDataTypePriv extends SubscriptionDiagnosticsDataType {
    $subscription: Subscription;
}
export enum SubscriptionState {
    CLOSED = 1,   // The Subscription has not yet been created or has terminated.
    CREATING = 2, // The Subscription is being created
    NORMAL = 3,   // The Subscription is cyclically checking for Notifications from its MonitoredItems.
    // The keep-alive counter is not used in this state.
    LATE = 4,     // The publishing timer has expired and there are Notifications available or a keep-alive Message is
    // ready to be sent, but there are no Publish requests queued. When in this state, the next Publish
    // request is processed when it is received. The keep-alive counter is not used in this state.
    KEEPALIVE = 5, // The Subscription is cyclically checking for Notification
    // alive counter to count down to 0 from its maximum.
    TERMINATED = 6
}

function _adjust_publishing_interval(publishingInterval?: number): number {
    publishingInterval = publishingInterval || Subscription.defaultPublishingInterval;
    publishingInterval = Math.max(publishingInterval, Subscription.minimumPublishingInterval);
    publishingInterval = Math.min(publishingInterval, Subscription.maximumPublishingInterval);
    return publishingInterval;
}

const minimumMaxKeepAliveCount = 2;
const maximumMaxKeepAliveCount = 12000;

function _adjust_maxKeepAliveCount(maxKeepAliveCount?: number/*,publishingInterval*/): number {
    maxKeepAliveCount = maxKeepAliveCount || minimumMaxKeepAliveCount;
    maxKeepAliveCount = Math.max(maxKeepAliveCount, minimumMaxKeepAliveCount);
    maxKeepAliveCount = Math.min(maxKeepAliveCount, maximumMaxKeepAliveCount);
    return maxKeepAliveCount;
}

function _adjust_lifeTimeCount(
    lifeTimeCount: number,
    maxKeepAliveCount: number,
    publishingInterval: number
): number {
    lifeTimeCount = lifeTimeCount || 1;

    // let's make sure that lifeTimeCount is at least three time maxKeepAliveCount
    // Note : the specs say ( part 3  - CreateSubscriptionParameter )
    //        "The lifetime count shall be a minimum of three times the keep keep-alive count."
    lifeTimeCount = Math.max(lifeTimeCount, maxKeepAliveCount * 3);

    const minTicks = Math.ceil(5 * 1000 / (publishingInterval)); // we want 5 seconds min

    lifeTimeCount = Math.max(minTicks, lifeTimeCount);
    return lifeTimeCount;
}

function _adjust_publishinEnable(
    publishingEnabled?: boolean | null
): boolean {
    return (publishingEnabled === null || publishingEnabled === undefined) ? true : !!publishingEnabled;
}

function _adjust_maxNotificationsPerPublish(
    maxNotificationsPerPublish?: number
): number {
    maxNotificationsPerPublish = maxNotificationsPerPublish === undefined ? 0 : maxNotificationsPerPublish;
    assert(_.isNumber(maxNotificationsPerPublish));
    return (maxNotificationsPerPublish >= 0) ? maxNotificationsPerPublish : 0;
}

function w(s: string | number, length: number): string {
    return ("000" + s).substr(-length);
}

function t(d: Date): string {
    return w(d.getHours(), 2) + ":"
        + w(d.getMinutes(), 2) + ":"
        + w(d.getSeconds(), 2) + ":"
        + w(d.getMilliseconds(), 3);
}

// verify that the injected publishEngine provides the expected services
// regarding the Subscription requirements...
function _assert_valid_publish_engine(publishEngine: any) {
    assert(_.isObject(publishEngine));
    assert(_.isNumber(publishEngine.pendingPublishRequestCount));
    assert(_.isFunction(publishEngine.send_notification_message));
    assert(_.isFunction(publishEngine.send_keep_alive_response));
    assert(_.isFunction(publishEngine.on_close_subscription));
}

function assert_validNotificationData(n: any) {
    assert(
        n instanceof DataChangeNotification ||
        n instanceof EventNotificationList ||
        n instanceof StatusChangeNotification
    );
}

function getSequenceNumbers(arr: any[]): number [] {
    return arr.map((e: any) => {
        return e.notification.sequenceNumber;
    });
}

function analyseEventFilterResult(
    node: BaseNode,
    eventFilter: EventFilter
): EventFilterResult {

    if (!(eventFilter instanceof EventFilter)) {
        throw new Error("Internal Error");
    }

    const selectClauseResults = checkSelectClauses(
        node as UAObjectType,
        eventFilter.selectClauses || []
    );

    const whereClauseResult = new ContentFilterResult();

    return new EventFilterResult({
        selectClauseDiagnosticInfos: [],
        selectClauseResults,
        whereClauseResult
    });
}

function analyseDataChangeFilterResult(
    node: BaseNode,
    dataChangeFilter: DataChangeFilter
): AggregateFilterResult | null {
    assert(dataChangeFilter instanceof DataChangeFilter);
    // the opcua specification doesn't provide dataChangeFilterResult
    return null;
}

function analyseAggregateFilterResult(
    node: BaseNode,
    aggregateFilter: AggregateFilter
): AggregateFilterResult {
    assert(aggregateFilter instanceof AggregateFilter);
    return new AggregateFilterResult({});
}

function _process_filter(
    node: BaseNode,
    filter: any
): any {

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
    
    const subscription_subscriptionDiagnostics = (subscriptionDiagnostics as any);
    subscription_subscriptionDiagnostics.$subscription = subscription;
    // "sessionId"
    subscription_subscriptionDiagnostics.__defineGetter__("sessionId", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.getSessionId();
    });
    subscription_subscriptionDiagnostics.__defineGetter__("subscriptionId", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.id;
    });
    subscription_subscriptionDiagnostics.__defineGetter__("priority", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.priority;
    });
    subscription_subscriptionDiagnostics.__defineGetter__("publishingInterval", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.publishingInterval;
    });
    subscription_subscriptionDiagnostics.__defineGetter__("maxLifetimeCount", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.lifeTimeCount;
    });
    subscription_subscriptionDiagnostics.__defineGetter__("maxKeepAliveCount", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.maxKeepAliveCount;
    });
    subscription_subscriptionDiagnostics.__defineGetter__("maxNotificationsPerPublish", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.maxNotificationsPerPublish;
    });
    subscription_subscriptionDiagnostics.__defineGetter__("publishingEnabled", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.publishingEnabled;
    });
    subscription_subscriptionDiagnostics.__defineGetter__("monitoredItemCount", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription.monitoredItemCount;
    });
    subscription_subscriptionDiagnostics.__defineGetter__("nextSequenceNumber", function(this: SubscriptionDiagnosticsDataTypePriv) {
        return this.$subscription._get_future_sequence_number();
    });
    subscription_subscriptionDiagnostics.__defineGetter__("disabledMonitoredItemCount", function(this: SubscriptionDiagnosticsDataTypePriv) {
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
     "currentKeepAliveCount",
     "currentLifetimeCount",
     "unacknowledgedMessageCount",
     "discardedMessageCount",
     "monitoringQueueOverflowCount",
     "eventQueueOverFlowCount"
     */
    // add object in Variable SubscriptionDiagnosticArray (i=2290) ( Array of SubscriptionDiagnostics)
    // add properties in Variable to reflect
    return subscriptionDiagnostics as SubscriptionDiagnosticsDataTypePriv;
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

    publishEngine?: IServerPublishEngine;
    /**
     *  a unique identifier
     */
    id?: number;
}

type IServerPublishEngine = any;

let g_monitoredItemId = 1;

function getNextMonitoredItemId() {
    return g_monitoredItemId++;
}

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
    serverHandles: number[];
    /**
     *  array of clientHandles for all MonitoredItems of the subscription
     *  identified by subscriptionId.
     */
    clientHandles: number[];
    statusCode: StatusCode;
}

interface InternalNotification {
    notification: NotificationMessage;
    publishTime: Date;
    sequenceNumber: number;
    start_tick: number;
}

/**
 * The Subscription class used in the OPCUA server side.
 */
export class Subscription extends EventEmitter {

    public static minimumPublishingInterval: number = 50;  // fastest possible
    public static defaultPublishingInterval: number = 1000; // one second
    public static maximumPublishingInterval: number = 1000 * 60 * 60 * 24 * 15; // 15 days
    public static registry = new ObjectRegistry();

    public sessionId: NodeId;
    public publishEngine: IServerPublishEngine;
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

    public state: any;
    public messageSent: boolean;
    public $session?: ServerSession;

    private _life_time_counter: number;
    private _keep_alive_counter: number = 0;
    private _pending_notifications: InternalNotification[];
    private _sent_notifications: InternalNotification[];
    private readonly _sequence_number_generator: SequenceNumberGenerator;
    private publishIntervalCount: number;
    private readonly monitoredItems: any;
    /**
     *  number of monitored Item
     */
    private monitoredItemIdCounter: number;
    private _unacknowledgedMessageCount: number;
    private timerId: any;
    private _hasMonitoredItemNotifications: boolean = false;

    constructor(options: SubscriptionOptions) {

        super();

        options = options || {};

        Subscription.registry.register(this);

        this.sessionId = options.sessionId || NodeId.nullNodeId;
        assert(this.sessionId instanceof NodeId, "expecting a sessionId NodeId");

        this.publishEngine = options.publishEngine;
        _assert_valid_publish_engine(this.publishEngine);

        this.id = options.id || INVALID_ID;

        this.priority = options.priority || 0;

        this.publishingInterval = _adjust_publishing_interval(options.publishingInterval);

        this.maxKeepAliveCount = _adjust_maxKeepAliveCount(options.maxKeepAliveCount); // , this.publishingInterval);

        this.resetKeepAliveCounter();

        this.lifeTimeCount = _adjust_lifeTimeCount(
            options.lifeTimeCount || 0, this.maxKeepAliveCount, this.publishingInterval);

        this.maxNotificationsPerPublish = _adjust_maxNotificationsPerPublish(options.maxNotificationsPerPublish);

        this._life_time_counter = 0;
        this.resetLifeTimeCounter();

        // notification message that are ready to be sent to the client
        this._pending_notifications = new Dequeue();

        this._sent_notifications = [];

        this._sequence_number_generator = new SequenceNumberGenerator();

        // initial state of the subscription
        this.state = SubscriptionState.CREATING;

        this.publishIntervalCount = 0;

        this.monitoredItems = {}; // monitored item map

        this.monitoredItemIdCounter = 0;

        this.publishingEnabled = _adjust_publishinEnable(options.publishingEnabled);

        this.subscriptionDiagnostics = createSubscriptionDiagnostics(this);

        // A boolean value that is set to TRUE to mean that either a NotificationMessage or a keep-alive
        // Message has been sent on the Subscription. It is a flag that is used to ensure that either a
        // NotificationMessage or a keep-alive Message is sent out the first time the publishing
        // timer expires.
        this.messageSent = false;

        this._unacknowledgedMessageCount = 0;

        this.timerId = null;
        this._start_timer();

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
        // this.publishingInterval);
        this.lifeTimeCount = _adjust_lifeTimeCount(param.requestedLifetimeCount,
            this.maxKeepAliveCount, this.publishingInterval);

        this.maxNotificationsPerPublish = param.maxNotificationsPerPublish || 0;
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
        return this._keep_alive_counter >= this.maxKeepAliveCount;
    }

    /**
     * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
     * the CreateSubscription Service( 5.13.2).
     * @private
     */
    public resetLifeTimeCounter() {
        this._life_time_counter = 0;
    }

    /**
     * @private
     */
    public increaseLifeTimeCounter() {
        this._life_time_counter += 1;
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
    public terminate() {

        assert(arguments.length === 0);
        debugLog("Subscription#terminate status", this.state);

        if (this.state === SubscriptionState.CLOSED) {
            // todo verify if asserting is required here
            return;
        }
        assert(this.state !== SubscriptionState.CLOSED, "terminate already called ?");

        // stop timer
        this._stop_timer();

        debugLog("terminating Subscription  ", this.id, " with ", this.monitoredItemCount, " monitored items");

        // dispose all monitoredItem
        const keys = Object.keys(this.monitoredItems);

        for (const key of keys) {
            const status = this.removeMonitoredItem(key);
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

        this.publishEngine.on_close_subscription(this);

    }

    public dispose() {

        if (doDebug) {
            debugLog("Subscription#dispose", this.id, this.monitoredItemCount);
        }

        assert(this.monitoredItemCount === 0, "MonitoredItems haven't been  deleted first !!!");
        assert(this.timerId === null, "Subscription timer haven't been terminated");

        if (this.subscriptionDiagnostics) {
            delete (this.subscriptionDiagnostics as SubscriptionDiagnosticsDataTypePriv).$subscription;
        }

        this.publishEngine = null;
        this._pending_notifications = [];
        this._sent_notifications = [];

        this.sessionId = NodeId.nullNodeId;

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
        return this._pending_notifications ? this._pending_notifications.length : 0;
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
    public get sentNotificationsCount(): number {
        return this._sent_notifications.length;
    }

    /**
     * number of monitored items handled by this subscription
     */
    public get monitoredItemCount() {
        return Object.keys(this.monitoredItems).length;
    }

    /**
     * number of disabled monitored items.
     */
    public get disabledMonitoredItemCount(): number {
        return _.reduce(_.values(this.monitoredItems), (cumul: any, monitoredItem: MonitoredItem) => {
            return cumul + ((monitoredItem.monitoringMode === MonitoringMode.Disabled) ? 1 : 0);
        }, 0);
    }

    /**
     * The number of unacknowledged messages saved in the republish queue.
     */
    public get unacknowledgedMessageCount(): number {
        return this._unacknowledgedMessageCount;
    }

    /**
     * adjust monitored item sampling interval
     *  - an samplingInterval ===0 means that we use a event-base model ( no sampling)
     *  - otherwise the sampling is adjusted
     * @private
     */
    public adjustSamplingInterval(samplingInterval: number, node: BaseNode) {

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
                SessionContext.defaultContext, AttributeIds.MinimumSamplingInterval);

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
            (node && (node as any).minimumSamplingInterval)
                ? (node as any).minimumSamplingInterval : 0;

        samplingInterval = Math.max(samplingInterval, node_minimumSamplingInterval);

        return samplingInterval;
    }

    /**
     * create a monitored item
     * @param addressSpace - address space
     * @param timestampsToReturn  - the timestamp to return
     * @param monitoredItemCreateRequest - the parameters describing the monitored Item to create
     */
    public createMonitoredItem(
        addressSpace: AddressSpace,
        timestampsToReturn: TimestampsToReturn,
        monitoredItemCreateRequest: MonitoredItemCreateRequest
    ): MonitoredItemCreateResult {

        assert(addressSpace.constructor.name === "AddressSpace");
        assert(monitoredItemCreateRequest instanceof MonitoredItemCreateRequest);

        function handle_error(statusCode: StatusCode): MonitoredItemCreateResult {
            return new MonitoredItemCreateResult({statusCode});
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
        // xx var monitoringMode      = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
        // xx var requestedParameters = monitoredItemCreateRequest.requestedParameters;

        const monitoredItemCreateResult =
            this._createMonitoredItemStep2(timestampsToReturn, monitoredItemCreateRequest, node);

        assert(monitoredItemCreateResult.statusCode === StatusCodes.Good);

        const monitoredItem = this.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);
        assert(monitoredItem);

        // TODO: fix old way to set node. !!!!
        monitoredItem.setNode(node);

        this.emit("monitoredItem", monitoredItem, itemToMonitor);

        this._createMonitoredItemStep3(monitoredItem, monitoredItemCreateRequest);

        return monitoredItemCreateResult;

    }

    /**
     * get a monitoredItem by Id.
     * @param monitoredItemId : the id of the monitored item to get.
     * @return the monitored item matching monitoredItemId
     */
    public getMonitoredItem(monitoredItemId: number | string): MonitoredItem {
        assert(_.isFinite(monitoredItemId));
        return this.monitoredItems[monitoredItemId];
    }

    /**
     * remove a monitored Item from the subscription.
     * @param monitoredItemId : the id of the monitored item to get.
     */
    public removeMonitoredItem(monitoredItemId: number | string): StatusCode {

        debugLog("Removing monitoredIem ", monitoredItemId);

        assert(_.isFinite(monitoredItemId));
        if (!this.monitoredItems.hasOwnProperty(monitoredItemId)) {
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

        return StatusCodes.Good;

    }

    /**
     * rue if monitored Item have uncollected Notifications
     */
    public get hasMonitoredItemNotifications(): boolean {
        if (this._hasMonitoredItemNotifications) {
            return true;
        }
        const keys = Object.keys(this.monitoredItems);
        const n = keys.length;
        for (let i = 0; i < n; i++) {
            const key = keys[i];
            const monitoredItem = this.monitoredItems[key];
            if (monitoredItem.hasMonitoredItemNotifications) {
                this._hasMonitoredItemNotifications = true;
                return true;
            }
        }
        return false;
    }

    public get subscriptionId() {
        return this.id;
    }

    public getMessageForSequenceNumber(sequenceNumber: number) {

        function filter_func(e: any): boolean {
            return e.sequenceNumber === sequenceNumber;
        }

        const notification_message = _.find(this._sent_notifications, filter_func);

        if (!notification_message) {
            return null;
        }
        return notification_message;

    }

    /**
     * returns true if the notification has expired
     * @param notification
     */
    public notificationHasExpired(notification: any): boolean {
        assert(notification.hasOwnProperty("start_tick"));
        assert(_.isFinite(notification.start_tick + this.maxKeepAliveCount));
        return (notification.start_tick + this.maxKeepAliveCount) < this.publishIntervalCount;
    }

    /**
     *  returns in an array the sequence numbers of the notifications that haven't been
     *  acknowledged yet.
     */
    public getAvailableSequenceNumbers(): number[] {
        const availableSequenceNumbers = getSequenceNumbers(this._sent_notifications);
        return availableSequenceNumbers;
    }

    /**
     * acknowledges a notification identified by its sequence number
     */
    public acknowledgeNotification(sequenceNumber: number): StatusCode {

        let foundIndex = -1;
        _.find(this._sent_notifications, (e: any, index: number) => {
            if (e.sequenceNumber === sequenceNumber) {
                foundIndex = index;
            }
        });

        if (foundIndex === -1) {
            if (doDebug) {
                debugLog(chalk.red("acknowledging sequence FAILED !!! "),
                    chalk.cyan(sequenceNumber.toString()));
            }
            return StatusCodes.BadSequenceNumberUnknown;
        } else {
            if (doDebug) {
                debugLog(chalk.yellow("acknowledging sequence "),
                    chalk.cyan(sequenceNumber.toString()));
            }
            this._sent_notifications.splice(foundIndex, 1);
            this._unacknowledgedMessageCount--;
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

        const result: GetMonitoredItemsResult = {
            clientHandles: [] as number[],
            serverHandles: [] as number[],
            statusCode: StatusCodes.Good
        };
        Object.keys(this.monitoredItems).forEach((monitoredItemId: string) => {

            const monitoredItem = this.getMonitoredItem(monitoredItemId)!;

            result.clientHandles.push(monitoredItem.clientHandle!);
            // TODO:  serverHandle is defined anywhere in the OPCUA Specification 1.02
            //        I am not sure what shall be reported for serverHandle...
            //        using monitoredItem.monitoredItemId instead...
            //        May be a clarification in the OPCUA Spec is required.
            result.serverHandles.push(parseInt(monitoredItemId, 10));

        });
        return result;
    }

    /**
     * @private
     */
    public resendInitialValues(): void {
        _.forEach(this.monitoredItems, (monitoredItem: MonitoredItem/*,monitoredItemId*/) => {
            monitoredItem.resendInitialValues();
        });
    }

    /**
     * @private
     */
    public notifyTransfer(): void {
        // OPCUA UA Spec 1.0.3 : part 3 - page 82 - 5.13.7 TransferSubscriptions:
        // If the Server transfers the Subscription to the new Session, the Server shall issue
        // a StatusChangeNotification notificationMessage with the status code
        // Good_SubscriptionTransferred to the old Session.
        const subscription = this;

        debugLog(chalk.red(" Subscription => Notifying Transfer                                  "));

        const notificationData = [
            new StatusChangeNotification({
                status: StatusCodes.GoodSubscriptionTransferred
            })
        ];

        subscription.publishEngine.send_notification_message({
            moreNotifications: false,
            notificationData,
            sequenceNumber: subscription._get_next_sequence_number(),
            subscriptionId: subscription.id
        }, true);
    }

    /**
     *
     *  the server invokes the resetLifeTimeAndKeepAliveCounters method of the subscription
     *  when the server  has send a Publish Response, so that the subscription
     *  can reset its life time counter.
     *
     * @private
     */
    public resetLifeTimeAndKeepAliveCounters() {
        this.resetLifeTimeCounter();
        this.resetKeepAliveCounter();
    }

    /**
     *  _publish_pending_notifications send a "notification" event:
     *
     * @private
     *
     */
    public _publish_pending_notifications() {

        const publishEngine = this.publishEngine;
        const subscriptionId = this.id;

        // preconditions
        assert(publishEngine.pendingPublishRequestCount > 0);
        assert(this.hasPendingNotifications);

        // todo : get rid of this....
        this.emit("notification");

        const notificationMessage = this._popNotificationToSend().notification;

        this.emit("notificationMessage", notificationMessage);

        assert(_.isArray(notificationMessage.notificationData));

        notificationMessage.notificationData!.forEach(
            (notificationData: ExtensionObject | null) => {

                if (notificationData instanceof DataChangeNotification) {
                    this.subscriptionDiagnostics.dataChangeNotificationsCount += 1;
                } else if (notificationData instanceof EventNotificationList) {
                    this.subscriptionDiagnostics.eventNotificationsCount += 1;
                } else {
                    // TODO
                }
            });

        assert(notificationMessage.hasOwnProperty("sequenceNumber"));
        assert(notificationMessage.hasOwnProperty("notificationData"));

        const moreNotifications = (this.hasPendingNotifications);

        // update diagnostics
        if (this.subscriptionDiagnostics) {
            this.subscriptionDiagnostics.notificationsCount += 1;
            this.subscriptionDiagnostics.publishRequestCount += 1;
        }

        publishEngine.send_notification_message({
            moreNotifications,
            notificationData: notificationMessage.notificationData,
            sequenceNumber: notificationMessage.sequenceNumber,
            subscriptionId
        }, false);
        this.messageSent = true;
        this._unacknowledgedMessageCount++;

        this.resetLifeTimeAndKeepAliveCounters();

        if (doDebug) {
            debugLog("Subscription sending a notificationMessage subscriptionId=", subscriptionId,
                "sequenceNumber = ", notificationMessage.sequenceNumber.toString());
            // debugLog(notificationMessage.toString());
        }

        if (this.state !== SubscriptionState.CLOSED) {
            assert(notificationMessage.notificationData!.length > 0, "We are not expecting a keep-alive message here");
            this.state = SubscriptionState.NORMAL;
            debugLog("subscription " + this.id + chalk.bgYellow(" set to NORMAL"));
        }

    }

    public process_subscription() {

        assert(this.publishEngine.pendingPublishRequestCount > 0);

        if (!this.publishingEnabled) {
            // no publish to do, except keep alive
            this._process_keepAlive();
            return;
        }

        if (!this.hasPendingNotifications && this.hasMonitoredItemNotifications) {
            // collect notification from monitored items
            this._harvestMonitoredItems();
        }

        // let process them first
        if (this.hasPendingNotifications) {

            this._publish_pending_notifications();

            if (this.state === SubscriptionState.NORMAL && this.hasPendingNotifications) {

                // istanbul ignore next
                if (doDebug) {
                    debugLog("    -> pendingPublishRequestCount > 0 " +
                        "&& normal state => re-trigger tick event immediately ");
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

        // xx assert(!self.publishingEnabled || (!self.hasPendingNotifications && !self.hasMonitoredItemNotifications));

        this.increaseKeepAliveCounter();

        if (this.keepAliveCounterHasExpired) {

            if (this._sendKeepAliveResponse()) {

                this.resetLifeTimeAndKeepAliveCounters();

            } else {
                debugLog("     -> subscription.state === LATE , " +
                    "because keepAlive Response cannot be send due to lack of PublishRequest");
                this.state = SubscriptionState.LATE;
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

        debugLog(chalk.bgWhite.blue("Subscription#_start_timer  subscriptionId="),
            this.id, " publishingInterval = ", this.publishingInterval);

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
        this._keep_alive_counter = this.maxKeepAliveCount;

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

        debugLog("Subscription#_tick  aborted=", this.aborted, "state=", this.state.toString());

        if (this.aborted) {
            // xx  console.log(" Log aborteds")
            // xx  // underlying channel has been aborted ...
            // xx self.publishEngine.cancelPendingPublishRequestBeforeChannelChange();
            // xx // let's still increase lifetime counter to detect timeout
        }

        if (this.state === SubscriptionState.CLOSED) {
            console.log("Warning: Subscription#_tick called while subscription is CLOSED");
            return;
        }

        this.discardOldSentNotifications();

        // istanbul ignore next
        if (doDebug) {
            debugLog((t(new Date()) + "  " + this._life_time_counter + "/" + this.lifeTimeCount +
                chalk.cyan("   Subscription#_tick")),
                "  processing subscriptionId=", this.id,
                "hasMonitoredItemNotifications = ", this.hasMonitoredItemNotifications,
                " publishingIntervalCount =", this.publishIntervalCount);
        }
        if (this.publishEngine._on_tick) {
            this.publishEngine._on_tick();
        }

        this.publishIntervalCount += 1;

        this.increaseLifeTimeCounter();

        if (this.lifeTimeHasExpired) {

            /* istanbul ignore next */
            if (doDebug) {
                debugLog(
                    chalk.red.bold("Subscription " + this.id + " has expired !!!!! => Terminating"));
            }
            /**
             * notify the subscription owner that the subscription has expired by exceeding its life time.
             * @event expired
             *
             */
            this.emit("expired");

            // notify new terminated status only when subscription has timeout.
            debugLog("adding StatusChangeNotification notification message for BadTimeout subscription = ", this.id);
            this._addNotificationMessage([
                new StatusChangeNotification({status: StatusCodes.BadTimeout})
            ]);

            // kill timer and delete monitored items and transfer pending notification messages
            this.terminate();

            return;

        }

        const publishEngine = this.publishEngine;

        // istanbul ignore next
        if (doDebug) {
            debugLog("Subscription#_tick  self._pending_notifications= ", this._pending_notifications.length);
        }

        if (publishEngine.pendingPublishRequestCount === 0 &&
            (this.hasPendingNotifications || this.hasMonitoredItemNotifications)) {

            // istanbul ignore next
            if (doDebug) {
                debugLog("subscription set to LATE  hasPendingNotifications = ",
                    this.hasPendingNotifications, " hasMonitoredItemNotifications =",
                    this.hasMonitoredItemNotifications);
            }
            this.state = SubscriptionState.LATE;
            return;
        }

        if (publishEngine.pendingPublishRequestCount > 0) {

            if (this.hasPendingNotifications) {
                // simply pop pending notification and send it
                this.process_subscription();

            } else if (this.hasMonitoredItemNotifications) {
                this.process_subscription();

            } else {
                this._process_keepAlive();
            }
        } else {
            this._process_keepAlive();
        }
    }

    /**
     * @private
     */
    private _sendKeepAliveResponse(): boolean {

        const future_sequence_number = this._get_future_sequence_number();

        debugLog("     -> Subscription#_sendKeepAliveResponse subscriptionId", this.id);

        if (this.publishEngine.send_keep_alive_response(this.id, future_sequence_number)) {

            this.messageSent = true;

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
        if (doDebug) {
            debugLog("     -> subscriptionId", this.id,
                " Resetting keepAliveCounter = ", this._keep_alive_counter,
                this.maxKeepAliveCount);
        }
    }

    /**
     * @private
     */
    private increaseKeepAliveCounter() {
        this._keep_alive_counter += 1;

        // istanbul ignore next
        if (doDebug) {
            debugLog("     -> subscriptionId", this.id, " Increasing keepAliveCounter = ",
                this._keep_alive_counter, this.maxKeepAliveCount);
        }
    }

    /**
     * @private
     */
    private _addNotificationMessage(
        notificationData: Notification[]
    ) {

        assert(_.isArray(notificationData));
        assert(notificationData.length === 1 || notificationData.length === 2); // as per spec part 3.

        // istanbul ignore next
        if (doDebug) {
            debugLog(chalk.yellow("Subscription#_addNotificationMessage"),
                notificationData.toString());
        }
        const subscription = this;
        assert(_.isObject(notificationData[0]));

        assert_validNotificationData(notificationData[0]);
        if (notificationData.length === 2) {
            assert_validNotificationData(notificationData[1]);
        }

        const notification_message = new NotificationMessage({
            notificationData,
            publishTime: new Date(),
            sequenceNumber: this._get_next_sequence_number()
        });

        subscription._pending_notifications.push({
            notification: notification_message,
            publishTime: new Date(),
            sequenceNumber: notification_message.sequenceNumber,
            start_tick: subscription.publishIntervalCount
        });
        debugLog("pending notification to send ", subscription._pending_notifications.length);

    }

    /**
     * Extract the next Notification that is ready to be sent to the client.
     * @return the Notification to send._pending_notifications
     */
    private _popNotificationToSend(): InternalNotification {
        assert(this._pending_notifications.length > 0);
        const notification_message = this._pending_notifications.shift();
        if (!notification_message) {
            throw new Error("internal error");
        }
        this._sent_notifications.push(notification_message);
        return notification_message;
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
        if (maxNotificationMessagesInQueue <= this._sent_notifications.length) {
            debugLog("discardOldSentNotifications = ", this._sent_notifications.length);
            this._sent_notifications.splice(this._sent_notifications.length - maxNotificationMessagesInQueue);
        }
        //
        // var arr = _.filter(self._sent_notifications,function(notification){
        //   return self.notificationHasExpired(notification);
        // });
        // var results = arr.map(function(notification){
        //    return self.acknowledgeNotification(notification.sequenceNumber);
        // });
        // xx return results;
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
        node: BaseNode): MonitoredItemCreateResult {

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

        const filterResult = _process_filter(node, requestedParameters.filter);

        const monitoredItemCreateResult = new MonitoredItemCreateResult({
            filterResult,
            monitoredItemId,
            revisedQueueSize: monitoredItem.queueSize,
            revisedSamplingInterval: monitoredItem.samplingInterval,
            statusCode: StatusCodes.Good
        });
        return monitoredItemCreateResult;
    }

    /**
     *
     * @param monitoredItem
     * @param monitoredItemCreateRequest
     * @private
     */
    private _createMonitoredItemStep3(
        monitoredItem: MonitoredItem,
        monitoredItemCreateRequest: MonitoredItemCreateRequest
    ): void {

        assert(monitoredItem.monitoringMode === MonitoringMode.Invalid);
        assert(_.isFunction(monitoredItem.samplingFunc));
        const monitoringMode = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
        monitoredItem.setMonitoringMode(monitoringMode);
    }

    // collect DataChangeNotification
    private _collectNotificationData() {

        let notifications = [];

        // reset cache ...
        this._hasMonitoredItemNotifications = false;

        const all_notifications = new Dequeue();

        // visit all monitored items
        const keys = Object.keys(this.monitoredItems);
        const n = keys.length;
        for (let i = 0; i < n; i++) {
            const key = keys[i];
            const monitoredItem = this.monitoredItems[key];
            notifications = monitoredItem.extractMonitoredItemNotifications();
            add_all_in(notifications, all_notifications);
        }

        const notificationsMessage = [];

        while (all_notifications.length > 0) {

            // split into one or multiple dataChangeNotification with no more than
            //  self.maxNotificationsPerPublish monitoredItems
            const notifications_chunk = extract_notifications_chunk(all_notifications, this.maxNotificationsPerPublish);

            // separate data for DataChangeNotification (MonitoredItemNotification) from data for
            // EventNotificationList(EventFieldList)
            const dataChangedNotificationData = notifications_chunk.filter(
                filter_instanceof.bind(null, MonitoredItemNotification));
            const eventNotificationListData = notifications_chunk.filter(
                filter_instanceof.bind(null, EventFieldList));

            assert(notifications_chunk.length ===
                dataChangedNotificationData.length + eventNotificationListData.length);

            notifications = [];

            // add dataChangeNotification
            if (dataChangedNotificationData.length) {
                const dataChangeNotification = new DataChangeNotification({
                    diagnosticInfos: [],
                    monitoredItems: dataChangedNotificationData
                });
                notifications.push(dataChangeNotification);
            }

            // add dataChangeNotification
            if (eventNotificationListData.length) {
                const eventNotificationList = new EventNotificationList({
                    events: eventNotificationListData
                });

                notifications.push(eventNotificationList);
            }

            assert(notifications.length === 1 || notifications.length === 2);
            notificationsMessage.push(notifications);
        }

        assert(notificationsMessage instanceof Array);
        return notificationsMessage;
    }

    private _harvestMonitoredItems() {

        // Only collect data change notification for the time being
        const notificationData = this._collectNotificationData();
        assert(notificationData instanceof Array);

        // istanbul ignore next
        if (doDebug) {
            debugLog("Subscription#_harvestMonitoredItems =>", notificationData.length);
        }
        notificationData.forEach((notificationMessage: any) => {
            this._addNotificationMessage(notificationMessage);
        });
        this._hasMonitoredItemNotifications = false;

    }

}

/**
 * extract up to maxNotificationsPerPublish notifications
 * @param the full array of monitored items
 * @param maxNotificationsPerPublish  the maximum number of notification to extract
 * @return an extract of array of monitored item matching at most maxNotificationsPerPublish
 * @private
 */
function extract_notifications_chunk(
    monitoredItems: MonitoredItem[],
    maxNotificationsPerPublish: number
): MonitoredItem[] {

    let n = maxNotificationsPerPublish === 0 ?
        monitoredItems.length :
        Math.min(monitoredItems.length, maxNotificationsPerPublish);

    const chunk_monitoredItems: MonitoredItem[] = [];
    while (n) {
        chunk_monitoredItems.push(monitoredItems.shift() as MonitoredItem);
        n--;
    }
    return chunk_monitoredItems;
}

function add_all_in(notifications: any, allNotifications: any[]): void {
    for (const n of notifications) {
        allNotifications.push(n);
    }
}

function filter_instanceof(Class: any, e: any): boolean {
    return (e instanceof Class);
}

assert(Subscription.maximumPublishingInterval < 2147483647,
    "maximumPublishingInterval cannot exceed (2**31-1) ms ");
