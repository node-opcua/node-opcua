/**
 * @module node-opcua-server
 */
// tslint:disable:no-console
import chalk from "chalk";
import { EventEmitter } from "events";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import { StatusCode, StatusCodes } from "node-opcua-status-code";

import { PublishRequest, PublishResponse, SubscriptionAcknowledgement } from "node-opcua-types";
import { Subscription } from "./server_subscription";
import { SubscriptionState } from "./server_subscription";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function traceLog(...args: [any?, ...any[]]) {
    if (!doDebug) {
        return;
    }
    const a: string[] = args.map((x?: any) => x!);
    a.unshift(chalk.yellow(" TRACE "));
    console.log.apply(null, a as [any?, ...any[]]);
}

export interface ServerSidePublishEngineOptions {
    maxPublishRequestInQueue?: number;
}

interface PublishData {
    request: PublishRequest;
    results: StatusCode[];
    callback: (request: PublishRequest, response: PublishResponse) => void;
}

function _assertValidPublishData(publishData: PublishData) {
    assert(publishData.request instanceof PublishRequest);
    assert(_.isArray(publishData.results));
    assert(_.isFunction(publishData.callback));
}

function dummy_function() {
    /* empty */
}

function prepare_timeout_info(request: PublishRequest) {
    // record received time
    request.requestHeader.timestamp = request.requestHeader.timestamp || new Date();
    assert(request.requestHeader.timeoutHint >= 0);
    (request as any).received_time = Date.now();
    (request as any).timeout_time = (request.requestHeader.timeoutHint > 0)
      ? (request as any).received_time + request.requestHeader.timeoutHint : 0;
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
    const expected_timeout_time = addDate(request.requestHeader.timestamp!, request.requestHeader.timeoutHint);
    return expected_timeout_time.getTime() < Date.now();
}

/***
 * @class ServerSidePublishEngine
 *  a Publish Engine for a given session
 * @param options {Object}
 * @param [options.maxPublishRequestInQueue= 100] {Integer}
 * @constructor
 */
export class ServerSidePublishEngine extends EventEmitter {

    public static registry = new ObjectRegistry();

    /**
     * @method transferSubscriptionsToOrphan
     * @param srcPublishEngine {ServerSidePublishEngine}
     * @param destPublishEngine {ServerSidePublishEngine}
     * @return void
     * @private
     * @static
     */
    public static transferSubscriptionsToOrphan(
      srcPublishEngine: ServerSidePublishEngine,
      destPublishEngine: ServerSidePublishEngine
    ) {

        debugLog(chalk.yellow("ServerSidePublishEngine#transferSubscriptionsToOrphan! " +
          "start transferring long live subscriptions to orphan"));

        const tmp = srcPublishEngine._subscriptions;
        _.forEach(tmp, (subscription: Subscription) => {
            assert(subscription.publishEngine === srcPublishEngine);

            if (subscription.$session) {
                subscription.$session._unexposeSubscriptionDiagnostics(subscription);
            } else {
                console.warn("Warning:  subscription", subscription.id, " has no session attached!!!");
            }

            ServerSidePublishEngine.transferSubscription(subscription, destPublishEngine, false);
        });
        assert(srcPublishEngine.subscriptionCount === 0);

        debugLog(chalk.yellow("ServerSidePublishEngine#transferSubscriptionsToOrphan! " +
          "end transferring long lived subscriptions to orphan"));
    }

    /**
     * @method transferSubscription
     *
     * @param subscription
     * @param destPublishEngine
     * @param sendInitialValues true if initial values should be sent
     * @private
     */
    public static transferSubscription(
      subscription: Subscription,
      destPublishEngine: ServerSidePublishEngine,
      sendInitialValues: boolean
    ): void {

        const srcPublishEngine = subscription.publishEngine;

        assert(!destPublishEngine.getSubscriptionById(subscription.id));
        assert(srcPublishEngine.getSubscriptionById(subscription.id));

        debugLog(chalk.cyan("ServerSidePublishEngine.transferSubscription live subscriptionId ="),
          subscription.subscriptionId);

        subscription.notifyTransfer();
        destPublishEngine.add_subscription(srcPublishEngine.detach_subscription(subscription));
        subscription.resetLifeTimeCounter();
        if (sendInitialValues) {
            subscription.resendInitialValues();
        }

        assert(destPublishEngine.getSubscriptionById(subscription.id));
        assert(!srcPublishEngine.getSubscriptionById(subscription.id));

    }

    public maxPublishRequestInQueue: number = 0;
    public isSessionClosed: boolean = false;

    private _publish_request_queue: PublishData[] = [];
    private _publish_response_queue: PublishResponse[] = [];
    private _subscriptions: { [key: string]: Subscription };
    private _closed_subscriptions: Subscription[] = [];

    constructor(options: ServerSidePublishEngineOptions) {

        super();

        options = options || {};

        ServerSidePublishEngine.registry.register(this);

        // a queue of pending publish request send by the client
        // waiting to be used by the server to send notification
        this._publish_request_queue = [];  // { request :/*PublishRequest*/{},
                                           // results: [/*subscriptionAcknowledgements*/] , callback}
        this._publish_response_queue = []; // /* PublishResponse */

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

    public dispose() {

        debugLog("ServerSidePublishEngine#dispose");

        // force deletion of publish response not sent
        this._publish_response_queue = [];

        assert(this._publish_response_queue.length === 0, "self._publish_response_queue !=0");
        this._publish_response_queue = [];

        assert(Object.keys(this._subscriptions).length === 0, "self._subscriptions count!=0");
        this._subscriptions = {};

        assert(this._closed_subscriptions.length === 0, "self._closed_subscriptions count!=0");
        this._closed_subscriptions = [];

        ServerSidePublishEngine.registry.unregister(this);

    }

    public process_subscriptionAcknowledgements(
      subscriptionAcknowledgements: SubscriptionAcknowledgement[]
    ): StatusCode[] {
        // process acknowledgements
        subscriptionAcknowledgements = subscriptionAcknowledgements || [];

        const results = subscriptionAcknowledgements.map(
          (subscriptionAcknowledgement: SubscriptionAcknowledgement) => {

              const subscription = this.getSubscriptionById(subscriptionAcknowledgement.subscriptionId);
              if (!subscription) {
                  return StatusCodes.BadSubscriptionIdInvalid;
              }
              return subscription.acknowledgeNotification(subscriptionAcknowledgement.sequenceNumber);
          });

        return results;
    }

    /**
     * get a array of subscription handled by the publish engine.
     * @property subscription {Subscription[]}
     */
    public get subscriptions(): Subscription[] {
        return _.map(this._subscriptions, (x: Subscription) => x);
    }

    /**
     * @method add_subscription
     * @param subscription  {Subscription}
     */
    public add_subscription(
      subscription: Subscription
    ): Subscription {

        assert(subscription instanceof Subscription);
        assert(_.isFinite(subscription.id));
        subscription.publishEngine = subscription.publishEngine || this;
        assert(subscription.publishEngine === this);
        assert(!this._subscriptions[subscription.id]);

        debugLog("ServerSidePublishEngine#add_subscription -  adding subscription with Id:", subscription.id);
        this._subscriptions[subscription.id] = subscription;

        return subscription;
    }

    public detach_subscription(
      subscription: Subscription
    ): Subscription {
        assert(subscription instanceof Subscription);
        assert(_.isFinite(subscription.id));
        assert(subscription.publishEngine === this);
        assert(this._subscriptions[subscription.id] === subscription);

        delete this._subscriptions[subscription.id];
        subscription.publishEngine = null;

        debugLog("ServerSidePublishEngine#detach_subscription detaching subscription with Id:", subscription.id);
        return subscription;
    }

    /**
     * @method shutdown
     */
    public shutdown() {

        if (this.subscriptionCount !== 0) {
            debugLog(chalk.red("Shutting down pending subscription"));
            this.subscriptions.map((subscription: Subscription) =>
              subscription.terminate());
        }

        assert(this.subscriptionCount === 0,
          "subscription shall be removed first before you can shutdown a publish engine");

        debugLog("ServerSidePublishEngine#shutdown");

        // purge _publish_request_queue
        this._publish_request_queue = [];

        // purge _publish_response_queue
        this._publish_response_queue = [];

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

        const result = _.reduce(this._subscriptions, (cumul: number, subscription: Subscription) => {
            return cumul + subscription.monitoredItemCount;
        }, 0);
        assert(_.isFinite(result));
        return result;
    }

    public on_close_subscription(subscription: Subscription): void {

        debugLog("ServerSidePublishEngine#on_close_subscription", subscription.id);
        assert(this._subscriptions.hasOwnProperty(subscription.id));
        assert(subscription.publishEngine === this, "subscription must belong to this ServerSidePublishEngine");

        if (subscription.hasPendingNotifications) {

            debugLog("ServerSidePublishEngine#on_close_subscription storing subscription",
              subscription.id, " to _closed_subscriptions because it has pending notification");

            this._closed_subscriptions.push(subscription);
        } else {
            debugLog("ServerSidePublishEngine#on_close_subscription disposing subscription",
              subscription.id);

            // subscription is no longer needed
            subscription.dispose();
        }

        delete this._subscriptions[subscription.id];

        if (this.subscriptionCount === 0) {
            while (this._feed_closed_subscription()) {
                /* keep looping */
            }
            this.cancelPendingPublishRequest();
        }
    }

    /**
     * retrieve a subscription by id.
     * @method getSubscriptionById
     * @param subscriptionId
     * @return {Subscription}
     */
    public getSubscriptionById(subscriptionId: number | string): Subscription {
        return this._subscriptions[subscriptionId.toString()];
    }

    public findSubscriptionWaitingForFirstPublish() {
        // find all subscriptions that are late and sort them by urgency
        let subscriptions_waiting_for_first_reply = _.filter(this._subscriptions,
          (subscription: Subscription) => {
              return !subscription.messageSent && subscription.state === SubscriptionState.LATE;
          });

        if (subscriptions_waiting_for_first_reply.length) {
            subscriptions_waiting_for_first_reply = _(subscriptions_waiting_for_first_reply).sortBy("timeToExpiration");
            debugLog("Some subscriptions with messageSent === false ");
            return subscriptions_waiting_for_first_reply[0];
        }
        return null;
    }

    public findLateSubscriptions(): Subscription[] {
        return _.filter(this._subscriptions, (subscription: Subscription) => {
            return subscription.state === SubscriptionState.LATE
              && subscription.publishingEnabled; // && subscription.hasMonitoredItemNotifications;
        });
    }

    public get hasLateSubscriptions(): boolean {
        return this.findLateSubscriptions().length > 0;
    }

    public findLateSubscriptionSortedByPriority() {

        const late_subscriptions = this.findLateSubscriptions();
        if (late_subscriptions.length === 0) {
            return null;
        }
        late_subscriptions.sort(compare_subscriptions);

        // istanbul ignore next
        if (doDebug) {
            debugLog(late_subscriptions.map(
              (s: Subscription) => "[ id = " + s.id +
                " prio=" + s.priority +
                " t=" + s.timeToExpiration +
                " ka=" + s.timeToKeepAlive +
                " m?=" + s.hasMonitoredItemNotifications + "]"
            ).join(" \n"));
        }
        return late_subscriptions[late_subscriptions.length - 1];
    }

    public findLateSubscriptionsSortedByAge() {

        let late_subscriptions = this.findLateSubscriptions();
        late_subscriptions = _(late_subscriptions).sortBy("timeToExpiration");

        return late_subscriptions;
    }

    public cancelPendingPublishRequestBeforeChannelChange() {
        this._cancelPendingPublishRequest(StatusCodes.BadSecureChannelClosed);
    }

    public onSessionClose() {
        this.isSessionClosed = true;
        this._cancelPendingPublishRequest(StatusCodes.BadSessionClosed);
    }

    /**
     * @private
     */
    public cancelPendingPublishRequest() {
        assert(this.subscriptionCount === 0);
        this._cancelPendingPublishRequest(StatusCodes.BadNoSubscription);
    }

    /**
     *
     * @param request
     * @param callback
     * @private
     */
    public _on_PublishRequest(request: PublishRequest, callback: any) {

        // xx console.log("#_on_PublishRequest self._publish_request_queue.length before ",
        // self._publish_request_queue.length);

        callback = callback || dummy_function;
        if (!(request instanceof PublishRequest)) {
            throw new Error("Internal error : expecting a Publish Request here");
        }

        assert(_.isFunction(callback));

        const subscriptionAckResults = this.process_subscriptionAcknowledgements(
          request.subscriptionAcknowledgements || []);

        const publishData: PublishData = {
            callback,
            request,
            results: subscriptionAckResults
        };

        if (this._process_pending_publish_response(publishData)) {
            console.log(" PENDING RESPONSE HAS BEEN PROCESSED !");
            return;
        }

        if (this.isSessionClosed) {

            traceLog("server has received a PublishRequest but session is Closed");
            this.send_error_for_request(publishData, StatusCodes.BadSessionClosed);

        } else if (this.subscriptionCount === 0) {

            if (this._closed_subscriptions.length > 0 && this._closed_subscriptions[0].hasPendingNotifications) {

                const verif = this._publish_request_queue.length;
                // add the publish request to the queue for later processing
                this._publish_request_queue.push(publishData);

                const processed = this._feed_closed_subscription();
                assert(verif === this._publish_request_queue.length);
                assert(processed);
                return;
            }
            traceLog("server has received a PublishRequest but has no subscription opened");
            this.send_error_for_request(publishData, StatusCodes.BadNoSubscription);

        } else {

            prepare_timeout_info(request);

            // add the publish request to the queue for later processing
            this._publish_request_queue.push(publishData);

            debugLog(
              chalk.bgWhite.red("Adding a PublishRequest to the queue "),
              this._publish_request_queue.length);

            this._feed_late_subscription();

            this._feed_closed_subscription();

            this._handle_too_many_requests();

        }
    }

    private _feed_late_subscription() {

        if (!this.pendingPublishRequestCount) {
            return;
        }
        const starving_subscription = this.findSubscriptionWaitingForFirstPublish()
          || this.findLateSubscriptionSortedByPriority();

        if (starving_subscription) {
            debugLog(
              chalk.bgWhite.red("feeding most late subscription subscriptionId  = "),
              starving_subscription.id);
            starving_subscription.process_subscription();
        }
    }

    private _feed_closed_subscription() {

        if (!this.pendingPublishRequestCount) {
            return false;
        }

        debugLog("ServerSidePublishEngine#_feed_closed_subscription");
        const closed_subscription = this._closed_subscriptions.shift();
        if (closed_subscription) {

            traceLog("_feed_closed_subscription for closed_subscription ", closed_subscription.id);

            if (closed_subscription.hasPendingNotifications) {
                closed_subscription._publish_pending_notifications();

                // now closed_subscription can be disposed
                closed_subscription.dispose();

                return true;
            }
        }
        return false;
    }

    private send_error_for_request(
      publishData: PublishData,
      statusCode: StatusCode
    ): void {
        _assertValidPublishData(publishData);
        this.send_response_for_request(publishData, new PublishResponse({
            responseHeader: { serviceResult: statusCode }
        }));
    }

    private _cancelPendingPublishRequest(statusCode: StatusCode): void {

        debugLog(
          chalk.red("Cancelling pending PublishRequest with statusCode  "),
          statusCode.toString(), " length =", this._publish_request_queue.length);

        for (const publishData of this._publish_request_queue) {
            this.send_error_for_request(publishData, statusCode);
        }
        this._publish_request_queue = [];
    }

    private _handle_too_many_requests() {

        if (this.pendingPublishRequestCount > this.maxPublishRequestInQueue) {

            traceLog("server has received too many PublishRequest",
              this.pendingPublishRequestCount, "/", this.maxPublishRequestInQueue);
            assert(this.pendingPublishRequestCount === (this.maxPublishRequestInQueue + 1));
            // When a Server receives a new Publish request that exceeds its limit it shall de-queue the oldest Publish
            // request and return a response with the result set to Bad_TooManyPublishRequests.

            // dequeue oldest request
            const publishData = this._publish_request_queue.shift()!;
            this.send_error_for_request(publishData, StatusCodes.BadTooManyPublishRequests);
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
    private send_keep_alive_response(
      subscriptionId: number,
      future_sequence_number: number
    ): boolean {

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

        if (this.pendingPublishRequestCount === 0) {
            return false;
        }

        const sequenceNumber = future_sequence_number;
        this.send_notification_message({
            moreNotifications: false,
            notificationData: [],
            sequenceNumber,
            subscriptionId
        }, false);

        return true;
    }

    private _on_tick(): void {
        this._cancelTimeoutRequests();
    }

    private _cancelTimeoutRequests(): void {

        if (this._publish_request_queue.length === 0) {
            return;
        }

        // filter out timeout requests
        const partition = _.partition(this._publish_request_queue, timeout_filter);

        this._publish_request_queue = partition[1]; // still valid

        const invalid_published_request = partition[0];
        invalid_published_request.forEach((publishData: any) => {
            console.log(chalk.cyan(" CANCELING TIMEOUT PUBLISH REQUEST "));
            const response = new PublishResponse({
                responseHeader: { serviceResult: StatusCodes.BadTimeout }
            });
            this.send_response_for_request(publishData, response);
        });
    }

    /**
     * @method send_notification_message
     * @param param                          {Object}
     * @param param.subscriptionId           {Number}
     * @param param.sequenceNumber           {Number}
     * @param param.notificationData         {Object}
     * @param param.availableSequenceNumbers {Array<Number>}
     * @param param.moreNotifications        {Boolean}
     * @param force                          {Boolean} push response in queue until next publish Request is received
     * @private
     */
    private send_notification_message(param: any, force: boolean) {

        assert(this.pendingPublishRequestCount > 0 || force);

        assert(!param.hasOwnProperty("availableSequenceNumbers"));
        assert(param.hasOwnProperty("subscriptionId"));
        assert(param.hasOwnProperty("sequenceNumber"));
        assert(param.hasOwnProperty("notificationData"));
        assert(param.hasOwnProperty("moreNotifications"));

        const subscription = this.getSubscriptionById(param.subscriptionId);

        const subscriptionId = param.subscriptionId;
        const sequenceNumber = param.sequenceNumber;
        const notificationData = param.notificationData;
        const moreNotifications = param.moreNotifications;

        const availableSequenceNumbers = subscription ? subscription.getAvailableSequenceNumbers() : [];

        const response = new PublishResponse({
            availableSequenceNumbers,
            moreNotifications,
            notificationMessage: {
                notificationData,
                publishTime: new Date(),
                sequenceNumber
            },
            subscriptionId
        });

        if (this.pendingPublishRequestCount === 0) {
            console.log(
              chalk.bgRed.white.bold(
                " -------------------------------- PUSHING PUBLISH RESPONSE FOR LATE ANSWER !"));

            this._publish_response_queue.push(response);
        } else {
            const publishData = this._publish_request_queue.shift()!;
            this.send_response_for_request(publishData, response);
        }

    }

    private _process_pending_publish_response(publishData: PublishData) {

        _assertValidPublishData(publishData);
        if (this._publish_response_queue.length === 0) {
            // no pending response to send
            return false;
        }
        assert(this._publish_request_queue.length === 0);
        const response = this._publish_response_queue.shift()!;

        this.send_response_for_request(publishData, response);
        return true;
    }

    private send_response_for_request(
      publishData: PublishData,
      response: PublishResponse
    ) {
        _assertValidPublishData(publishData);
        // xx assert(response.responseHeader.requestHandle !== 0,"expecting a valid requestHandle");
        response.results = publishData.results;
        response.responseHeader.requestHandle = publishData.request.requestHeader.requestHandle;
        publishData.callback(publishData.request, response);
    }

}

function compare_subscriptions(s1: Subscription, s2: Subscription): number {
    if (s1.priority === s2.priority) {
        return s1.timeToExpiration < s2.timeToExpiration ? 1 : 0;
    }
    return s1.priority > s2.priority ? 1 : 0;
}
