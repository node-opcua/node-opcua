/**
 * @module node-opcua-server
 */
import { EventEmitter } from "node:events";
import { type Duration, type ISessionContext } from "node-opcua-address-space";
import type { Byte, UInt32 } from "node-opcua-basic-types";
import { SubscriptionDiagnosticsDataType } from "node-opcua-common";
import { AttributeIds, type QualifiedNameLike } from "node-opcua-data-model";
import type { TimestampsToReturn } from "node-opcua-data-value";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import type { NumericRange } from "node-opcua-numeric-range";
import { ObjectRegistry } from "node-opcua-object-registry";
import { DataChangeNotification, EventNotificationList, MonitoredItemCreateRequest, MonitoredItemCreateResult, MonitoringMode, NotificationMessage, StatusChangeNotification } from "node-opcua-service-subscription";
import { type StatusCode } from "node-opcua-status-code";
import { type MonitoringFilter } from "node-opcua-types";
import { type IServerSidePublishEngine } from "./i_server_side_publish_engine.js";
import type { INodeFinder, MonitorableNode } from "./monitorable_node.js";
import { MonitoredItem, type QueueItem } from "./monitored_item.js";
import { Queue } from "./queue.js";
import type { ServerSession } from "./server_session.js";
import type { ITransferSessionIdentity } from "./sessions_compatible_for_transfer.js";
export interface SubscriptionDiagnosticsDataTypePriv extends SubscriptionDiagnosticsDataType {
    $subscription: Subscription;
}
export declare enum SubscriptionState {
    CLOSED = 1,// The Subscription has not yet been created or has terminated.
    CREATING = 2,// The Subscription is being created
    NORMAL = 3,// The Subscription is cyclically checking for Notifications from its MonitoredItems.
    LATE = 4,// The publishing timer has expired and there are Notifications available or a keep-alive Message is
    KEEPALIVE = 5,// The Subscription is cyclically checking for Notification
    TERMINATED = 6
}
interface IGlobalMonitoredItemCounter {
    totalMonitoredItemCount: number;
}
/**
 * what a Subscription carries to another thread of the same server for TransferSubscriptions: its
 * parameters, its monitored items as they were created and revised, its next sequence number and
 * the NotificationMessages the client has not acknowledged yet
 */
export interface SubscriptionTransferState {
    id: number;
    publishingInterval: number;
    lifeTimeCount: number;
    maxKeepAliveCount: number;
    maxNotificationsPerPublish: number;
    publishingEnabled: boolean;
    priority: number;
    nextSequenceNumber: number;
    sentNotificationMessages: NotificationMessage[];
    /** the data changes and events collected for the client and not published yet (takePendingNotifications) */
    pendingNotifications?: {
        monitoredItemId: number;
        notification: QueueItem;
    }[];
    monitoredItems: {
        monitoredItemId: number;
        timestampsToReturn: TimestampsToReturn;
        request: MonitoredItemCreateRequest;
        /** the items this one triggers */
        linkedItems: number[];
    }[];
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
    /**
     * the id of each new MonitoredItem; by default a counter of this thread. Where subscriptions move
     * between threads (session workers), one counter for all of them keeps the ids of a Subscription unique.
     */
    monitoredItemIdAllocator?: () => number;
}
export type Notification = DataChangeNotification | EventNotificationList | StatusChangeNotification;
export type Counter = number;
export interface ModifySubscriptionParameters {
    /**
     *     requestedPublishingInterval =0 means fastest possible
     */
    requestedPublishingInterval?: Duration;
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
    /** encoded size, measured once when the notification was queued; see _degradeIfUndeliverable */
    size?: number;
}
export interface InternalCreateMonitoredItemResult {
    monitoredItem?: MonitoredItem;
    monitoredItemCreateRequest: MonitoredItemCreateRequest;
    createResult: MonitoredItemCreateResult;
}
export interface MonitoredItemBase {
    node: MonitorableNode | null;
    filter: MonitoringFilter | null;
    monitoringMode: MonitoringMode;
    timestampsToReturn: TimestampsToReturn;
    discardOldest: boolean;
    queueSize: number;
    clientHandle: UInt32;
}
export type CreateMonitoredItemHook = (subscription: Subscription, monitoredItem: MonitoredItemBase) => Promise<StatusCode>;
export type DeleteMonitoredItemHook = (subscription: Subscription, monitoredItem: MonitoredItemBase) => Promise<StatusCode>;
export interface ServerCapabilitiesPartial {
    maxMonitoredItems: UInt32;
    maxMonitoredItemsPerSubscription: UInt32;
    maxWhereClauseParameters?: UInt32;
    maxSelectClauseParameters?: UInt32;
    /**
     * the advertised MinSupportedSampleRate: the floor of a revised samplingInterval when 0 is
     * requested (undefined = MonitoredItem.minimumSamplingInterval)
     */
    minSupportedSampleRate?: number;
}
export interface IReadAttributeCapable {
    readAttribute(context: ISessionContext | null, attributeId: AttributeIds, indexRange?: NumericRange, dataEncoding?: QualifiedNameLike | null): DataValue;
}
/**
 * The Subscription class used in the OPCUA server side.
 */
export declare class Subscription extends EventEmitter {
    #private;
    static minimumPublishingInterval: number;
    static defaultPublishingInterval: number;
    static maximumPublishingInterval: number;
    static maxNotificationPerPublishHighLimit: number;
    static minimumLifetimeDuration: number;
    static maximumLifetimeDuration: number;
    /**
     * maximum number of monitored item in a subscription to be used
     * when serverCapacity.maxMonitoredItems and serverCapacity.maxMonitoredItemsPerSubscription are not set.
     */
    static defaultMaxMonitoredItemCount: number;
    /**
     * @deprecated use serverCapacity.maxMonitoredItems and serverCapacity.maxMonitoredItemsPerSubscription instead
     */
    protected static get maxMonitoredItemCount(): number;
    static registry: ObjectRegistry;
    publishEngine?: IServerSidePublishEngine;
    id: number;
    priority: number;
    /**
     * the Subscription publishing interval
     * @default 1000
     */
    publishingInterval: number;
    /**
     * The keep alive count defines how many times the publish interval need to
     * expires without having notifications available before the server send an
     * empty message.
     * OPCUA Spec says: a value of 0 is invalid.
     * @default 10
     *
     */
    maxKeepAliveCount: number;
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
    lifeTimeCount: number;
    /**
     * The maximum number of notifications that the Client wishes to receive in a
     * single Publish response. A value of zero indicates that there is no limit.
     * The number of notifications per Publish is the sum of monitoredItems in the
     * DataChangeNotification and events in the EventNotificationList.
     *
     * @property maxNotificationsPerPublish
     * @default 0
     */
    maxNotificationsPerPublish: number;
    publishingEnabled: boolean;
    subscriptionDiagnostics: SubscriptionDiagnosticsDataTypePriv;
    publishIntervalCount: number;
    /**
     *  number of monitored Item
     */
    monitoredItemIdCounter: number;
    private _state;
    set state(value: SubscriptionState);
    get state(): SubscriptionState;
    messageSent: boolean;
    $session?: ServerSession;
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
    maxNotificationMessageSizeOverride: number;
    get maxNotificationMessageSize(): number;
    /**
     * Snapshot of the identity of the Session that owns this Subscription. It is retained when the
     * Subscription loses its Session (e.g. when it is moved to the orphan publish engine after a
     * Session timeout) so that a later TransferSubscriptions request can still be validated against
     * the original owner as required by OPC UA Part 4 §5.13.7.
     */
    $transferSessionIdentity?: ITransferSessionIdentity;
    get sessionId(): NodeId;
    get maxWhereClauseParameters(): UInt32 | undefined;
    get maxSelectClauseParameters(): UInt32 | undefined;
    get currentLifetimeCount(): number;
    get currentKeepAliveCount(): number;
    private _life_time_counter;
    protected _keep_alive_counter: number;
    _pending_notifications: Queue<InternalNotification>;
    private _sent_notification_messages;
    private readonly _sequence_number_generator;
    private readonly monitoredItems;
    private timerId;
    private _hasUncollectedMonitoredItemNotifications;
    private globalCounter;
    private serverCapabilities;
    constructor(options: SubscriptionOptions);
    getSessionId(): NodeId;
    toString(): string;
    toJSON(): Record<string, string | number | boolean>;
    /**
     * modify subscription parameters
     * @param param
     */
    modify(param: ModifySubscriptionParameters): void;
    /**
     * set publishing mode
     * @param publishingEnabled
     */
    setPublishingMode(publishingEnabled: boolean): StatusCode;
    /**
     * @private
     */
    get keepAliveCounterHasExpired(): boolean;
    /**
     * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
     * the CreateSubscription Service( 5.13.2).
     * @private
     */
    resetLifeTimeCounter(): void;
    /**
     * @private
     */
    increaseLifeTimeCounter(): void;
    /**
     *  True if the subscription life time has expired.
     *
     */
    get lifeTimeHasExpired(): boolean;
    /**
     * number of milliseconds before this subscription times out (lifeTimeHasExpired === true);
     */
    get timeToExpiration(): number;
    get timeToKeepAlive(): number;
    /**
     * Terminates the subscription.
     * Calling this method will also remove any monitored items.
     *
     */
    terminate(): void;
    setTriggering(triggeringItemId: number, linksToAdd: number[] | null, linksToRemove: number[] | null): {
        statusCode: StatusCode;
        addResults: StatusCode[];
        removeResults: StatusCode[];
    };
    dispose(): void;
    get aborted(): boolean;
    /**
     * number of pending notifications
     */
    get pendingNotificationsCount(): number;
    /**
     * is 'true' if there are pending notifications for this subscription. (i.e moreNotifications)
     */
    get hasPendingNotifications(): boolean;
    /**
     * number of sent notifications
     */
    get sentNotificationMessageCount(): number;
    /**
     * @internal
     */
    _flushSentNotifications(): NotificationMessage[];
    /**
     * number of monitored items handled by this subscription
     */
    get monitoredItemCount(): number;
    /**
     * number of disabled monitored items.
     */
    get disabledMonitoredItemCount(): number;
    /**
     * The number of unacknowledged messages saved in the republish queue.
     */
    get unacknowledgedMessageCount(): number;
    /**
     * adjust monitored item sampling interval
     *  - an samplingInterval ===0 means that we use a event-base model ( no sampling)
     *  - otherwise the sampling is adjusted
     * @private
     */
    adjustSamplingInterval(samplingInterval: number, node?: IReadAttributeCapable): number;
    /**
     * create a monitored item
     * @param addressSpace - address space
     * @param timestampsToReturn  - the timestamp to return
     * @param monitoredItemCreateRequest - the parameters describing the monitored Item to create
     */
    preCreateMonitoredItem(nodeFinder: INodeFinder, timestampsToReturn: TimestampsToReturn, monitoredItemCreateRequest: MonitoredItemCreateRequest, 
    /** the id the item keeps, when it comes from another thread of the server (TransferSubscriptions) */
    monitoredItemId?: number): InternalCreateMonitoredItemResult;
    applyOnMonitoredItem(functor: (monitoredItem: MonitoredItem) => Promise<void>): Promise<void>;
    postCreateMonitoredItem(monitoredItem: MonitoredItem, monitoredItemCreateRequest: MonitoredItemCreateRequest, _createResult: MonitoredItemCreateResult): void;
    createMonitoredItem(nodeFinder: INodeFinder, timestampsToReturn: TimestampsToReturn, monitoredItemCreateRequest: MonitoredItemCreateRequest): Promise<MonitoredItemCreateResult>;
    /**
     * get a monitoredItem by Id.
     * @param monitoredItemId : the id of the monitored item to get.
     * @return the monitored item matching monitoredItemId
     */
    getMonitoredItem(monitoredItemId: number): MonitoredItem | null;
    /**
     * remove a monitored Item from the subscription.
     * @param monitoredItemId : the id of the monitored item to get.
     */
    removeMonitoredItem(monitoredItemId: number): StatusCode;
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
    removeMonitoredItems(monitoredItemIds: number[]): StatusCode[];
    /** everything removing a monitored item does, except purging its pending notifications */
    private _detachMonitoredItem;
    /**
     * rue if monitored Item have uncollected Notifications
     */
    get hasUncollectedMonitoredItemNotifications(): boolean;
    get subscriptionId(): number;
    getMessageForSequenceNumber(sequenceNumber: number): NotificationMessage | null;
    /**
     * returns true if the notification has expired
     * @param notification
     */
    notificationHasExpired(notification: {
        start_tick: number;
    }): boolean;
    /**
     *  returns in an array the sequence numbers of the notifications that have been sent
     *  and that haven't been acknowledged yet.
     */
    /** what another thread of the server needs to carry on this subscription (see continueFrom) */
    exportTransferState(): SubscriptionTransferState;
    /**
     * the data changes and events of its items not published yet, taken out of this subscription: they go
     * with it to the session of another thread, whose first Publish carries them (requeueNotifications)
     */
    takePendingNotifications(): {
        monitoredItemId: number;
        notification: QueueItem;
    }[];
    /** the notifications another thread took (takePendingNotifications), to publish as if collected here */
    requeueNotifications(notifications: {
        monitoredItemId: number;
        notification: QueueItem;
    }[]): void;
    /** a subscription carried over from another thread: its sequence numbers and the messages not acknowledged */
    continueFrom(nextSequenceNumber: number, sentNotificationMessages: NotificationMessage[]): void;
    getAvailableSequenceNumbers(): number[];
    /**
     * acknowledges a notification identified by its sequence number
     */
    acknowledgeNotification(sequenceNumber: number): StatusCode;
    /**
     * getMonitoredItems is used to get information about monitored items of a subscription.Its intended
     * use is defined in Part 4. This method is the implementation of the Standard OPCUA GetMonitoredItems Method.
     * from spec:
     * This method can be used to get the  list of monitored items in a subscription if CreateMonitoredItems
     * failed due to a network interruption and the client does not know if the creation succeeded in the server.
     *
     */
    getMonitoredItems(): GetMonitoredItemsResult;
    /**
     * @private
     */
    resendInitialValues(): Promise<void>;
    /**
     * @private
     */
    notifyTransfer(): void;
    /**
     *
     *  the server invokes the resetLifeTimeAndKeepAliveCounters method of the subscription
     *  when the server  has send a Publish Response, so that the subscription
     *  can reset its life time counter.
     *
     * @private
     */
    resetLifeTimeAndKeepAliveCounters(): void;
    private _updateCounters;
    /**
     *  _publish_pending_notifications send a "notification" event:
     *
     * @private
     *
     * precondition
     *     - pendingPublishRequestCount > 0
     */
    _publish_pending_notifications(): void;
    process_subscription(): void;
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
    private _flushRemainingNotifications;
    private _process_keepAlive;
    private _stop_timer;
    private _start_timer;
    private _get_future_sequence_number;
    get futureSequenceNumber(): number;
    private _get_next_sequence_number;
    get nextSequenceNumber(): number;
    /**
     * @private
     */
    private _tick;
    /**
     * @private
     */
    private _sendKeepAliveResponse;
    /**
     * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
     * the CreateSubscription Service( 5.13.2).
     * @private
     */
    private resetKeepAliveCounter;
    /**
     * @private
     */
    private increaseKeepAliveCounter;
    /**
     * @private
     */
    private _addNotificationMessage;
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
    private _degradeIfUndeliverable;
    /**
     * @internal
     * @param monitoredItemId
     */
    private _removePendingNotificationsFor;
    /**
     * Extract the next Notification that is ready to be sent to the client.
     * @return the Notification to send._pending_notifications
     */
    private _popNotificationToSend;
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
    private discardOldSentNotifications;
    /**
     * @param timestampsToReturn
     * @param monitoredItemCreateRequest
     * @param node
     * @private
     */
    private _createMonitoredItemStep2;
    /**
     *
     * @param monitoredItem
     * @param monitoredItemCreateRequest
     * @private
     */
    _createMonitoredItemStep3(monitoredItem: MonitoredItem | null, monitoredItemCreateRequest: MonitoredItemCreateRequest): void;
    _harvestMonitoredItems(): void;
}
export {};
//# sourceMappingURL=server_subscription.d.ts.map