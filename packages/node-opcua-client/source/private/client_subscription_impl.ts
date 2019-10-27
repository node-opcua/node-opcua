/**
 * @module node-opcua-client-private
 */
// tslint:disable:unified-signatures
import * as async from "async";
import * as chalk from "chalk";
import { EventEmitter } from "events";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { resolveNodeId } from "node-opcua-nodeid";

import { ReadValueIdOptions, TimestampsToReturn } from "node-opcua-service-read";
import {
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsResponse,
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
    DataChangeNotification,
    DeleteMonitoredItemsResponse,
    DeleteSubscriptionsResponse,
    EventNotificationList,
    MonitoredItemCreateRequestOptions,
    MonitoredItemCreateResult,
    MonitoringParametersOptions,
    NotificationMessage,
    StatusChangeNotification
} from "node-opcua-service-subscription";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import * as utils from "node-opcua-utils";

import { ClientMonitoredItemBase } from "../client_monitored_item_base";
import { ClientMonitoredItemGroup } from "../client_monitored_item_group";
import { ClientSession, MonitoredItemData, SubscriptionId } from "../client_session";
import {
    ClientHandle,
    ClientMonitoredItemBaseMap,
    ClientSubscription,
    ClientSubscriptionOptions
} from "../client_subscription";
import { Callback, ErrorCallback } from "../common";
import { ClientMonitoredItemGroupImpl } from "./client_monitored_item_group_impl";
import { ClientMonitoredItemImpl } from "./client_monitored_item_impl";
import { ClientSidePublishEngine } from "./client_publish_engine";
import { ClientSessionImpl } from "./client_session_impl";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = debugLog;

const PENDING_SUBSCRIPTON_ID = 0xC0CAC01A;
const TERMINTATED_SUBSCRIPTION_ID = 0xC0CAC01B;
const TERMINATING_SUBSCRIPTION_ID = 0xC0CAC01C;

export class ClientSubscriptionImpl extends EventEmitter implements ClientSubscription {

    /**
     * the associated session
     * @property session
     * @type {ClientSession}
     */
    public get session(): ClientSessionImpl {
        assert(this.publishEngine.session, "expecting a valid session here");
        return this.publishEngine.session! as ClientSessionImpl;
    }
    public get hasSession(): boolean {
        return !!this.publishEngine.session;
    }
    public get isActive(): boolean {
        return !(this.subscriptionId === PENDING_SUBSCRIPTON_ID
            || this.subscriptionId === TERMINTATED_SUBSCRIPTION_ID
            || this.subscriptionId === TERMINATING_SUBSCRIPTION_ID);
    }

    public subscriptionId: SubscriptionId;
    public publishingInterval: number;
    public lifetimeCount: number;
    public maxKeepAliveCount: number;
    public maxNotificationsPerPublish: number;
    public publishingEnabled: boolean;
    public priority: number;
    public monitoredItems: ClientMonitoredItemBaseMap;

    public timeoutHint = 0;
    public publishEngine: ClientSidePublishEngine;

    private lastSequenceNumber: number;
    private lastRequestSentTime: Date;
    private _nextClientHandle = 0;
    private hasTimedOut: boolean;
    private pendingMonitoredItemsToRegister: ClientMonitoredItemBaseMap;

    constructor(session: ClientSession, options: ClientSubscriptionOptions) {

        super();

        const sessionImpl = session as ClientSessionImpl;
        this.publishEngine = sessionImpl.getPublishEngine();

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
         * set to True when the server has notified us that this subscription has timed out
         * ( maxLifeCounter x published interval without being able to process a PublishRequest
         * @property hasTimedOut
         * @type {boolean}
         */
        this.hasTimedOut = false;

        this.pendingMonitoredItemsToRegister = {};

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

            if (!this.hasSession) {
                return this._terminate_step2(callback);
            }
            const session = this.session;
            if (!session) {
                return callback(new Error("no session"));
            }
            session.deleteSubscriptions({
                subscriptionIds: [subscriptionId]
            }, (err: Error | null, response?: DeleteSubscriptionsResponse) => {
                if (response && response!.results![0] !== StatusCodes.Good) {
                    debugLog("warning: deleteSubscription returned ", response.results);
                }
                if (err) {
                    /**
                     * notify the observers that an error has occurred
                     * @event internal_error
                     * @param err the error
                     */
                    this.emit("internal_error", err);
                }
                this._terminate_step2(callback);
            });

        } else {
            debugLog("subscriptionId is not value ", this.subscriptionId);
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

    public async monitor(
        itemToMonitor: ReadValueIdOptions,
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ): Promise<ClientMonitoredItemBase>;
    public monitor(
        itemToMonitor: ReadValueIdOptions,
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        done: Callback<ClientMonitoredItemBase>
    ): void;
    public monitor(...args: any[]): any {

        const itemToMonitor = args[0] as ReadValueIdOptions;
        const requestedParameters = args[1] as MonitoringParametersOptions;
        const timestampsToReturn = args[2] as TimestampsToReturn;
        const done = args[3] as Callback<ClientMonitoredItemBase>;

        assert(_.isFunction(done), "expecting a function here");

        itemToMonitor.nodeId = resolveNodeId(itemToMonitor.nodeId!);

        const monitoredItem = new ClientMonitoredItemImpl(this, itemToMonitor, requestedParameters, timestampsToReturn);

        this._wait_for_subscription_to_be_ready((err?: Error) => {
            if (err) {
                return done(err);
            }
            monitoredItem._monitor((err1?: Error) => {
                if (err1) {
                    return done && done(err1);
                }
                done(err1 ? err1 : null, monitoredItem);
            });
        });
        // xx return monitoredItem;
    }

    public monitorItems(
        itemsToMonitor: ReadValueIdOptions[],
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn
    ): Promise<ClientMonitoredItemGroup>;

    public monitorItems(
        itemsToMonitor: ReadValueIdOptions[],
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        done: Callback<ClientMonitoredItemGroup>
    ): void;
    public monitorItems(...args: any[]): any {
        const itemsToMonitor = args[0] as ReadValueIdOptions[];
        const requestedParameters = args[1] as ReadValueIdOptions;
        const timestampsToReturn = args[2] as TimestampsToReturn;
        const done = args[3] as Callback<ClientMonitoredItemGroup>;

        const monitoredItemGroup = new ClientMonitoredItemGroupImpl(
            this, itemsToMonitor, requestedParameters, timestampsToReturn);

        this._wait_for_subscription_to_be_ready((err?: Error) => {
            if (err) {
                return done(err);
            }
            monitoredItemGroup._monitor((err1?: Error) => {
                if (err1) {
                    return done && done(err1);
                }
                done(err1!, monitoredItemGroup);
            });
        });
    }

    public _delete_monitored_items(
        monitoredItems: ClientMonitoredItemBase[],
        callback: ErrorCallback
    ) {

        assert(_.isFunction(callback));
        assert(_.isArray(monitoredItems));

        assert(this.isActive);

        for (const monitoredItem of monitoredItems) {
            this._remove(monitoredItem);
        }
        const session = this.session as ClientSessionImpl;
        session.deleteMonitoredItems({
            monitoredItemIds: monitoredItems.map((monitoredItem) => monitoredItem.monitoredItemId),
            subscriptionId: this.subscriptionId,
        }, (err: Error | null, response?: DeleteMonitoredItemsResponse) => {
            callback(err!);
        });
    }

    public async setPublishingMode(publishingEnabled: boolean): Promise<StatusCode>;
    public setPublishingMode(publishingEnabled: boolean, callback: Callback<StatusCode>): void;
    public setPublishingMode(...args: any[]): any {
        const publishingEnabled = args[0] as boolean;
        const callback = args[1] as Callback<StatusCode>;
        assert(_.isFunction(callback));

        const session = this.session as ClientSessionImpl;
        if (!session) {
            return callback(new Error("no session"));
        }
        const subscriptionId = this.subscriptionId as SubscriptionId;
        session.setPublishingMode(
            publishingEnabled,
            subscriptionId, (err: Error | null, statusCode?: StatusCode) => {
                if (err) {
                    return callback(err);
                }
                if (!statusCode) {
                    return callback(new Error("Internal Error"));
                }
                if (statusCode !== StatusCodes.Good) {
                    return callback(null, statusCode);
                }
                callback(null, StatusCodes.Good);
            });
    }

    public getMonitoredItems(): Promise<MonitoredItemData>;
    public getMonitoredItems(callback: Callback<MonitoredItemData>): void;
    public getMonitoredItems(...args: any[]): any {
        this.session.getMonitoredItems(this.subscriptionId, args[0]);
    }

    //
    // /**
    //  * @internal
    //  * @param itemsToMonitor
    //  * @param innerCallback
    //  * @private
    //  */
    // public _createMonitoredItem(itemsToMonitor: ClientMonitoredItemBase[], innerCallback: ErrorCallback) {
    //
    //     const itemsToCreate: MonitoredItemCreateRequestOptions[] = [];
    //
    //     _.forEach(itemsToMonitor, (monitoredItem: ClientMonitoredItemBase /*, clientHandle*/) => {
    //         assert(monitoredItem.monitoringParameters.clientHandle > 0);
    //         itemsToCreate.push({
    //             itemToMonitor: monitoredItem.itemToMonitor,
    //             monitoringMode: monitoredItem.monitoringMode,
    //             requestedParameters: monitoredItem.monitoringParameters
    //         });
    //     });
    //
    //     const createMonitorItemsRequest = new CreateMonitoredItemsRequest({
    //         itemsToCreate,
    //         subscriptionId: this.subscriptionId,
    //         timestampsToReturn: TimestampsToReturn.Both
    //     });
    //
    //     const session = this.session;
    //     if (!session) {
    //         return innerCallback(new Error("no session"));
    //     }
    //     session.createMonitoredItems(
    //         createMonitorItemsRequest,
    //         (err: Error | null, response?: CreateMonitoredItemsResponse) => {
    //
    //             if (err) {
    //                 return innerCallback(err);
    //             }
    //             if (!response) {
    //                 return innerCallback(new Error("Internal Error"));
    //             }
    //             const monitoredItemResults = response.results || [];
    //
    //             monitoredItemResults.forEach((monitoredItemResult: MonitoredItemCreateResult, index: number) => {
    //
    //                 const itemToCreate = itemsToCreate[index];
    //                 if (!itemToCreate || !itemToCreate.requestedParameters) {
    //                     throw new Error("Internal Error");
    //                 }
    //                 const clientHandle = itemToCreate.requestedParameters.clientHandle;
    //                 if (!clientHandle) {
    //                     throw new Error("Internal Error");
    //                 }
    //                 const monitoredItem = this.monitoredItems[clientHandle];
    //
    //                 if (monitoredItemResult.statusCode === StatusCodes.Good) {
    //
    //                     monitoredItem.result = monitoredItemResult;
    //                     monitoredItem.monitoredItemId = monitoredItemResult.monitoredItemId;
    //                     monitoredItem.monitoringParameters.samplingInterval =
    //                         monitoredItemResult.revisedSamplingInterval;
    //                     monitoredItem.monitoringParameters.queueSize = monitoredItemResult.revisedQueueSize;
    //                     monitoredItem.filterResult = monitoredItemResult.filterResult || undefined;
    //
    //                     // istanbul ignore next
    //                     if (doDebug) {
    //                         debugLog("monitoredItemResult.statusCode = ", monitoredItemResult.toString());
    //                     }
    //
    //                 } else {
    //                     // TODO: what should we do ?
    //                     debugLog("monitoredItemResult.statusCode = ",
    //                         monitoredItemResult.statusCode.toString());
    //                 }
    //             });
    //             innerCallback();
    //         });
    // }

    /**
     *  utility function to recreate new subscription
     *  @method recreateSubscriptionAndMonitoredItem
     */
    public recreateSubscriptionAndMonitoredItem(callback: ErrorCallback) {

        debugLog("ClientSubscription#recreateSubscriptionAndMonitoredItem");

        if (this.subscriptionId === TERMINTATED_SUBSCRIPTION_ID) {
            debugLog("Subscription is not in a valid state");
            return callback();
        }

        const oldMonitoredItems = this.monitoredItems;

        this.publishEngine.unregisterSubscription(this.subscriptionId);

        async.series([

            (innerCallback: ErrorCallback) => {
                this.__create_subscription(innerCallback);
            },
            (innerCallback: ErrorCallback) => {

                const test = this.publishEngine.getSubscription(this.subscriptionId);
                assert(test === this);

                // re-create monitored items

                const itemsToCreate: MonitoredItemCreateRequestOptions[] = [];

                _.forEach(oldMonitoredItems, (monitoredItem: ClientMonitoredItemBase /*, clientHandle*/) => {
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

                const session = this.session;
                if (!session) {
                    return innerCallback(new Error("no session"));
                }

                debugLog("Recreating ", itemsToCreate.length, " monitored items");

                session.createMonitoredItems(
                    createMonitorItemsRequest,
                    (err: Error | null, response?: CreateMonitoredItemsResponse) => {

                        if (err) {
                            debugLog("Recreating monitored item has failed with ", err.message);
                            return innerCallback(err);
                        }
                        /* istanbul ignore next */
                        if (!response) {
                            return innerCallback(new Error("Internal Error"));
                        }
                        const monitoredItemResults = response.results || [];

                        monitoredItemResults.forEach((monitoredItemResult, index) => {

                            const itemToCreate = itemsToCreate[index];
                            /* istanbul ignore next */
                            if (!itemToCreate || !itemToCreate.requestedParameters) {
                                throw new Error("Internal Error");
                            }
                            const clientHandle = itemToCreate.requestedParameters.clientHandle;
                            /* istanbul ignore next */
                            if (!clientHandle) {
                                throw new Error("Internal Error");
                            }
                            const monitoredItem = this.monitoredItems[clientHandle] as ClientMonitoredItemImpl;
                            monitoredItem._applyResult(monitoredItemResult);

                        });
                        innerCallback();
                    });

            }
        ], (err) => {
            callback(err!);
        });
    }

    public toString(): string {
        let str = "";
        str += "subscriptionId      :" + this.subscriptionId + "\n";
        str += "publishingInterval  :" + this.publishingInterval + "\n";
        str += "lifetimeCount       :" + this.lifetimeCount + "\n";
        str += "maxKeepAliveCount   :" + this.maxKeepAliveCount + "\n";
        return str;
    }

    /**
     * returns the approximated remaining life time of this subscription in milliseconds
     */
    public evaluateRemainingLifetime(): number {
        const now = Date.now();
        const timeout = this.publishingInterval * this.lifetimeCount;
        const expiryTime = this.lastRequestSentTime.getTime() + timeout;
        return Math.max(0, (expiryTime - now));
    }

    public _add_monitored_item(clientHandle: ClientHandle, monitoredItem: ClientMonitoredItemBase) {

        assert(this.isActive, "subscription must be active and not terminated");
        assert(monitoredItem.monitoringParameters.clientHandle === clientHandle);
        this.monitoredItems[clientHandle] = monitoredItem;

        /**
         * notify the observers that a new monitored item has been added to the subscription.
         * @event item_added
         * @param the monitored item.
         */
        this.emit("item_added", monitoredItem);
    }
    public _wait_for_subscription_to_be_ready(done: ErrorCallback) {

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

    private __create_subscription(callback: ErrorCallback) {

        assert(_.isFunction(callback));

        if (!this.hasSession) {
            return callback(new Error("No Session"));
        }
        const session = this.session;

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
            if (!this.hasSession) {
                return callback(new Error("createSubscription has failed = > no session"));
            }
            assert(this.hasSession);

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
                debugLog(chalk.yellow.bold("timeoutHint for publish request  "), this.timeoutHint);
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

                    const monitoredItemImpl = monitorItemObj as ClientMonitoredItemImpl;
                    monitoredItemImpl._notify_value_change(monitoredItem.value);
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
            //    notificationMessage with the status code BadTimeout.
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

            const monitoredItemImpl = monitorItemObj as ClientMonitoredItemImpl;
            monitoredItemImpl._notify_event(event.eventFields || []);
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

                if (!notification) {
                    continue;
                }

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

    private _remove(monitoredItem: ClientMonitoredItemBase) {
        const clientHandle = monitoredItem.monitoringParameters.clientHandle;
        assert(clientHandle > 0);
        if (!this.monitoredItems.hasOwnProperty(clientHandle)) {
            return; // may be monitoredItem failed to be created  ....
        }
        assert(this.monitoredItems.hasOwnProperty(clientHandle));
        monitoredItem.removeAllListeners();
        delete this.monitoredItems[clientHandle];
    }

}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = { multiArgs: false };

ClientSubscriptionImpl.prototype.setPublishingMode = thenify.withCallback(ClientSubscriptionImpl.prototype.setPublishingMode);
ClientSubscriptionImpl.prototype.monitor = thenify.withCallback(ClientSubscriptionImpl.prototype.monitor);
ClientSubscriptionImpl.prototype.monitorItems = thenify.withCallback(ClientSubscriptionImpl.prototype.monitorItems);
ClientSubscriptionImpl.prototype.recreateSubscriptionAndMonitoredItem =
    thenify.withCallback(ClientSubscriptionImpl.prototype.recreateSubscriptionAndMonitoredItem);
ClientSubscriptionImpl.prototype.terminate = thenify.withCallback(ClientSubscriptionImpl.prototype.terminate);
ClientSubscriptionImpl.prototype.getMonitoredItems = thenify.withCallback(ClientSubscriptionImpl.prototype.getMonitoredItems);

ClientSubscription.create = (clientSession: ClientSession, options: ClientSubscriptionOptions) => {
    return new ClientSubscriptionImpl(clientSession, options);
};
