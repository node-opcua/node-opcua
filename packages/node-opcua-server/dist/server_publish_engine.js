/**
 * @module node-opcua-server
 */
var _a;
import { EventEmitter } from "node:events";
import chalk from "chalk";
import partition from "lodash.partition";
import sortBy from "lodash.sortby";
import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import { StatusCodes } from "node-opcua-status-code";
import { PublishRequest, PublishResponse, ServiceFault } from "node-opcua-types";
import { Subscription, SubscriptionState } from "./server_subscription.js";
const debugLog = make_debugLog("server_publish_engine");
const doDebug = checkDebugFlag("server_publish_engine");
function traceLog(...args) {
    if (!doDebug) {
        return;
    }
    const a = args.map((x) => String(x));
    a.unshift(chalk.yellow(" TRACE "));
    /* c8 ignore next */
    doDebug && debugLog(...a);
}
function _assertValidPublishData(publishData) {
    assert(publishData.request instanceof PublishRequest);
    assert(typeof publishData.serverTimeWhenReceived === "number");
    assert(Array.isArray(publishData.results));
    assert(typeof publishData.callback === "function");
}
function dummy_function() {
    /* empty */
}
function addDate(date, delta) {
    return new Date(date.getTime() + delta);
}
function timeout_filter(publishData) {
    const request = publishData.request;
    const _results = publishData.results;
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
export class ServerSidePublishEngine extends EventEmitter {
    static registry = new ObjectRegistry();
    /**
     * @private
     */
    static transferSubscriptionsToOrphan(srcPublishEngine, destPublishEngine) {
        /* c8 ignore next */
        doDebug &&
            debugLog(chalk.yellow("ServerSidePublishEngine#transferSubscriptionsToOrphan! " +
                "start transferring long live subscriptions to orphan"));
        for (const subscription of Object.values(srcPublishEngine._subscriptions)) {
            assert(subscription.publishEngine === srcPublishEngine);
            if (subscription.$session) {
                subscription.$session._unexposeSubscriptionDiagnostics(subscription);
            }
            else {
                console.warn("Warning:  subscription", subscription.id, " has no session attached!!!");
            }
            _a.transferSubscription(subscription, destPublishEngine, false);
        }
        assert(srcPublishEngine.subscriptionCount === 0);
        /* c8 ignore next */
        doDebug &&
            debugLog(chalk.yellow("ServerSidePublishEngine#transferSubscriptionsToOrphan! " +
                "end transferring long lived subscriptions to orphan"));
    }
    /**
     * @param subscription
     * @param destPublishEngine
     * @param sendInitialValues true if initial values should be sent
     * @private
     */
    static async transferSubscription(subscription, destPublishEngine, sendInitialValues) {
        const srcPublishEngine = subscription.publishEngine;
        assert(!destPublishEngine.getSubscriptionById(subscription.id));
        assert(srcPublishEngine.getSubscriptionById(subscription.id));
        // remove pending StatusChangeNotification on the same session that may exist already
        destPublishEngine._purge_dangling_subscription(subscription.id);
        /* c8 ignore next */
        doDebug &&
            debugLog(chalk.cyan("ServerSidePublishEngine.transferSubscription live subscriptionId ="), subscription.subscriptionId);
        // xx const internalNotification = subscription._flushSentNotifications();
        /* c8 ignore next */
        doDebug &&
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
    maxPublishRequestInQueue = 0;
    isSessionClosed = false;
    _publish_request_queue = [];
    _subscriptions;
    _closed_subscriptions = [];
    // used by feedReadySubscriptions to arbitrate fairly, by priority then turn order, across
    // subscriptions of this session instead of letting whichever one ticks first monopolize the queue
    #serveSequence = 0;
    #lastServedAt = new WeakMap();
    // valid PublishResponses sent so far: feedReadySubscriptions' measure of progress, which the
    // queue length is not when the client re-sends its next Publish from the response callback
    #responseCount = 0;
    constructor(options) {
        super();
        options = options || {};
        _a.registry.register(this);
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
    toString() {
        let str = "";
        str += `maxPublishRequestInQueue ${this.maxPublishRequestInQueue}\n`;
        str += `subscriptions ${Object.keys(this._subscriptions).join()}\n`;
        str += `closed subscriptions ${this._closed_subscriptions.map((s) => s.id).join()}\n`;
        return str;
    }
    dispose() {
        // c8 ignore next
        doDebug && debugLog("ServerSidePublishEngine#dispose");
        assert(Object.keys(this._subscriptions).length === 0, "self._subscriptions count!=0");
        this._subscriptions = {};
        assert(this._closed_subscriptions.length === 0, "self._closed_subscriptions count!=0");
        this._closed_subscriptions = [];
        _a.registry.unregister(this);
    }
    process_subscriptionAcknowledgements(subscriptionAcknowledgements) {
        // process acknowledgements
        subscriptionAcknowledgements = subscriptionAcknowledgements || [];
        // c8 ignore next
        doDebug && debugLog("process_subscriptionAcknowledgements = ", subscriptionAcknowledgements);
        const results = subscriptionAcknowledgements.map((subscriptionAcknowledgement) => {
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
    get subscriptions() {
        return Object.values(this._subscriptions);
    }
    /**
     */
    add_subscription(subscription) {
        assert(subscription instanceof Subscription);
        assert(Number.isFinite(subscription.id));
        subscription.publishEngine = subscription.publishEngine || this;
        assert(subscription.publishEngine === this);
        assert(!this._subscriptions[subscription.id]);
        // c8 ignore next
        doDebug && debugLog("ServerSidePublishEngine#add_subscription -  adding subscription with Id:", subscription.id);
        this._subscriptions[subscription.id] = subscription;
        // xx subscription._flushSentNotifications();
        return subscription;
    }
    detach_subscription(subscription) {
        assert(subscription instanceof Subscription);
        assert(Number.isFinite(subscription.id));
        assert(subscription.publishEngine === this);
        assert(this._subscriptions[subscription.id] === subscription);
        delete this._subscriptions[subscription.id];
        subscription.publishEngine = null;
        // c8 ignore next
        doDebug && debugLog("ServerSidePublishEngine#detach_subscription detaching subscription with Id:", subscription.id);
        return subscription;
    }
    /**
     */
    shutdown() {
        if (this.subscriptionCount !== 0) {
            // c8 ignore next
            doDebug && debugLog(chalk.red("Shutting down pending subscription"));
            this.subscriptions.map((subscription) => subscription.terminate());
        }
        assert(this.subscriptionCount === 0, "subscription shall be removed first before you can shutdown a publish engine");
        // c8 ignore next
        doDebug && debugLog("ServerSidePublishEngine#shutdown");
        // purge _publish_request_queue
        this._publish_request_queue = [];
        // purge self._closed_subscriptions
        this._closed_subscriptions.map((subscription) => subscription.dispose());
        this._closed_subscriptions = [];
    }
    /**
     * number of pending PublishRequest available in queue
     */
    get pendingPublishRequestCount() {
        return this._publish_request_queue.length;
    }
    /**
     * number of subscriptions
     */
    get subscriptionCount() {
        return Object.keys(this._subscriptions).length;
    }
    get pendingClosedSubscriptionCount() {
        return this._closed_subscriptions.length;
    }
    get currentMonitoredItemCount() {
        const subscriptions = Object.values(this._subscriptions);
        const result = subscriptions.reduce((sum, subscription) => {
            return sum + subscription.monitoredItemCount;
        }, 0);
        return result;
    }
    _purge_dangling_subscription(subscriptionId) {
        this._closed_subscriptions = this._closed_subscriptions.filter((s) => s.id !== subscriptionId);
    }
    on_close_subscription(subscription) {
        doDebug && debugLog("ServerSidePublishEngine#on_close_subscription", subscription.id);
        if (subscription.hasPendingNotifications) {
            doDebug &&
                debugLog("ServerSidePublishEngine#on_close_subscription storing subscription", subscription.id, " to _closed_subscriptions because it has pending notification");
            this._closed_subscriptions.push(subscription);
        }
        else {
            doDebug && debugLog("ServerSidePublishEngine#on_close_subscription disposing subscription", subscription.id);
            // subscription is no longer needed
            subscription.dispose();
        }
        delete this._subscriptions[subscription.id];
        while (this.#_feed_closed_subscription()) {
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
    getSubscriptionById(subscriptionId) {
        return this._subscriptions[subscriptionId.toString()];
    }
    findLateSubscriptions() {
        const subscriptions = Object.values(this._subscriptions);
        return subscriptions.filter((subscription) => {
            return (subscription.state === SubscriptionState.LATE || !subscription.messageSent) && subscription.publishingEnabled;
        });
    }
    get hasLateSubscriptions() {
        return this.findLateSubscriptions().length > 0;
    }
    findLateSubscriptionsSortedByAge() {
        let late_subscriptions = this.findLateSubscriptions();
        late_subscriptions = sortBy(late_subscriptions, "timeToExpiration");
        return late_subscriptions;
    }
    cancelPendingPublishRequestBeforeChannelChange() {
        this._cancelPendingPublishRequest(StatusCodes.BadSecureChannelClosed);
    }
    onSessionClose() {
        this.isSessionClosed = true;
        this._cancelPendingPublishRequest(StatusCodes.BadSessionClosed);
    }
    /**
     * @private
     */
    cancelPendingPublishRequest() {
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
    _on_PublishRequest(request, callback) {
        callback = callback || dummy_function;
        assert(typeof callback === "function");
        // c8 ignore next
        if (!(request instanceof PublishRequest)) {
            throw new Error("Internal error : expecting a Publish Request here");
        }
        const subscriptionAckResults = this.process_subscriptionAcknowledgements(request.subscriptionAcknowledgements || []);
        const currentTime = Date.now();
        const publishData = {
            callback,
            request,
            results: subscriptionAckResults,
            serverTimeWhenReceived: currentTime
        };
        if (this.isSessionClosed) {
            traceLog("server has received a PublishRequest but session is Closed");
            this._send_error_for_request(publishData, StatusCodes.BadSessionClosed);
        }
        else if (this.subscriptionCount === 0) {
            if (this._closed_subscriptions.length > 0 && this._closed_subscriptions[0].hasPendingNotifications) {
                const _verif = this._publish_request_queue.length;
                // add the publish request to the queue for later processing
                this._publish_request_queue.push(publishData);
                const _processed = this.#_feed_closed_subscription();
                //xx ( may be subscription has expired by themselves) assert(verif === this._publish_request_queue.length);
                //xx  ( may be subscription has expired by themselves) assert(processed);
                return;
            }
            traceLog("server has received a PublishRequest but has no subscription opened");
            this._send_error_for_request(publishData, StatusCodes.BadNoSubscription);
        }
        else {
            // add the publish request to the queue for later processing
            this._publish_request_queue.push(publishData);
            assert(this.pendingPublishRequestCount > 0);
            // c8 ignore next
            doDebug && debugLog(chalk.bgWhite.red("Adding a PublishRequest to the queue "), this._publish_request_queue.length);
            this.#_feed_closed_subscription();
            this.#_feed_late_subscription();
            this.#_handle_too_many_requests();
        }
    }
    /**
     * A subscription is *ready* when it may publish notifications now. A disabled one never is:
     * SetPublishingMode(false) makes it hold its notifications back and owe nothing but keep-alives
     * (Part 4 5.13.4), so its queued samples must neither qualify nor disqualify it here.
     */
    static #isReady(subscription) {
        return (subscription.publishingEnabled &&
            (subscription.hasPendingNotifications || subscription.hasUncollectedMonitoredItemNotifications));
    }
    /**
     * A subscription with nothing to publish whose keep-alive deadline has passed: its own tick
     * found no PublishRequest when the keep-alive fell due (server_subscription.ts
     * #_process_keepAlive). It goes first whatever its priority: a keep-alive is one small message
     * per maxKeepAliveCount cycles, while a missed one has the client give the subscription up
     * (FEAT-35: the CTT's Publish timed out on a disabled subscription beside a busy sibling).
     */
    static #owesKeepAlive(subscription) {
        return !_a.#isReady(subscription) && subscription.keepAliveCounterHasExpired;
    }
    #_pickMostDeservingSubscription(exhausted) {
        let best = null;
        let bestOwesKeepAlive = false;
        let bestLastServed = Number.POSITIVE_INFINITY;
        for (const subscription of this.subscriptions) {
            if (exhausted.has(subscription)) {
                continue;
            }
            const owesKeepAlive = _a.#owesKeepAlive(subscription);
            if (!owesKeepAlive && !_a.#isReady(subscription)) {
                continue;
            }
            const lastServed = this.#lastServedAt.get(subscription) ?? -1;
            const deservesMore = !best ||
                (owesKeepAlive && !bestOwesKeepAlive) ||
                (owesKeepAlive === bestOwesKeepAlive &&
                    (subscription.priority > best.priority ||
                        (subscription.priority === best.priority && lastServed < bestLastServed)));
            if (deservesMore) {
                best = subscription;
                bestOwesKeepAlive = owesKeepAlive;
                bestLastServed = lastServed;
            }
        }
        return best;
    }
    /**
     * Feed the queued PublishRequests to the most deserving subscriptions of this session -
     * overdue keep-alives first, then the ready ones by priority, then whoever has waited longest
     * since its last turn - instead of letting a subscription serve itself from
     * server_subscription.ts#_tick just because its own timer happened to fire first (FEAT-24).
     *
     * One pass serves at most the requests queued when it starts: a client that re-sends its next
     * Publish synchronously from the response callback must not keep this loop spinning. A
     * subscription that cannot use a request right now (still inside its first publishing cycle,
     * say) is set aside so the others still get their turn (FEAT-35).
     */
    feedReadySubscriptions() {
        let budget = this.pendingPublishRequestCount;
        const exhausted = new Set();
        while (budget > 0 && this.pendingPublishRequestCount > 0) {
            const subscription = this.#_pickMostDeservingSubscription(exhausted);
            if (!subscription) {
                break;
            }
            const responsesBefore = this.#responseCount;
            subscription.process_subscription();
            if (this.#responseCount === responsesBefore) {
                exhausted.add(subscription);
                continue;
            }
            budget -= 1;
            this.#lastServedAt.set(subscription, ++this.#serveSequence);
        }
    }
    #_find_starving_subscription() {
        const late_subscriptions = this.findLateSubscriptions();
        // ascending: the most deserving (highest priority, then closest to its keep-alive
        // deadline) sorts last. A comparator that never returns a negative number is not one:
        // beyond two elements the order it yields depends on the sort algorithm, not the data.
        function compare_subscriptions(s1, s2) {
            if (s1.priority === s2.priority) {
                return s2.timeToExpiration - s1.timeToExpiration;
            }
            return s1.priority - s2.priority;
        }
        function findLateSubscriptionSortedByPriority() {
            if (late_subscriptions.length === 0) {
                return null;
            }
            late_subscriptions.sort(compare_subscriptions);
            // c8 ignore next
            if (doDebug) {
                debugLog(late_subscriptions
                    .map((s) => "[ id = " +
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
                    " " +
                    s.messageSent +
                    "]")
                    .join(" \n"));
            }
            return late_subscriptions[late_subscriptions.length - 1];
        }
        if (this._closed_subscriptions) {
            /** */
        }
        const starving_subscription = /* this.findSubscriptionWaitingForFirstPublish() || */ findLateSubscriptionSortedByPriority();
        return starving_subscription;
    }
    #_feed_late_subscription() {
        setImmediate(() => {
            if (!this.pendingPublishRequestCount) {
                return;
            }
            const starving_subscription = this.#_find_starving_subscription();
            if (starving_subscription) {
                doDebug &&
                    debugLog(chalk.bgWhite.red("feeding most late subscription subscriptionId  = "), starving_subscription.id);
                starving_subscription.process_subscription();
            }
        });
    }
    #_feed_closed_subscription() {
        if (!this.pendingPublishRequestCount) {
            return false;
        }
        if (this._closed_subscriptions.length === 0) {
            // c8 ignore next
            doDebug && debugLog("ServerSidePublishEngine#_feed_closed_subscription  -> nothing to do");
            return false;
        }
        // process closed subscription
        const closed_subscription = this._closed_subscriptions[0];
        assert(closed_subscription.hasPendingNotifications);
        // c8 ignore next
        doDebug && debugLog("ServerSidePublishEngine#_feed_closed_subscription for closed_subscription ", closed_subscription.id);
        closed_subscription._publish_pending_notifications();
        if (!closed_subscription.hasPendingNotifications) {
            closed_subscription.dispose();
            this._closed_subscriptions.shift();
        }
        return true;
    }
    _send_error_for_request(publishData, statusCode) {
        _assertValidPublishData(publishData);
        const response = new ServiceFault({
            responseHeader: { serviceResult: statusCode }
        });
        this._send_response_for_request(publishData, response);
    }
    _cancelPendingPublishRequest(statusCode) {
        if (this._publish_request_queue) {
            // c8 ignore next
            doDebug &&
                debugLog(chalk.red("Cancelling pending PublishRequest with statusCode  "), statusCode.toString(), " length =", this._publish_request_queue.length);
        }
        else {
            // c8 ignore next
            doDebug && debugLog(chalk.red("No pending PublishRequest to cancel"));
        }
        for (const publishData of this._publish_request_queue) {
            this._send_error_for_request(publishData, statusCode);
        }
        this._publish_request_queue = [];
    }
    #_handle_too_many_requests() {
        if (this.pendingPublishRequestCount > this.maxPublishRequestInQueue) {
            traceLog("server has received too many PublishRequest", this.pendingPublishRequestCount, "/", this.maxPublishRequestInQueue);
            assert(this.pendingPublishRequestCount === this.maxPublishRequestInQueue + 1);
            // When a Server receives a new Publish request that exceeds its limit it shall de-queue the oldest Publish
            // request and return a response with the result set to Bad_TooManyPublishRequests.
            // dequeue oldest request
            const publishData = this._publish_request_queue.shift();
            if (!publishData) {
                return;
            }
            this._send_error_for_request(publishData, StatusCodes.BadTooManyPublishRequests);
        }
    }
    /**
     * call by a subscription when no notification message is available after the keep alive delay has
     * expired.
     *
     * @param subscriptionId
     * @param future_sequence_number
     * @return true if a publish response has been sent
     */
    send_keep_alive_response(subscriptionId, future_sequence_number) {
        //  this keep-alive Message informs the Client that the Subscription is still active.
        //  Each keep-alive Message is a response to a Publish request in which the  notification Message
        //  parameter does not contain any Notifications and that contains the sequence number of the next
        //  Notification Message that is to be sent.
        const subscription = this.getSubscriptionById(subscriptionId);
        /* c8 ignore next */
        if (!subscription) {
            traceLog("send_keep_alive_response  => invalid subscriptionId = ", subscriptionId);
            return false;
        }
        // let check if we have available PublishRequest to send the keep alive; a disabled
        // subscription holds its pending notifications back, so they never stand in the way of its keep-alive
        if (this.pendingPublishRequestCount === 0 || (subscription.publishingEnabled && subscription.hasPendingNotifications)) {
            // we cannot send the keep alive PublishResponse
            traceLog("send_keep_alive_response  => cannot send keep-alive  (no PublishRequest left) subscriptionId = ", subscriptionId);
            return false;
        }
        // c8 ignore next
        doDebug &&
            debugLog(`Sending keep alive response for subscription id ${subscription.id} ${subscription.publishingInterval} ${subscription.maxKeepAliveCount}`);
        this._send_response(subscription, new PublishResponse({
            availableSequenceNumbers: subscription.getAvailableSequenceNumbers(),
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: future_sequence_number
            },
            subscriptionId
        }));
        return true;
    }
    _send_response(_subscription, response) {
        assert(this.pendingPublishRequestCount > 0);
        assert(response.subscriptionId !== 0xffffff);
        const publishData = this._publish_request_queue.shift();
        if (!publishData) {
            return;
        }
        this._send_valid_response_for_request(publishData, response);
    }
    _on_tick() {
        this._cancelTimeoutRequests();
    }
    _cancelTimeoutRequests() {
        if (this._publish_request_queue.length === 0) {
            return;
        }
        // filter out timeout requests
        const parts = partition(this._publish_request_queue, timeout_filter);
        this._publish_request_queue = parts[1]; // still valid
        const invalid_published_request = parts[0];
        for (const publishData of invalid_published_request) {
            // c8 ignore next
            if (doDebug) {
                debugLog(chalk.cyan(" CANCELING TIMEOUT PUBLISH REQUEST "));
            }
            this._send_error_for_request(publishData, StatusCodes.BadTimeout);
        }
    }
    _send_response_for_request(publishData, response) {
        response.responseHeader.requestHandle = publishData.request.requestHeader.requestHandle;
        publishData.callback(publishData.request, response);
    }
    _send_valid_response_for_request(publishData, response) {
        // c8 ignore next
        if (doDebug) {
            debugLog("_send_response_for_request ", response.toString());
        }
        _assertValidPublishData(publishData);
        // xx assert(response.responseHeader.requestHandle !== 0,"expecting a valid requestHandle");
        response.results = publishData.results;
        this.#responseCount += 1;
        this._send_response_for_request(publishData, response);
    }
}
_a = ServerSidePublishEngine;
//# sourceMappingURL=server_publish_engine.js.map