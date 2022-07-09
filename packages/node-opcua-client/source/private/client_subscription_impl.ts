/**
 * @module node-opcua-client-private
 */
// tslint:disable:unified-signatures
import { EventEmitter } from "events";
import * as async from "async";
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { AttributeIds } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
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
    MonitoredItemCreateRequestOptions,
    MonitoringParametersOptions,
    NotificationMessage,
    StatusChangeNotification,
    NotificationData,
    EventNotificationList,
    SetTriggeringResponse,
    SetTriggeringRequest,
    MonitoringMode,
    ModifySubscriptionRequestOptions,
    ModifySubscriptionResponse
} from "node-opcua-service-subscription";

import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { Callback, ErrorCallback } from "node-opcua-status-code";
import * as utils from "node-opcua-utils";
import { promoteOpaqueStructureInNotificationData } from "node-opcua-client-dynamic-extension-object";
import { createMonitoredItemsLimit, IBasicSession, readOperationLimits } from "node-opcua-pseudo-session";

import { IBasicSessionWithSubscription } from "node-opcua-pseudo-session";
import { ClientMonitoredItemBase } from "../client_monitored_item_base";
import { ClientMonitoredItemGroup } from "../client_monitored_item_group";
import { ClientSession, MonitoredItemData, SubscriptionId } from "../client_session";
import {
    ClientHandle,
    ClientMonitoredItemBaseMap,
    ClientSubscription,
    ClientSubscriptionOptions,
    ModifySubscriptionOptions,
    ModifySubscriptionResult
} from "../client_subscription";
import { ClientMonitoredItem } from "../client_monitored_item";
import { ClientMonitoredItemToolbox } from "../client_monitored_item_toolbox";
import { ClientMonitoredItemGroupImpl } from "./client_monitored_item_group_impl";
import { ClientMonitoredItemImpl } from "./client_monitored_item_impl";
import { ClientSidePublishEngine } from "./client_publish_engine";
import { ClientSessionImpl } from "./client_session_impl";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);

const PENDING_SUBSCRIPTION_ID = 0xc0cac01a;
const TERMINATED_SUBSCRIPTION_ID = 0xc0cac01b;
const TERMINATING_SUBSCRIPTION_ID = 0xc0cac01c;

const minimumMaxKeepAliveCount = 3;

function displayKeepAliveWarning(sessionTimeout: number, maxKeepAliveCount: number, publishingInterval: number): boolean {
    const keepAliveInterval = maxKeepAliveCount * publishingInterval;

    // istanbul ignore next
    if (sessionTimeout < keepAliveInterval) {
        warningLog(
            chalk.yellowBright(
                `[NODE-OPCUA-W09] The subscription parameters are not compatible with the session timeout !
                  session timeout    = ${sessionTimeout}  milliseconds
                  maxKeepAliveCount  = ${maxKeepAliveCount}
                  publishingInterval = ${publishingInterval} milliseconds"

                  It is important that the session timeout    ( ${chalk.red(sessionTimeout)} ms) is largely greater than :
                      (maxKeepAliveCount*publishingInterval  =  ${chalk.red(keepAliveInterval)} ms),
                  otherwise you may experience unexpected disconnection from the server if your monitored items are not
                  changing frequently.`
            )
        );

        if (sessionTimeout < 3000 && publishingInterval <= 1000) {
            warningLog(`[NODE-OPCUA-W10] You'll need to increase your sessionTimeout significantly.`);
        }
        if (
            sessionTimeout >= 3000 &&
            sessionTimeout < publishingInterval * minimumMaxKeepAliveCount &&
            maxKeepAliveCount <= minimumMaxKeepAliveCount + 2
        ) {
            warningLog(`[NODE-OPCUA-W11] your publishingInterval interval is probably too large, consider reducing it.`);
        }

        const idealMaxKeepAliveCount = Math.max(4, Math.floor((sessionTimeout * 0.8) / publishingInterval - 0.5));
        const idealPublishingInternal = Math.min(publishingInterval, sessionTimeout / (idealMaxKeepAliveCount + 3));
        const idealKeepAliveInterval = idealMaxKeepAliveCount * publishingInterval;
        warningLog(
            `[NODE-OPCUA-W12]  An ideal value for maxKeepAliveCount could be ${idealMaxKeepAliveCount}.
                  An ideal value for publishingInterval could be ${idealPublishingInternal} ms.
                  This will make  your subscription emit a keep alive signal every ${idealKeepAliveInterval} ms
                  if no monitored items are generating notifications.
                  for instance:
                    const  client = OPCUAClient.create({
                        requestedSessionTimeout: 30* 60* 1000, // 30 minutes
                    });
`
        );

        if (!ClientSubscription.ignoreNextWarning) {
            throw new Error("[NODE-OPCUA-W09] The subscription parameters are not compatible with the session timeout ");
        }
        return true;
    }
    return false;
}

function createMonitoredItemsAndRespectOperationalLimits(
    session: IBasicSession & IBasicSessionWithSubscription,
    createMonitorItemsRequest: CreateMonitoredItemsRequest,
    callback: (err: Error | null, response?: CreateMonitoredItemsResponse) => void
) {
    readOperationLimits(session)
        .then((operationalLimits) => {
            createMonitoredItemsLimit(operationalLimits.maxMonitoredItemsPerCall || 0, session, createMonitorItemsRequest)
                .then((createMonitoredItemResponse) => callback(null, createMonitoredItemResponse))
                .catch(callback);
        })
        .catch(callback);
}

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
        return !(
            this.subscriptionId === PENDING_SUBSCRIPTION_ID ||
            this.subscriptionId === TERMINATED_SUBSCRIPTION_ID ||
            this.subscriptionId === TERMINATING_SUBSCRIPTION_ID
        );
    }

    public subscriptionId: SubscriptionId;
    public publishingInterval: number;
    public lifetimeCount: number;
    public maxKeepAliveCount: number;
    public maxNotificationsPerPublish: number;
    public publishingEnabled: boolean;
    public priority: number;
    public monitoredItems: ClientMonitoredItemBaseMap;
    public monitoredItemGroups: ClientMonitoredItemGroup[] = [];

    public timeoutHint = 0;
    public publishEngine: ClientSidePublishEngine;

    public lastSequenceNumber: number;
    private lastRequestSentTime: Date;
    private _nextClientHandle = 0;
    private hasTimedOut: boolean;

    constructor(session: ClientSession, options: ClientSubscriptionOptions) {
        super();

        const sessionImpl = session as ClientSessionImpl;
        this.publishEngine = sessionImpl.getPublishEngine();

        this.lastSequenceNumber = -1;

        options = options || {};
        options.requestedPublishingInterval = options.requestedPublishingInterval || 100;
        options.requestedLifetimeCount = options.requestedLifetimeCount || 60;
        options.requestedMaxKeepAliveCount = options.requestedMaxKeepAliveCount || 10;
        options.requestedMaxKeepAliveCount = Math.max(options.requestedMaxKeepAliveCount, minimumMaxKeepAliveCount);

        // perform some verification
        const warningEmitted = displayKeepAliveWarning(
            session.timeout,
            options.requestedMaxKeepAliveCount,
            options.requestedPublishingInterval
        );
        // istanbul ignore next
        if (warningEmitted) {
            warningLog(
                JSON.stringify(
                    {
                        ...options
                    },
                    null,
                    " "
                )
            );
        }

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

        this.subscriptionId = PENDING_SUBSCRIPTION_ID;

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
                } else {
                    setImmediate(() => {
                        /**
                         * notify the observers that the subscription has now failed
                         * @event failed
                         */
                        this.emit("error", err);
                    });
                }
            });
        });
    }

    public terminate(...args: any[]): any {
        debugLog("Terminating client subscription ", this.subscriptionId);
        const callback = args[0];
        assert(typeof callback === "function", "expecting a callback function");

        if (this.subscriptionId === TERMINATED_SUBSCRIPTION_ID || this.subscriptionId === TERMINATING_SUBSCRIPTION_ID) {
            // already terminated... just ignore
            return callback(new Error("Already Terminated"));
        }

        if (isFinite(this.subscriptionId)) {
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
            session.deleteSubscriptions(
                {
                    subscriptionIds: [subscriptionId]
                },
                (err: Error | null, response?: DeleteSubscriptionsResponse) => {
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
                }
            );
        } else {
            debugLog("subscriptionId is not value ", this.subscriptionId);
            assert(this.subscriptionId === PENDING_SUBSCRIPTION_ID);
            this._terminate_step2(callback);
        }
    }

    /**
     * @method nextClientHandle
     */
    public nextClientHandle(): number {
        this._nextClientHandle += 1;
        return this._nextClientHandle;
    }

    public async monitor(
        itemToMonitor: ReadValueIdOptions,
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        monitoringMode: MonitoringMode
    ): Promise<ClientMonitoredItemBase>;
    public monitor(
        itemToMonitor: ReadValueIdOptions,
        requestedParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        monitoringMode: MonitoringMode,
        done: Callback<ClientMonitoredItemBase>
    ): void;
    public monitor(...args: any[]): any {
        const itemToMonitor = args[0] as ReadValueIdOptions;
        const requestedParameters = args[1] as MonitoringParametersOptions;
        const timestampsToReturn = args[2] as TimestampsToReturn;
        const monitoringMode = typeof args[3] === "function" ? MonitoringMode.Reporting : (args[3] as MonitoringMode);
        const done = (typeof args[3] === "function" ? args[3] : args[4]) as Callback<ClientMonitoredItemBase>;

        assert(typeof done === "function", "expecting a function here");

        itemToMonitor.nodeId = resolveNodeId(itemToMonitor.nodeId!);

        const monitoredItem = ClientMonitoredItem_create(
            this,
            itemToMonitor,
            requestedParameters,
            timestampsToReturn,
            monitoringMode,
            (err1?: Error | null, monitoredItem2?: ClientMonitoredItem) => {
                if (err1) {
                    return done && done(err1);
                }
                done(err1 || null, monitoredItem);
            }
        );
    }

    public async monitorItems(
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
        const requestedParameters = args[1] as MonitoringParametersOptions;
        const timestampsToReturn = args[2] as TimestampsToReturn;
        const done = args[3] as Callback<ClientMonitoredItemGroup>;

        const monitoredItemGroup = new ClientMonitoredItemGroupImpl(this, itemsToMonitor, requestedParameters, timestampsToReturn);

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

    public _delete_monitored_items(monitoredItems: ClientMonitoredItemBase[], callback: ErrorCallback): void {
        assert(typeof callback === "function");
        assert(Array.isArray(monitoredItems));

        assert(this.isActive);

        for (const monitoredItem of monitoredItems) {
            this._remove(monitoredItem);
        }
        const session = this.session as ClientSessionImpl;
        session.deleteMonitoredItems(
            {
                monitoredItemIds: monitoredItems.map((monitoredItem) => monitoredItem.monitoredItemId),
                subscriptionId: this.subscriptionId
            },
            (err: Error | null, response?: DeleteMonitoredItemsResponse) => {
                callback(err!);
            }
        );
    }

    public async setPublishingMode(publishingEnabled: boolean): Promise<StatusCode>;
    public setPublishingMode(publishingEnabled: boolean, callback: Callback<StatusCode>): void;
    public setPublishingMode(...args: any[]): any {
        const publishingEnabled = args[0] as boolean;
        const callback = args[1] as Callback<StatusCode>;
        assert(typeof callback === "function");

        const session = this.session as ClientSessionImpl;
        if (!session) {
            return callback(new Error("no session"));
        }
        const subscriptionId = this.subscriptionId as SubscriptionId;
        session.setPublishingMode(publishingEnabled, subscriptionId, (err: Error | null, statusCode?: StatusCode) => {
            if (err) {
                return callback(err);
            }
            /* istanbul ignore next */
            if (!statusCode) {
                return callback(new Error("Internal Error"));
            }
            if (statusCode !== StatusCodes.Good) {
                return callback(null, statusCode);
            }
            callback(null, StatusCodes.Good);
        });
    }

    /**
     *
     */
    public setTriggering(
        triggeringItem: ClientMonitoredItemBase,
        linksToAdd: ClientMonitoredItemBase[] | null,
        linksToRemove?: ClientMonitoredItemBase[] | null
    ): Promise<SetTriggeringResponse>;
    public setTriggering(
        triggeringItem: ClientMonitoredItemBase,
        linksToAdd: ClientMonitoredItemBase[] | null,
        linksToRemove: ClientMonitoredItemBase[] | null,
        callback: Callback<SetTriggeringResponse>
    ): void;
    public setTriggering(...args: any[]): any {
        const triggeringItem = args[0] as ClientMonitoredItemBase;
        const linksToAdd = args[1] as ClientMonitoredItemBase[] | null;
        const linksToRemove = args[2] as ClientMonitoredItemBase[] | null;
        const callback = args[3] as Callback<SetTriggeringResponse>;
        assert(typeof callback === "function");
        const session = this.session as ClientSessionImpl;
        if (!session) {
            return callback(new Error("no session"));
        }
        const subscriptionId = this.subscriptionId;

        const triggeringItemId = triggeringItem.monitoredItemId!;

        const setTriggeringRequest = new SetTriggeringRequest({
            linksToAdd: linksToAdd ? linksToAdd.map((i) => i.monitoredItemId!) : null,
            linksToRemove: linksToRemove ? linksToRemove.map((i) => i.monitoredItemId!) : null,
            subscriptionId,
            triggeringItemId
        });
        session.setTriggering(setTriggeringRequest, (err: Error | null, response?: SetTriggeringResponse) => {
            if (err) {
                // use soft error, no exceptions
                return callback(null, response);
            }
            // istanbul ignore next
            if (!response) {
                return callback(new Error("Internal Error"));
            }
            callback(null, response);
        });
    }

    // public subscription service
    public modify(options: ModifySubscriptionOptions, callback: Callback<ModifySubscriptionResult>): void;
    public modify(options: ModifySubscriptionOptions): Promise<ModifySubscriptionResult>;
    public modify(...args: any[]): any {
        const modifySubscriptionRequest = args[0] as ModifySubscriptionRequestOptions;
        const callback = args[1] as Callback<ModifySubscriptionResult>;
        const session = this.session as ClientSessionImpl;
        if (!session) {
            return callback(new Error("no session"));
        }

        modifySubscriptionRequest.subscriptionId = this.subscriptionId;

        modifySubscriptionRequest.priority =
            modifySubscriptionRequest.priority === undefined ? this.priority : modifySubscriptionRequest.priority;
        modifySubscriptionRequest.requestedLifetimeCount =
            modifySubscriptionRequest.requestedLifetimeCount === undefined
                ? this.lifetimeCount
                : modifySubscriptionRequest.requestedLifetimeCount;
        modifySubscriptionRequest.requestedMaxKeepAliveCount =
            modifySubscriptionRequest.requestedMaxKeepAliveCount === undefined
                ? this.maxKeepAliveCount
                : modifySubscriptionRequest.requestedMaxKeepAliveCount;
        modifySubscriptionRequest.requestedPublishingInterval =
            modifySubscriptionRequest.requestedPublishingInterval === undefined
                ? this.publishingInterval
                : modifySubscriptionRequest.requestedPublishingInterval;
        modifySubscriptionRequest.maxNotificationsPerPublish =
            modifySubscriptionRequest.maxNotificationsPerPublish === undefined
                ? this.maxNotificationsPerPublish
                : modifySubscriptionRequest.maxNotificationsPerPublish;

        session.modifySubscription(modifySubscriptionRequest, (err: Error | null, response?: ModifySubscriptionResponse) => {
            if (err || !response) {
                return callback(err);
            }
            this.publishingInterval = response.revisedPublishingInterval;
            this.lifetimeCount = response.revisedLifetimeCount;
            this.maxKeepAliveCount = response.revisedMaxKeepAliveCount;
            callback(null, response);
        });
    }

    public getMonitoredItems(): Promise<MonitoredItemData>;
    public getMonitoredItems(callback: Callback<MonitoredItemData>): void;
    public getMonitoredItems(...args: any[]): any {
        this.session.getMonitoredItems(this.subscriptionId, args[0]);
    }

    /**
     *  utility function to recreate new subscription
     *  @method recreateSubscriptionAndMonitoredItem
     */
    public recreateSubscriptionAndMonitoredItem(callback: ErrorCallback): void {
        debugLog("ClientSubscription#recreateSubscriptionAndMonitoredItem");

        if (this.subscriptionId === TERMINATED_SUBSCRIPTION_ID) {
            debugLog("Subscription is not in a valid state");
            return callback();
        }

        const oldMonitoredItems = this.monitoredItems;

        this.publishEngine.unregisterSubscription(this.subscriptionId);

        async.series(
            [
                (innerCallback: ErrorCallback) => {
                    this.__create_subscription(innerCallback);
                },
                (innerCallback: ErrorCallback) => {
                    const test = this.publishEngine.getSubscription(this.subscriptionId);

                    debugLog("recreating ", Object.keys(oldMonitoredItems).length, " monitored Items");
                    // re-create monitored items
                    const itemsToCreate: MonitoredItemCreateRequestOptions[] = [];

                    for (const monitoredItem of Object.values(oldMonitoredItems)) {
                        assert(monitoredItem.monitoringParameters.clientHandle > 0);
                        itemsToCreate.push({
                            itemToMonitor: monitoredItem.itemToMonitor,
                            monitoringMode: monitoredItem.monitoringMode,
                            requestedParameters: monitoredItem.monitoringParameters
                        });
                    }

                    const createMonitorItemsRequest = new CreateMonitoredItemsRequest({
                        itemsToCreate,
                        subscriptionId: this.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Both // this.timestampsToReturn,
                    });

                    const session = this.session;
                    // istanbul ignore next
                    if (!session) {
                        return innerCallback(new Error("no session"));
                    }

                    debugLog("Recreating ", itemsToCreate.length, " monitored items");

                    createMonitoredItemsAndRespectOperationalLimits(
                        session,
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
                                if (monitoredItem) {
                                    monitoredItem._applyResult(monitoredItemResult);
                                } else {
                                    warningLog("cannot find monitored item for clientHandle !:", clientHandle);
                                }
                            });
                            innerCallback();
                        }
                    );
                }
            ],
            (err) => {
                if (err) {
                    warningLog(err.message);
                }
                callback(err!);
            }
        );
    }

    public toString(): string {
        let str = "";
        str += "subscriptionId      : " + this.subscriptionId + "\n";
        str += "publishingInterval  : " + this.publishingInterval + "\n";
        str += "lifetimeCount       : " + this.lifetimeCount + "\n";
        str += "maxKeepAliveCount   : " + this.maxKeepAliveCount + "\n";
        str += "hasTimedOut         : " + this.hasTimedOut + "\n";

        const timeToLive = this.lifetimeCount * this.publishingInterval;
        str += "timeToLive          : " + timeToLive + "\n";
        str += "lastRequestSentTime : " + this.lastRequestSentTime.toString() + "\n";
        const duration = Date.now() - this.lastRequestSentTime.getTime();
        const extra =
            duration - timeToLive > 0
                ? chalk.red(" expired since " + (duration - timeToLive) / 1000 + " seconds")
                : chalk.green(" valid for " + -(duration - timeToLive) / 1000 + " seconds");

        str += "timeSinceLast PR    : " + duration + "ms" + extra + "\n";
        str += "has expired         : " + (duration > timeToLive) + "\n";

        str += "(session timeout    : " + this.session.timeout + " ms)\n";
        str += "(maxKeepAliveCount*publishingInterval: " + this.publishingInterval * this.session.timeout + " ms)\n";

        return str;
    }

    /**
     * returns the approximated remaining life time of this subscription in milliseconds
     */
    public evaluateRemainingLifetime(): number {
        const now = Date.now();
        const timeout = this.publishingInterval * this.lifetimeCount;
        const expiryTime = this.lastRequestSentTime.getTime() + timeout;
        return Math.max(0, expiryTime - now);
    }

    public _add_monitored_item(clientHandle: ClientHandle, monitoredItem: ClientMonitoredItemBase): void {
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

    public _add_monitored_items_group(monitoredItemGroup: ClientMonitoredItemGroupImpl): void {
        this.monitoredItemGroups.push(monitoredItemGroup);
    }

    public _wait_for_subscription_to_be_ready(done: ErrorCallback): void {
        let _watchDogCount = 0;

        const waitForSubscriptionAndMonitor = () => {
            _watchDogCount++;

            if (this.subscriptionId === PENDING_SUBSCRIPTION_ID) {
                // the subscriptionID is not yet known because the server hasn't replied yet
                // let postpone this call, a little bit, to let things happen
                setImmediate(waitForSubscriptionAndMonitor);
            } else if (this.subscriptionId === TERMINATED_SUBSCRIPTION_ID) {
                // the subscription has been terminated in the meantime
                // this indicates a potential issue in the code using this api.
                if (typeof done === "function") {
                    done(new Error("subscription has been deleted"));
                }
            } else {
                done();
            }
        };

        setImmediate(waitForSubscriptionAndMonitor);
    }

    private __create_subscription(callback: ErrorCallback) {
        assert(typeof callback === "function");

        // istanbul ignore next
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
            requestedPublishingInterval: this.publishingInterval
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

            /* istanbul ignore next */
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

            displayKeepAliveWarning(this.session.timeout, this.maxKeepAliveCount, this.publishingInterval);
            ClientSubscription.ignoreNextWarning = false;

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

        let repeated = 0;
        for (const monitoredItem of monitoredItems) {
            const monitorItemObj = this.monitoredItems[monitoredItem.clientHandle];
            if (monitorItemObj) {
                if (monitorItemObj.itemToMonitor.attributeId === AttributeIds.EventNotifier) {
                    warningLog(
                        chalk.yellow("Warning"),
                        chalk.cyan(
                            " Server send a DataChangeNotification for an EventNotifier." + " EventNotificationList was expected"
                        )
                    );
                    warningLog(
                        chalk.cyan("         the Server may not be fully OPCUA compliant"),
                        chalk.yellow(". This notification will be ignored.")
                    );
                } else {
                    const monitoredItemImpl = monitorItemObj as ClientMonitoredItemImpl;
                    monitoredItemImpl._notify_value_change(monitoredItem.value);
                }
            } else {
                repeated += 1;
                if (repeated === 1) {
                    warningLog(
                        "Receiving a notification for a unknown monitoredItem with clientHandle ",
                        monitoredItem.clientHandle
                    );
                }
            }
        }
        // istanbul ignore next
        if (repeated > 1) {
            warningLog("previous message repeated", repeated, "times");
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

            // may be it has been transferred after a reconnection.... in this case should do nothing about it
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
            this.terminate(() => {
                /* empty */
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

    public onNotificationMessage(notificationMessage: NotificationMessage): void {
        assert(Object.prototype.hasOwnProperty.call(notificationMessage, "sequenceNumber"));

        this.lastSequenceNumber = notificationMessage.sequenceNumber;

        this.emit("raw_notification", notificationMessage);

        const notificationData = (notificationMessage.notificationData || []) as NotificationData[];

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

            promoteOpaqueStructureInNotificationData(this.session, notificationData).then(() => {
                // now process all notifications
                for (const notification of notificationData) {
                    // istanbul ignore next
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
            });
        }
    }

    private _terminate_step2(callback: (err?: Error) => void) {
        const monitoredItems = Object.values(this.monitoredItems);
        for (const monitoredItem of monitoredItems) {
            this._remove(monitoredItem);
        }

        const monitoredItemGroups = this.monitoredItemGroups;
        for (const monitoredItemGroup of monitoredItemGroups) {
            this._removeGroup(monitoredItemGroup);
        }

        assert(Object.values(this.monitoredItems).length === 0);

        setImmediate(() => {
            /**
             * notify the observers that the client subscription has terminated
             * @event  terminated
             */
            this.subscriptionId = TERMINATED_SUBSCRIPTION_ID;
            this.emit("terminated");
            callback();
        });
    }

    private _remove(monitoredItem: ClientMonitoredItemBase) {
        const clientHandle = monitoredItem.monitoringParameters.clientHandle;
        assert(clientHandle > 0);
        if (!Object.prototype.hasOwnProperty.call(this.monitoredItems, clientHandle)) {
            return; // may be monitoredItem failed to be created  ....
        }
        assert(Object.prototype.hasOwnProperty.call(this.monitoredItems, clientHandle));

        const priv = monitoredItem as ClientMonitoredItemImpl;
        priv._terminate_and_emit();
    }

    public _removeGroup(monitoredItemGroup: ClientMonitoredItemGroup): void {
        (monitoredItemGroup as any)._terminate_and_emit();
        this.monitoredItemGroups = this.monitoredItemGroups.filter((obj) => obj !== monitoredItemGroup);
    }
    /**
     * @private
     * @param itemToMonitor
     * @param monitoringParameters
     * @param timestampsToReturn
     */
    public _createMonitoredItem(
        itemToMonitor: ReadValueIdOptions,
        monitoringParameters: MonitoringParametersOptions,
        timestampsToReturn: TimestampsToReturn,
        monitoringMode: MonitoringMode = MonitoringMode.Reporting
    ): ClientMonitoredItem {
        /* istanbul ignore next*/
        const monitoredItem = new ClientMonitoredItemImpl(
            this,
            itemToMonitor,
            monitoringParameters,
            timestampsToReturn,
            monitoringMode
        );
        return monitoredItem;
    }
}

export function ClientMonitoredItem_create(
    subscription: ClientSubscription,
    itemToMonitor: ReadValueIdOptions,
    monitoringParameters: MonitoringParametersOptions,
    timestampsToReturn: TimestampsToReturn,
    monitoringMode: MonitoringMode = MonitoringMode.Reporting,
    callback?: (err3?: Error | null, monitoredItem?: ClientMonitoredItem) => void
): ClientMonitoredItem {
    const monitoredItem = new ClientMonitoredItemImpl(
        subscription,
        itemToMonitor,
        monitoringParameters,
        timestampsToReturn,
        monitoringMode
    );

    setImmediate(() => {
        (subscription as ClientSubscriptionImpl)._wait_for_subscription_to_be_ready((err?: Error) => {
            if (err) {
                if (callback) {
                    callback(err);
                }
                return;
            }
            ClientMonitoredItemToolbox._toolbox_monitor(subscription, timestampsToReturn, [monitoredItem], (err1?: Error) => {
                if (err1) {
                    monitoredItem._terminate_and_emit(err1);
                }
                if (callback) {
                    callback(err1, monitoredItem);
                }
            });
        });
    });
    return monitoredItem;
}
// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = { multiArgs: false };

ClientSubscriptionImpl.prototype.setPublishingMode = thenify.withCallback(ClientSubscriptionImpl.prototype.setPublishingMode);
ClientSubscriptionImpl.prototype.monitor = thenify.withCallback(ClientSubscriptionImpl.prototype.monitor);
ClientSubscriptionImpl.prototype.monitorItems = thenify.withCallback(ClientSubscriptionImpl.prototype.monitorItems);
ClientSubscriptionImpl.prototype.setTriggering = thenify.withCallback(ClientSubscriptionImpl.prototype.setTriggering);
ClientSubscriptionImpl.prototype.modify = thenify.withCallback(ClientSubscriptionImpl.prototype.modify);
ClientSubscriptionImpl.prototype.recreateSubscriptionAndMonitoredItem = thenify.withCallback(
    ClientSubscriptionImpl.prototype.recreateSubscriptionAndMonitoredItem
);
ClientSubscriptionImpl.prototype.terminate = thenify.withCallback(ClientSubscriptionImpl.prototype.terminate);
ClientSubscriptionImpl.prototype.getMonitoredItems = thenify.withCallback(ClientSubscriptionImpl.prototype.getMonitoredItems);

ClientSubscription.create = (clientSession: ClientSession, options: ClientSubscriptionOptions) => {
    return new ClientSubscriptionImpl(clientSession, options);
};
