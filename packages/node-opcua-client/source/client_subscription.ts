/**
 * @module bode-opcua-client
 */
import * as async from "async";
import chalk from "chalk";
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";
import { ErrorCallback } from "node-opcua-secure-channel";
import { TimestampsToReturn } from "node-opcua-service-read";
import {
    CreateMonitoredItemsRequest, CreateMonitoredItemsResponse,
    CreateSubscriptionRequest, CreateSubscriptionResponse,
    DataChangeNotification, EventNotificationList,
    MonitoredItemCreateRequest, MonitoredItemCreateRequestOptions, NotificationData,
    NotificationMessage, StatusChangeNotification
} from "node-opcua-service-subscription";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import * as utils from "node-opcua-utils";
import * as _ from "underscore";
import { ClientMonitoredItem } from "./client_monitored_item";
import { ClientMonitoredItemBase } from "./client_monitored_item_base";
import { ClientMonitoredItemGroup } from "./client_monitored_item_group";
import { ClientSession, ClientSessionImpl, SubscriptionId } from "./client_session";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = debugLog;

export interface ClientSubscriptionOptions {
    requestedPublishingInterval?: number;
    requestedLifetimeCount?: number;
    requestedMaxKeepAliveCount?: number;
    maxNotificationsPerPublish?: number;
    publishingEnabled?: boolean;
    priority?: number;
}

type ClientHandle = number;

const PENDING_SUBSCRIPTON_ID = 0xC0CAC01A;
const TERMINTATED_SUBSCRIPTION_ID = 0xC0CAC01B;
const TERMINATING_SUBSCRIPTION_ID = 0xC0CAC01C;

/**
 * a object to manage a subscription on the client side.
 *
 * @class ClientSubscription
 * @extends EventEmitter
 * events:
 *    "started",     callback(subscriptionId)  : the subscription has been initiated
 *    "terminated"                             : the subscription has been deleted
 *    "error",                                 : the subscription has received an error
 *    "keepalive",                             : the subscription has received a keep alive message from the server
 *    "received_notifications",                : the subscription has received one or more notification
 *
 *  @constructor
 */
export class ClientSubscription extends EventEmitter {

    public subscriptionId: SubscriptionId;
    public publishingInterval: number;
    public lifetimeCount: number;
    public maxKeepAliveCount: number;
    public maxNotificationsPerPublish: number;
    public publishingEnabled: boolean;
    public priority: number;
    public monitoredItems: { [key: string]: ClientMonitoredItem };
    public timeoutHint = 0;
    public publishEngine: ClientSidePublishEngine;

    private lastSequenceNumber: number;
    private lastRequestSentTime: Date;
    private _nextClientHandle = 0;
    private hasTimedOut: boolean;

    constructor(session: ClientSessionImpl, options: ClientSubscriptionOptions) {

        super();

        assert(session instanceof ClientSessionImpl);

        this.publishEngine = session.getPublishEngine();

        this.lastSequenceNumber = -1;

        options = options || {};
        options.requestedPublishingInterval = options.requestedPublishingInterval || 100;
        options.requestedLifetimeCount = options.requestedLifetimeCount || 60;
        options.requestedMaxKeepAliveCount = options.requestedMaxKeepAliveCount || 10;

        options.maxNotificationsPerPublish = utils.isNullOrUndefined(options.maxNotificationsPerPublish)
            ? 0
            : options.maxNotificationsPerPublish;

        options.publishingEnabled = !!options.publishingEnabled;
        options.priority = options.priority || 1;

        this.publishingInterval = options.requestedPublishingInterval;
        this.lifetimeCount = options.requestedLifetimeCount;
        this.maxKeepAliveCount = options.requestedMaxKeepAliveCount;
        this.maxNotificationsPerPublish = options.maxNotificationsPerPublish || 0;
        this.publishingEnabled = options.publishingEnabled;
        this.priority = options.priority;

        this.subscriptionId = PENDING_SUBSCRIPTON_ID;

        this._nextClientHandle = 0;
        this.monitoredItems = {};

        this.lastRequestSentTime = new Date(1, 1, 1970);

        /**
         * set to True when the server has notified us that this sbuscription has timed out
         * ( maxLifeCounter x published interval without being able to process a PublishRequest
         * @property hasTimedOut
         * @type {boolean}
         */
        this.hasTimedOut = false;

        setImmediate(() => {

            this.__create_subscription((err?: Error) => {

                if (!err) {

                    setImmediate(() => {
                        /**
                         * notify the observers that the subscription has now started
                         * @event started
                         */
                        this.emit("started", this.subscriptionId);
                    });
                }
            });
        });
    }

    /**
     * the associated session
     * @property session
     * @type {ClientSession}
     */
    get session() {
        return this.publishEngine.session;
    }

    /**
     * @method terminate
     * @param callback
     *
     */
    public async terminate(): Promise<void>;

    public terminate(callback: ErrorCallback): void;

    public terminate(...args: any[]): any {

        const callback = args[0];
        assert(_.isFunction(callback), "expecting a callback function");

        if (this.subscriptionId === TERMINTATED_SUBSCRIPTION_ID
            || this.subscriptionId === TERMINATING_SUBSCRIPTION_ID) {
            // already terminated... just ignore
            return callback(new Error("Already Terminated"));
        }

        if (_.isFinite(this.subscriptionId)) {

            const subscriptionId = this.subscriptionId;
            this.subscriptionId = TERMINATING_SUBSCRIPTION_ID;
            this.publishEngine.unregisterSubscription(subscriptionId);

            if (!this.session) {
                return this._terminate_step2(callback);
            }

            this.session.deleteSubscriptions({
                subscriptionIds: [subscriptionId]
            }, (err?: Error) => {

                if (err) {
                    /**
                     * notify the observers that an error has occurred
                     * @event internal_error
                     * @param {Error} err the error
                     */
                    this.emit("internal_error", err);
                }
                this._terminate_step2(callback);
            });

        } else {
            assert(this.subscriptionId === PENDING_SUBSCRIPTON_ID);
            this._terminate_step2(callback);
        }
    }

    /**
     * @method nextClientHandle
     */
    public nextClientHandle() {
        this._nextClientHandle += 1;
        return this._nextClientHandle;
    }

    /**
     * add a monitor item to the subscription
     *
     * @method monitor
     * @async
     * @param itemToMonitor                        {ReadValueId}
     * @param itemToMonitor.nodeId                 {NodeId}
     * @param itemToMonitor.attributeId            {AttributeId}
     * @param itemToMonitor.indexRange             {null|NumericRange}
     * @param itemToMonitor.dataEncoding
     * @param requestedParameters                  {MonitoringParameters}
     * @param requestedParameters.clientHandle     {IntegerId}
     * @param requestedParameters.samplingInterval {Duration}
     * @param requestedParameters.filter           {ExtensionObject|null} EventFilter/DataChangeFilter
     * @param requestedParameters.queueSize        {Counter}
     * @param requestedParameters.discardOldest    {Boolean}
     * @param timestampsToReturn                   {TimestampsToReturn} //{TimestampsToReturnId}
     * @param  [done]                              {Function} optional done callback
     * @return {ClientMonitoredItem}
     *
     *
     * Monitoring a simple Value Change
     * ---------------------------------
     *
     * @example:
     *
     *   clientSubscription.monitor(
     *     // itemToMonitor:
     *     {
     *       nodeId: "ns=0;i=2258",
     *       attributeId: AttributeIds.Value,
     *       indexRange: null,
     *       dataEncoding: { namespaceIndex: 0, name: null }
     *     },
     *     // requestedParameters:
     *     {
     *        samplingInterval: 3000,
     *        filter: null,
     *        queueSize: 1,
     *        discardOldest: true
     *     },
     *     TimestampsToReturn.Neither
     *   );
     *
     * Monitoring a Value Change With a DataChange  Filter
     * ---------------------------------------------------
     *
     * options.trigger       {DataChangeTrigger} {Status|StatusValue|StatusValueTimestamp}
     * options.deadbandType  {DeadbandType}      {None|Absolute|Percent}
     * options.deadbandValue {Double}
     * @example:
     *
     *   clientSubscription.monitor(
     *     // itemToMonitor:
     *     {
     *       nodeId: "ns=0;i=2258",
     *       attributeId: AttributeIds.Value,
     *     },
     *     // requestedParameters:
     *     {
     *        samplingInterval: 3000,
     *        filter: new DataChangeFilter({
     *             trigger: DataChangeTrigger.StatusValue,
     *             deadbandType: DeadBandType.Absolute,
     *             deadbandValue: 0.1
     *        }),
     *        queueSize: 1,
     *        discardOldest: true
     *     },
     *     TimestampsToReturn.Neither
     *   );
     *
     *
     * Monitoring an Event
     * -------------------
     *
     *  If the monitor attributeId is EventNotifier then the filter must be specified
     *
     * @example:
     *
     *  var filter =  new EventFilter({
     *    selectClauses: [
     *             { browsePath: [ {name: 'ActiveState'  }, {name: 'id'}  ]},
     *             { browsePath: [ {name: 'ConditionName'}                ]}
     *    ],
     *    whereClause: []
     *  });
     *
     *  clientSubscription.monitor(
     *     // itemToMonitor:
     *     {
     *       nodeId: "ns=0;i=2258",
     *       attributeId: AttributeIds.EventNotifier,
     *       indexRange: null,
     *       dataEncoding: { namespaceIndex: 0, name: null }
     *     },
     *     // requestedParameters:
     *     {
     *        samplingInterval: 3000,
     *
     *        filter: filter,
     *
     *        queueSize: 1,
     *        discardOldest: true
     *     },
     *     TimestampsToReturn.Neither
     *   );
     *
     *
     *
     *
     *
     *
     */
    public monitor(
        itemToMonitor: any,
        requestedParameters: any,
        timestampsToReturn: TimestampsToReturn,
        done?: (err: Error | null, monitoredItem?: ClientMonitoredItemBase) => void
    ) {

        assert(done === undefined || _.isFunction(done));

        itemToMonitor.nodeId = resolveNodeId(itemToMonitor.nodeId);
        const monitoredItem = new ClientMonitoredItem(this, itemToMonitor, requestedParameters, timestampsToReturn);

        this._wait_for_subscription_to_be_ready((err?: Error) => {
            if (err) {
                return done && done(err);
            }
            monitoredItem._monitor((err1?: Error) => {
                if (err1) {
                    return done && done(err1);
                }
                if (done) {
                    done(err1 ? err1 : null, monitoredItem);
                }
            });
        });
        return monitoredItem;
    }

    /**
     * @method monitorItems
     * @param itemsToMonitor
     * @param requestedParameters
     * @param timestampsToReturn
     * @param done
     */
    public monitorItems(
        itemsToMonitor: any[],
        requestedParameters: {},
        timestampsToReturn: TimestampsToReturn,
        done?: (err: Error | null, monitoredItemGroup?: ClientMonitoredItemGroup) => void
    ) {
        // Try to resolve the nodeId and fail fast if we can't.
        itemsToMonitor.forEach((itemToMonitor) => {
            itemToMonitor.nodeId = resolveNodeId(itemToMonitor.nodeId);
        });

        const monitoredItemGroup = new ClientMonitoredItemGroup(
            this, itemsToMonitor, requestedParameters, timestampsToReturn);

        this._wait_for_subscription_to_be_ready((err?: Error) => {
            if (err) {
                return done && done(err);
            }
            monitoredItemGroup._monitor((err1?: Error) => {
                if (err1) {
                    return done && done(err1);
                }
                return done && done(err1 ? err1 : null, monitoredItemGroup);
            });
        });
        return monitoredItemGroup;
    }

    public isActive(): boolean {
        return typeof this.subscriptionId !== "string";
    }

    public _delete_monitored_items(
        monitoredItems: ClientMonitoredItemBase[],
        callback: ErrorCallback
    ) {

        assert(_.isFunction(callback));
        assert(_.isArray(monitoredItems));

        assert(this.isActive());

        for (const monitoredItem of monitoredItems) {
            this._remove(monitoredItem);
        }

        this.session.deleteMonitoredItems({
            monitoredItemIds: monitoredItems.map((monitoredItem) => monitoredItem.monitoredItemId),
            subscriptionId: this.subscriptionId,
        }, (err?: Error) => {
            callback(err);
        });
    }

    public setPublishingMode(publishingEnabled: boolean, callback: ErrorCallback) {

        assert(_.isFunction(callback));

        this.session.setPublishingMode(
            publishingEnabled,
            this.subscriptionId, (err: Error | null, statusCode?: StatusCode) => {
                if (err) {
                    return callback(err);
                }
                if (!statusCode) {
                    return callback(new Error("Internal Error"));
                }

                if (statusCode !== StatusCodes.Good) {
                    return callback(new Error("Cannot setPublishingMode err=" + statusCode.toString()));
                }
                callback();
            });
    }

    /**
     *  utility function to recreate new subscription
     *  @method recreateSubscriptionAndMonitoredItem
     */
    public recreateSubscriptionAndMonitoredItem(callback: ErrorCallback) {

        debugLog("ClientSubscription#recreateSubscriptionAndMonitoredItem");

        const oldMonitoredItems = this.monitoredItems;

        this.publishEngine.unregisterSubscription(this.subscriptionId);

        async.series([

            this.__create_subscription.bind(this),

            (innerCallback: ErrorCallback) => {

                const test = this.publishEngine.getSubscription(this.subscriptionId);
                assert(test === this);

                // re-create monitored items

                const itemsToCreate: MonitoredItemCreateRequestOptions[] = [];

                _.forEach(oldMonitoredItems, (monitoredItem: ClientMonitoredItem /*, clientHandle*/) => {
                    assert(monitoredItem.monitoringParameters.clientHandle > 0);
                    itemsToCreate.push({
                        itemToMonitor: monitoredItem.itemToMonitor,
                        monitoringMode: monitoredItem.monitoringMode,
                        requestedParameters: monitoredItem.monitoringParameters
                    });
                });

                const createMonitorItemsRequest = new CreateMonitoredItemsRequest({
                    itemsToCreate,
                    subscriptionId: this.subscriptionId,
                    timestampsToReturn: TimestampsToReturn.Both, // this.timestampsToReturn,
                });

                this.session.createMonitoredItems(
                    createMonitorItemsRequest,
                    (err: Error | null, response?: CreateMonitoredItemsResponse) => {

                        if (err) {
                            return innerCallback(err);
                        }
                        if (!response) {
                            return innerCallback(new Error("Internal Error"));
                        }
                        assert(response instanceof CreateMonitoredItemsResponse);

                        const monitoredItemResults = response.results || [];

                        monitoredItemResults.forEach((monitoredItemResult, index) => {

                            const itemToCreate = itemsToCreate[index];
                            if (!itemToCreate || !itemToCreate.requestedParameters) {
                                throw new Error("Internal Error");
                            }
                            const clientHandle = itemToCreate.requestedParameters.clientHandle;
                            if (!clientHandle) {
                                throw new Error("Internal Error");
                            }
                            const monitoredItem = this.monitoredItems[clientHandle];

                            if (monitoredItemResult.statusCode === StatusCodes.Good) {

                                monitoredItem.result = monitoredItemResult;
                                monitoredItem.monitoredItemId = monitoredItemResult.monitoredItemId;
                                monitoredItem.monitoringParameters.samplingInterval =
                                    monitoredItemResult.revisedSamplingInterval;
                                monitoredItem.monitoringParameters.queueSize = monitoredItemResult.revisedQueueSize;
                                monitoredItem.filterResult = monitoredItemResult.filterResult || undefined;

                                // istanbul ignore next
                                if (doDebug) {
                                    debugLog("monitoredItemResult.statusCode = ", monitoredItemResult.toString());
                                }

                            } else {
                                // TODO: what should we do ?
                                debugLog("monitoredItemResult.statusCode = ",
                                    monitoredItemResult.statusCode.toString());
                            }
                        });
                        innerCallback();
                    });

            }

        ], callback);
    }

    public toString(): string {
        let str = "";
        str += "subscriptionId      :" + this.subscriptionId + "\n";
        str += "publishingInterval  :" + this.publishingInterval + "\n";
        str += "lifetimeCsount      :" + this.lifetimeCount + "\n";
        str += "maxKeepAliveCount   :" + this.maxKeepAliveCount + "\n";
        return str;
    }

    public evaluateRemainingLifetime(): number {
        const now = Date.now();
        const timeout = this.publishingInterval * this.lifetimeCount;
        const expiryTime = this.lastRequestSentTime.getTime() + timeout;
        return Math.max(0, (expiryTime - now));
    }

    private __create_subscription(callback: (err?: Error) => void) {

        assert(_.isFunction(callback));

        const session = this.publishEngine.session;

        debugLog(chalk.yellow.bold("ClientSubscription created "));

        const request = new CreateSubscriptionRequest({
            maxNotificationsPerPublish: this.maxNotificationsPerPublish,
            priority: this.priority,
            publishingEnabled: this.publishingEnabled,
            requestedLifetimeCount: this.lifetimeCount,
            requestedMaxKeepAliveCount: this.maxKeepAliveCount,
            requestedPublishingInterval: this.publishingInterval,
        });

        session.createSubscription(request, (err: Error | null, response?: CreateSubscriptionResponse) => {

            if (err) {
                /* istanbul ignore next */
                this.emit("internal_error", err);
                if (callback) {
                    return callback(err);
                }
                return;
            }
            if (!response) {
                return callback(new Error("internal error"));
            }

            this.subscriptionId = response.subscriptionId;
            this.publishingInterval = response.revisedPublishingInterval;
            this.lifetimeCount = response.revisedLifetimeCount;
            this.maxKeepAliveCount = response.revisedMaxKeepAliveCount;

            this.timeoutHint = (this.maxKeepAliveCount + 10) * this.publishingInterval;

            if (doDebug) {
                debugLog(chalk.yellow.bold("registering callback"));
                debugLog(chalk.yellow.bold("publishingInterval               "), this.publishingInterval);
                debugLog(chalk.yellow.bold("lifetimeCount                    "), this.lifetimeCount);
                debugLog(chalk.yellow.bold("maxKeepAliveCount                "), this.maxKeepAliveCount);
                debugLog(chalk.yellow.bold("publish request timeout hint =   "), this.timeoutHint);
                debugLog(chalk.yellow.bold("hasTimedOut                      "), this.hasTimedOut);
            }

            this.publishEngine.registerSubscription(this);

            if (callback) {
                callback();
            }
        });
    }

    private __on_publish_response_DataChangeNotification(notification: DataChangeNotification) {

        assert(notification.schema.name === "DataChangeNotification");

        const monitoredItems = notification.monitoredItems || [];

        for (const monitoredItem of monitoredItems) {

            const monitorItemObj = this.monitoredItems[monitoredItem.clientHandle];
            if (monitorItemObj) {
                if (monitorItemObj.itemToMonitor.attributeId === AttributeIds.EventNotifier) {
                    warningLog(chalk.yellow("Warning"),
                        chalk.cyan(" Server send a DataChangeNotification for an EventNotifier." +
                            " EventNotificationList was expected"));
                    warningLog(chalk.cyan("         the Server may not be fully OPCUA compliant"),
                        chalk.yellow(". This notification will be ignored."));
                } else {
                    monitorItemObj._notify_value_change(monitoredItem.value);
                }
            }
        }

    }

    private __on_publish_response_StatusChangeNotification(notification: StatusChangeNotification) {

        assert(notification.schema.name === "StatusChangeNotification");

        debugLog("Client has received a Status Change Notification ", notification.status.toString());

        if (notification.status === StatusCodes.GoodSubscriptionTransferred) {
            // OPCUA UA Spec 1.0.3 : part 3 - page 82 - 5.13.7 TransferSubscriptions:
            // If the Server transfers the Subscription to the new Session, the Server shall issue
            // a StatusChangeNotification  notificationMessage with the status code
            // Good_SubscriptionTransferred to the old Session.
            debugLog("ClientSubscription#__on_publish_response_StatusChangeNotification : GoodSubscriptionTransferred");
            this.hasTimedOut = true;
            this.terminate(() => { /* empty*/
            });
        }
        if (notification.status === StatusCodes.BadTimeout) {
            // the server tells use that the subscription has timed out ..
            // this mean that this subscription has been closed on the server side and cannot process any
            // new PublishRequest.
            //
            // from Spec OPCUA Version 1.03 Part 4 - 5.13.1.1 Description : Page 69:
            //
            // h. Subscriptions have a lifetime counter that counts the number of consecutive publishing cycles in
            //    which there have been no Publish requests available to send a Publish response for the
            //    Subscription. Any Service call that uses the SubscriptionId or the processing of a Publish
            //    response resets the lifetime counter of this Subscription. When this counter reaches the value
            //    calculated for the lifetime of a Subscription based on the MaxKeepAliveCount parameter in the
            //    CreateSubscription Service (5.13.2), the Subscription is closed. Closing the Subscription causes
            //    its MonitoredItems to be deleted. In addition the Server shall issue a StatusChangeNotification
            //    notificationMessage with the status code Bad_Timeout.
            //
            this.hasTimedOut = true;
            this.terminate(() => { /* empty */
            });
        }
        /**
         * notify the observers that the server has send a status changed notification (such as BadTimeout )
         * @event status_changed
         */
        this.emit("status_changed", notification.status, notification.diagnosticInfo);

    }

    private __on_publish_response_EventNotificationList(notification: EventNotificationList) {

        assert(notification.schema.name === "EventNotificationList");
        const events = notification.events || [];
        for (const event of events) {
            const monitorItemObj = this.monitoredItems[event.clientHandle];
            assert(monitorItemObj, "Expecting a monitored item");
            monitorItemObj._notify_event(event.eventFields || []);
        }
    }

    private onNotificationMessage(notificationMessage: NotificationMessage) {

        this.lastRequestSentTime = new Date(Date.now());

        assert(notificationMessage.hasOwnProperty("sequenceNumber"));

        this.lastSequenceNumber = notificationMessage.sequenceNumber;

        this.emit("raw_notification", notificationMessage);

        const notificationData = notificationMessage.notificationData || [];

        if (notificationData.length === 0) {
            // this is a keep alive message
            debugLog(chalk.yellow("Client : received a keep alive notification from client"));
            /**
             * notify the observers that a keep alive Publish Response has been received from the server.
             * @event keepalive
             */
            this.emit("keepalive");

        } else {

            /**
             * notify the observers that some notifications has been received from the server in  a PublishResponse
             * each modified monitored Item
             * @event  received_notifications
             */
            this.emit("received_notifications", notificationMessage);
            // let publish a global event

            // now process all notifications
            for (const notification of notificationData) {

                if (!notification) { continue; }

                // DataChangeNotification / StatusChangeNotification / EventNotification
                switch (notification.schema.name) {
                    case "DataChangeNotification":
                        // now inform each individual monitored item
                        this.__on_publish_response_DataChangeNotification(notification as DataChangeNotification);
                        break;
                    case "StatusChangeNotification":
                        this.__on_publish_response_StatusChangeNotification(notification as StatusChangeNotification);
                        break;
                    case "EventNotificationList":
                        this.__on_publish_response_EventNotificationList(notification as EventNotificationList);
                        break;
                    default:
                        warningLog(" Invalid notification :", notification.toString());
                }
            }
        }

    }

    private _terminate_step2(callback: (err?: Error) => void) {
        setImmediate(() => {
            /**
             * notify the observers tha the client subscription has terminated
             * @event  terminated
             */
            this.subscriptionId = TERMINTATED_SUBSCRIPTION_ID;
            this.emit("terminated");
            callback();
        });
    }

    private _add_monitored_item(clientHandle: ClientHandle, monitoredItem: ClientMonitoredItem) {

        assert(this.isActive(), "subscription must be active and not terminated");
        assert(monitoredItem.monitoringParameters.clientHandle === clientHandle);
        this.monitoredItems[clientHandle] = monitoredItem;

        /**
         * notify the observers that a new monitored item has been added to the subscription.
         * @event item_added
         * @param {MonitoredItem} the monitored item.
         */
        this.emit("item_added", monitoredItem);
    }

    private _wait_for_subscription_to_be_ready(done: ErrorCallback) {

        let _watchDogCount = 0;

        const waitForSubscriptionAndMonitor = () => {

            _watchDogCount++;

            if (this.subscriptionId === PENDING_SUBSCRIPTON_ID) {
                // the subscriptionID is not yet known because the server hasn't replied yet
                // let postpone this call, a little bit, to let things happen
                setImmediate(waitForSubscriptionAndMonitor);

            } else if (this.subscriptionId === TERMINTATED_SUBSCRIPTION_ID) {
                // the subscription has been terminated in the meantime
                // this indicates a potential issue in the code using this api.
                if (_.isFunction(done)) {
                    done(new Error("subscription has been deleted"));
                }
            } else {
                done();
            }
        };

        setImmediate(waitForSubscriptionAndMonitor);

    }

    private _remove(monitoredItem: ClientMonitoredItemBase) {
        const clientHandle = monitoredItem.monitoringParameters.clientHandle;
        assert(clientHandle !== 0);
        assert(this.monitoredItems.hasOwnProperty(clientHandle));
        monitoredItem.removeAllListeners();
        delete this.monitoredItems[clientHandle];
    }

    private _delete_monitored_item(
        monitoredItem: ClientMonitoredItem,
        callback: ErrorCallback) {
        this._delete_monitored_items([monitoredItem], callback);
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = {multiArgs: false};
import { ClientSidePublishEngine } from "./client_publish_engine";

ClientSubscription.prototype.setPublishingMode = thenify.withCallback(ClientSubscription.prototype.setPublishingMode);
// ClientSubscription.prototype.monitor           = thenify.withCallback(ClientSubscription.prototype.monitor);
// ClientSubscription.prototype.monitorItems      = thenify.withCallback(ClientSubscription.prototype.monitorItems);
ClientSubscription.prototype.recreateSubscriptionAndMonitoredItem =
        thenify.withCallback(ClientSubscription.prototype.recreateSubscriptionAndMonitoredItem);
ClientSubscription.prototype.terminate = thenify.withCallback(ClientSubscription.prototype.terminate);
