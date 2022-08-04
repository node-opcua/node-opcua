/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import { EventEmitter } from "events";
import * as chalk from "chalk";
import { partition, sortBy } from "lodash";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import { StatusCode, StatusCodes } from "node-opcua-status-code";

import { PublishRequest, PublishResponse, SubscriptionAcknowledgement } from "node-opcua-types";
import { Subscription } from "./server_subscription";
import { SubscriptionState } from "./server_subscription";
import { IServerSidePublishEngine, INotifMsg, IClosedOrTransferredSubscription } from "./i_server_side_publish_engine";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function traceLog(...args: [any?, ...any[]]) {
    if (!doDebug) {
        return;
    }
    const a: string[] = args.map((x?: any) => x!);
    a.unshift(chalk.yellow(" TRACE "));
    debugLog(...a);
}

export interface ServerSidePublishEngineOptions {
    maxPublishRequestInQueue?: number;
}

interface PublishData {
    request: PublishRequest;
    serverTimeWhenReceived: number;
    results: StatusCode[];
    callback: (request: PublishRequest, response: PublishResponse) => void;
}

function _assertValidPublishData(publishData: PublishData) {
    assert(publishData.request instanceof PublishRequest);
    assert(typeof publishData.serverTimeWhenReceived === "number");
    assert(Array.isArray(publishData.results));
    assert(typeof publishData.callback === "function");
}

function dummy_function() {
    /* empty */
}

function addDate(date: Date, delta: number) {
    return new Date(date.getTime() + delta);
}

function timeout_filter(publishData: PublishData): boolean {
    const request = publishData.request;
    const results = publishData.results;
    if (!request.requestHeader.timeoutHint) {
        // no limits
        return false;
    }
    const serverTimeWhenReceived = publishData.serverTimeWhenReceived;
    // remark : do not use request.requestHeader.timestamp! here as this is a client date and server and client clocks might differ
    const expected_timeout_time = addDate(new Date(serverTimeWhenReceived), request.requestHeader.timeoutHint);
    return expected_timeout_time.getTime() < Date.now();
}

/***
 *  a Publish Engine for a given session
 */
export class ServerSidePublishEngine extends EventEmitter implements IServerSidePublishEngine {
    public static registry = new ObjectRegistry();

    /**
     * @private
     */
    public static transferSubscriptionsToOrphan(
        srcPublishEngine: ServerSidePublishEngine,
        destPublishEngine: ServerSidePublishEngine
    ): void {
        debugLog(
            chalk.yellow(
                "ServerSidePublishEngine#transferSubscriptionsToOrphan! " + "start transferring long live subscriptions to orphan"
            )
        );

        for (const subscription of Object.values(srcPublishEngine._subscriptions)) {
            assert((subscription.publishEngine as any) === srcPublishEngine);

            if (subscription.$session) {
                subscription.$session._unexposeSubscriptionDiagnostics(subscription);
            } else {
                console.warn("Warning:  subscription", subscription.id, " has no session attached!!!");
            }

            ServerSidePublishEngine.transferSubscription(subscription, destPublishEngine, false);
        }
        assert(srcPublishEngine.subscriptionCount === 0);

        debugLog(
            chalk.yellow(
                "ServerSidePublishEngine#transferSubscriptionsToOrphan! " + "end transferring long lived subscriptions to orphan"
            )
        );
    }

    /**
     * @param subscription
     * @param destPublishEngine
     * @param sendInitialValues true if initial values should be sent
     * @private
     */
    public static async transferSubscription(
        subscription: Subscription,
        destPublishEngine: ServerSidePublishEngine,
        sendInitialValues: boolean
    ): Promise<Subscription> {
        const srcPublishEngine = subscription.publishEngine as any as ServerSidePublishEngine;

        assert(!destPublishEngine.getSubscriptionById(subscription.id));
        assert(srcPublishEngine.getSubscriptionById(subscription.id));

        // remove pending StatusChangeNotification on the same session that may exist already
        destPublishEngine._purge_dangling_subscription(subscription.id);

        debugLog(chalk.cyan("ServerSidePublishEngine.transferSubscription live subscriptionId ="), subscription.subscriptionId);

        // xx const internalNotification = subscription._flushSentNotifications();
        debugLog(chalk.cyan("ServerSidePublishEngine.transferSubscription with  = "), subscription.getAvailableSequenceNumbers());

        //  If the Server transfers the Subscription to the new Session, the Server shall issue a
        //  StatusChangeNotification notificationMessage with the status code Good_SubscriptionTransferred
        //  to the old Session.
        subscription.notifyTransfer();

        const tmp = srcPublishEngine.detach_subscription(subscription);
        destPublishEngine.add_subscription(tmp);
        
        subscription.resetLifeTimeCounter();
        if (sendInitialValues) {
            /*  A Boolean parameter with the following values:
                TRUE  the first Publish response(s) after the TransferSubscriptions call
                      shall contain the current values of all Monitored Items in the
                      Subscription where the Monitoring Mode is set to Reporting.
                      If a value is queued for a data MonitoredItem, the next value in
                      the queue is sent in the Publish response. If no value is queued
                      for a data MonitoredItem, the last value sent is repeated in the
                      Publish response.
                FALSE the first Publish response after the TransferSubscriptions call
                      shall contain only the value changes since the last Publish
                      response was sent.
                This parameter only applies to MonitoredItems used for monitoring Attribute
                changes
            */
            debugLog("Resending initial values");
            await subscription.resendInitialValues();
        }

        assert(destPublishEngine.getSubscriptionById(subscription.id));
        assert(!srcPublishEngine.getSubscriptionById(subscription.id));

        return subscription;
    }

    public maxPublishRequestInQueue = 0;
    public isSessionClosed = false;

    private _publish_request_queue: PublishData[] = [];
    private _subscriptions: { [key: string]: Subscription };
    private _closed_subscriptions: IClosedOrTransferredSubscription[] = [];

    constructor(options?: ServerSidePublishEngineOptions) {
        super();

        options = options || {};

        ServerSidePublishEngine.registry.register(this);

        // a queue of pending publish request send by the client
        // waiting to be used by the server to send notification
        this._publish_request_queue = []; // { request :/*PublishRequest*/{},

        this._subscriptions = {};

        // _closed_subscriptions contains a collection of Subscription that
        // have  expired but that still need to send some pending notification
        // to the client.
        // Once publish requests will be received from the  client
        // the notifications of those subscriptions will be processed so that
        // they can be properly disposed.
        this._closed_subscriptions = [];

        this.maxPublishRequestInQueue = options.maxPublishRequestInQueue || 100;

        this.isSessionClosed = false;
    }

    public toString(): string {
        let str = "";
        str += `maxPublishRequestInQueue ${this.maxPublishRequestInQueue}\n`;
        str += `subscriptions ${Object.keys(this._subscriptions).join()}\n`;
        str += `closed subscriptions ${this._closed_subscriptions.map((s) => s.id).join()}\n`;
        return str;
    }
    public dispose(): void {
        debugLog("ServerSidePublishEngine#dispose");

        assert(Object.keys(this._subscriptions).length === 0, "self._subscriptions count!=0");
        this._subscriptions = {};

        assert(this._closed_subscriptions.length === 0, "self._closed_subscriptions count!=0");
        this._closed_subscriptions = [];

        ServerSidePublishEngine.registry.unregister(this);
    }

    public process_subscriptionAcknowledgements(subscriptionAcknowledgements: SubscriptionAcknowledgement[]): StatusCode[] {
        // process acknowledgements
        subscriptionAcknowledgements = subscriptionAcknowledgements || [];
        debugLog("process_subscriptionAcknowledgements = ", subscriptionAcknowledgements);
        const results = subscriptionAcknowledgements.map((subscriptionAcknowledgement: SubscriptionAcknowledgement) => {
            const subscription = this.getSubscriptionById(subscriptionAcknowledgement.subscriptionId);
            if (!subscription) {
                // // try to find the session
                // const transferredSubscription = this._transferred_subscriptions.find(
                //   (s) => s.subscriptionId === subscriptionAcknowledgement.subscriptionId
                // );
                // if (transferredSubscription) {
                //   debugLog("Subscription acknowledgeNotification done in transferred subscription ");
                //   return transferredSubscription.acknowledgeNotification(subscriptionAcknowledgement.sequenceNumber);
                // }
                return StatusCodes.BadSubscriptionIdInvalid;
            }
            return subscription.acknowledgeNotification(subscriptionAcknowledgement.sequenceNumber);
        });

        return results;
    }

    /**
     * get a array of subscription handled by the publish engine.
     */
    public get subscriptions(): Subscription[] {
        return Object.values(this._subscriptions);
    }

    /**
     */
    public add_subscription(subscription: Subscription): Subscription {
        assert(subscription instanceof Subscription);
        assert(isFinite(subscription.id));
        subscription.publishEngine = (subscription.publishEngine || this) as any;
        assert((subscription.publishEngine as any) === this);
        assert(!this._subscriptions[subscription.id]);

        debugLog("ServerSidePublishEngine#add_subscription -  adding subscription with Id:", subscription.id);
        this._subscriptions[subscription.id] = subscription;
        // xx subscription._flushSentNotifications();
        return subscription;
    }

    public detach_subscription(subscription: Subscription): Subscription {
        assert(subscription instanceof Subscription);
        assert(isFinite(subscription.id));
        assert((subscription.publishEngine as any) === this);
        assert(this._subscriptions[subscription.id] === subscription);

        delete this._subscriptions[subscription.id];
        subscription.publishEngine = null as any;
        debugLog("ServerSidePublishEngine#detach_subscription detaching subscription with Id:", subscription.id);
        return subscription;
    }

    /**
     */
    public shutdown(): void {
        if (this.subscriptionCount !== 0) {
            debugLog(chalk.red("Shutting down pending subscription"));
            this.subscriptions.map((subscription: Subscription) => subscription.terminate());
        }

        assert(this.subscriptionCount === 0, "subscription shall be removed first before you can shutdown a publish engine");

        debugLog("ServerSidePublishEngine#shutdown");

        // purge _publish_request_queue
        this._publish_request_queue = [];

        // purge self._closed_subscriptions
        this._closed_subscriptions.map((subscription) => subscription.dispose());
        this._closed_subscriptions = [];
    }

    /**
     * number of pending PublishRequest available in queue
     */
    public get pendingPublishRequestCount(): number {
        return this._publish_request_queue.length;
    }

    /**
     * number of subscriptions
     */
    public get subscriptionCount(): number {
        return Object.keys(this._subscriptions).length;
    }

    public get pendingClosedSubscriptionCount(): number {
        return this._closed_subscriptions.length;
    }

    public get currentMonitoredItemCount(): number {
        const subscriptions = Object.values(this._subscriptions);
        const result = subscriptions.reduce((cumul: number, subscription: Subscription) => {
            return cumul + subscription.monitoredItemCount;
        }, 0);
        assert(isFinite(result));
        return result;
    }

    public _purge_dangling_subscription(subscriptionId: number): void {
        this._closed_subscriptions = this._closed_subscriptions.filter((s) => s.id !== subscriptionId);
    }

    public on_close_subscription(subscription: IClosedOrTransferredSubscription): void {
        doDebug && debugLog("ServerSidePublishEngine#on_close_subscription", subscription.id);
        if (subscription.hasPendingNotifications) {
            doDebug && debugLog(
                "ServerSidePublishEngine#on_close_subscription storing subscription",
                subscription.id,
                " to _closed_subscriptions because it has pending notification"
            );
            this._closed_subscriptions.push(subscription);
        } else {
            doDebug && debugLog("ServerSidePublishEngine#on_close_subscription disposing subscription", subscription.id);
            // subscription is no longer needed
            subscription.dispose();
        }

        delete this._subscriptions[subscription.id];

        while (this._feed_closed_subscription()) {
            /* keep looping */
        }
        if (this.subscriptionCount === 0 && this._closed_subscriptions.length === 0) {
            this.cancelPendingPublishRequest();
        }
    }

    /**
     * retrieve a subscription by id.
     * @param subscriptionId
     * @return Subscription
     */
    public getSubscriptionById(subscriptionId: number | string): Subscription {
        return this._subscriptions[subscriptionId.toString()];
    }

    public findLateSubscriptions(): Subscription[] {
        const subscriptions = Object.values(this._subscriptions);
        return subscriptions.filter((subscription: Subscription) => {
            return (subscription.state === SubscriptionState.LATE || !subscription.messageSent) && subscription.publishingEnabled;
        });
    }

    public get hasLateSubscriptions(): boolean {
        return this.findLateSubscriptions().length > 0;
    }

    public findLateSubscriptionsSortedByAge(): Subscription[] {
        let late_subscriptions = this.findLateSubscriptions();
        late_subscriptions = sortBy(late_subscriptions, "timeToExpiration");

        return late_subscriptions;
    }

    public cancelPendingPublishRequestBeforeChannelChange(): void {
        this._cancelPendingPublishRequest(StatusCodes.BadSecureChannelClosed);
    }

    public onSessionClose(): void {
        this.isSessionClosed = true;
        this._cancelPendingPublishRequest(StatusCodes.BadSessionClosed);
    }

    /**
     * @private
     */
    public cancelPendingPublishRequest(): void {
        assert(this.subscriptionCount === 0);
        this._cancelPendingPublishRequest(StatusCodes.BadNoSubscription);
    }

    /**
     *
     * @param request
     * @param callback
     * @private
     * @internal
     */
    public _on_PublishRequest(
        request: PublishRequest,
        callback?: (request1: PublishRequest, response: PublishResponse) => void
    ): void {
        callback = callback || dummy_function;
        assert(typeof callback === "function");

        // istanbul ignore next
        if (!(request instanceof PublishRequest)) {
            throw new Error("Internal error : expecting a Publish Request here");
        }

        const subscriptionAckResults = this.process_subscriptionAcknowledgements(request.subscriptionAcknowledgements || []);

        const currentTime = Date.now();
        const publishData: PublishData = {
            callback,
            request,
            results: subscriptionAckResults,
            serverTimeWhenReceived: currentTime
        };

        if (this.isSessionClosed) {
            traceLog("server has received a PublishRequest but session is Closed");
            this._send_error_for_request(publishData, StatusCodes.BadSessionClosed);
        } else if (this.subscriptionCount === 0) {
            if (this._closed_subscriptions.length > 0 && this._closed_subscriptions[0].hasPendingNotifications) {
                const verif = this._publish_request_queue.length;
                // add the publish request to the queue for later processing
                this._publish_request_queue.push(publishData);

                const processed = this._feed_closed_subscription();
                //xx ( may be subscription has expired by themselves) assert(verif === this._publish_request_queue.length);
                //xx  ( may be subscription has expired by themselves) assert(processed);
                return;
            }
            traceLog("server has received a PublishRequest but has no subscription opened");
            this._send_error_for_request(publishData, StatusCodes.BadNoSubscription);
        } else {
            // add the publish request to the queue for later processing
            this._publish_request_queue.push(publishData);
            assert(this.pendingPublishRequestCount > 0);

            debugLog(chalk.bgWhite.red("Adding a PublishRequest to the queue "), this._publish_request_queue.length);

            this._feed_closed_subscription();

            this._feed_late_subscription();

            this._handle_too_many_requests();
        }
    }

    private _find_starving_subscription(): Subscription | null {
        const late_subscriptions = this.findLateSubscriptions();
        function compare_subscriptions(s1: Subscription, s2: Subscription): number {
            if (s1.priority === s2.priority) {
                return s1.timeToExpiration < s2.timeToExpiration ? 1 : 0;
            }
            return s1.priority > s2.priority ? 1 : 0;
        }
        function findLateSubscriptionSortedByPriority() {
            if (late_subscriptions.length === 0) {
                return null;
            }
            late_subscriptions.sort(compare_subscriptions);

            // istanbul ignore next
            if (doDebug) {
                debugLog(
                    late_subscriptions
                        .map(
                            (s: Subscription) =>
                                "[ id = " +
                                s.id +
                                " prio=" +
                                s.priority +
                                " t=" +
                                s.timeToExpiration +
                                " ka=" +
                                s.timeToKeepAlive +
                                " m?=" +
                                s.hasUncollectedMonitoredItemNotifications +
                                " " + 
                                SubscriptionState[s.state] +
                                " " + s.messageSent + 
                                "]"
                        )
                        .join(" \n")
                );
            }
            return late_subscriptions[late_subscriptions.length - 1];
        }

        if (this._closed_subscriptions) {
            /** */
        }
        const starving_subscription = /* this.findSubscriptionWaitingForFirstPublish() || */ findLateSubscriptionSortedByPriority();
        return starving_subscription;
    }

    private _feed_late_subscription() {
        setImmediate(() => {
            if (!this.pendingPublishRequestCount) {
                return;
            }
            const starving_subscription = this._find_starving_subscription();
            if (starving_subscription) {
                doDebug && debugLog(chalk.bgWhite.red("feeding most late subscription subscriptionId  = "), starving_subscription.id);
                starving_subscription.process_subscription();
            }
        });
    }

    private _feed_closed_subscription() {
        if (!this.pendingPublishRequestCount) {
            return false;
        }

        if (this._closed_subscriptions.length === 0) {
            debugLog("ServerSidePublishEngine#_feed_closed_subscription  -> nothing to do");
            return false;
        }
        // process closed subscription
        const closed_subscription = this._closed_subscriptions[0]!;
        assert(closed_subscription.hasPendingNotifications);
        debugLog("ServerSidePublishEngine#_feed_closed_subscription for closed_subscription ", closed_subscription.id);
        closed_subscription?._publish_pending_notifications();
        if (!closed_subscription?.hasPendingNotifications) {
            closed_subscription.dispose();
            this._closed_subscriptions.shift();
        }
        return true;
    }

    private _send_error_for_request(publishData: PublishData, statusCode: StatusCode): void {
        _assertValidPublishData(publishData);
        const publishResponse = new PublishResponse({
            responseHeader: { serviceResult: statusCode }
        });
        this._send_response_for_request(publishData, publishResponse);
    }

    private _cancelPendingPublishRequest(statusCode: StatusCode): void {
        if (this._publish_request_queue) {
            debugLog(
                chalk.red("Cancelling pending PublishRequest with statusCode  "),
                statusCode.toString(),
                " length =",
                this._publish_request_queue.length
            );
        } else {
            debugLog(chalk.red("No pending PublishRequest to cancel"));
        }

        for (const publishData of this._publish_request_queue) {
            this._send_error_for_request(publishData, statusCode);
        }
        this._publish_request_queue = [];
    }

    private _handle_too_many_requests() {
        if (this.pendingPublishRequestCount > this.maxPublishRequestInQueue) {
            traceLog(
                "server has received too many PublishRequest",
                this.pendingPublishRequestCount,
                "/",
                this.maxPublishRequestInQueue
            );
            assert(this.pendingPublishRequestCount === this.maxPublishRequestInQueue + 1);
            // When a Server receives a new Publish request that exceeds its limit it shall de-queue the oldest Publish
            // request and return a response with the result set to Bad_TooManyPublishRequests.

            // dequeue oldest request
            const publishData = this._publish_request_queue.shift()!;
            this._send_error_for_request(publishData, StatusCodes.BadTooManyPublishRequests);
        }
    }

    /**
     * call by a subscription when no notification message is available after the keep alive delay has
     * expired.
     *
     * @method send_keep_alive_response
     * @param subscriptionId
     * @param future_sequence_number
     * @return true if a publish response has been sent
     */
    public send_keep_alive_response(subscriptionId: number, future_sequence_number: number): boolean {
        //  this keep-alive Message informs the Client that the Subscription is still active.
        //  Each keep-alive Message is a response to a Publish request in which the  notification Message
        //  parameter does not contain any Notifications and that contains the sequence number of the next
        //  Notification Message that is to be sent.

        const subscription = this.getSubscriptionById(subscriptionId);
        /* istanbul ignore next */
        if (!subscription) {
            traceLog("send_keep_alive_response  => invalid subscriptionId = ", subscriptionId);
            return false;
        }
        // let check if we have available PublishRequest to send the keep alive
        if (this.pendingPublishRequestCount === 0 || subscription.hasPendingNotifications) {
            // we cannot send the keep alive PublishResponse
            traceLog(
                "send_keep_alive_response  => cannot send keep-alive  (no PublishRequest left) subscriptionId = ",
                subscriptionId
            );
            return false;
        }
        debugLog(
            `Sending keep alive response for subscription id ${subscription.id} ${subscription.publishingInterval} ${subscription.maxKeepAliveCount}`
        );
        this._send_response(
            subscription,
            new PublishResponse({
                availableSequenceNumbers: subscription.getAvailableSequenceNumbers(),
                moreNotifications: false,
                notificationMessage: {
                    sequenceNumber: future_sequence_number
                },
                subscriptionId
            })
        );
        return true;
    }
    public _send_response(subscription: Subscription, response: PublishResponse): void {
        assert(this.pendingPublishRequestCount > 0);
        assert(response.subscriptionId !== 0xffffff);
        const publishData = this._publish_request_queue.shift()!;
        this._send_response_for_request(publishData, response);
    }

    public _on_tick(): void {
        this._cancelTimeoutRequests();
    }

    private _cancelTimeoutRequests(): void {
        if (this._publish_request_queue.length === 0) {
            return;
        }

        // filter out timeout requests
        const parts = partition(this._publish_request_queue, timeout_filter);

        this._publish_request_queue = parts[1]; // still valid

        const invalid_published_request = parts[0];
        for (const publishData of invalid_published_request) {
            if (doDebug) {
                debugLog(chalk.cyan(" CANCELING TIMEOUT PUBLISH REQUEST "));
            }
            this._send_error_for_request(publishData, StatusCodes.BadTimeout);
        }
    }

    public _send_response_for_request(publishData: PublishData, response: PublishResponse): void {
        if (doDebug) {
            debugLog("_send_response_for_request ", response.toString());
        }
        _assertValidPublishData(publishData);
        // xx assert(response.responseHeader.requestHandle !== 0,"expecting a valid requestHandle");
        response.results = publishData.results;
        response.responseHeader.requestHandle = publishData.request.requestHeader.requestHandle;
        publishData.callback(publishData.request, response);
    }
}
