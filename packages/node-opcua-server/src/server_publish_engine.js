"use strict";
/**
 * @module opcua.server
 */

const Subscription = require("./server_subscription").Subscription;
const SubscriptionState = require("./server_subscription").SubscriptionState;

const subscription_service = require("node-opcua-service-subscription");
const NotificationMessage = subscription_service.NotificationMessage;
const StatusCodes = require("node-opcua-status-code").StatusCodes;

const assert = require("node-opcua-assert").assert;
const _ = require("underscore");


const EventEmitter = require("events").EventEmitter;
const util = require("util");

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

const colors = require("colors");

function traceLog() {
    if (!doDebug) {
        return;
    }
    const a = _.map(arguments);
    // console.log(a);
    a.unshift(" TRACE ".yellow);
    console.log.apply(this, a);
}

/***
 * @class ServerSidePublishEngine
 *  a Publish Engine for a given session
 * @param options {Object}
 * @param [options.maxPublishRequestInQueue= 100] {Integer}
 * @constructor
 */
function ServerSidePublishEngine(options) {

    options = options || {};

    const self = this;

    ServerSidePublishEngine.registry.register(self);

    // a queue of pending publish request send by the client
    // waiting to be used by the server to send notification
    self._publish_request_queue = []; // { request :/*PublishRequest*/{}, results: [/*subscriptionAcknowledgements*/] , callback}
    self._publish_response_queue = [];// /* PublishResponse */

    self._subscriptions = {};

    // _closed_subscriptions contains a collection of Subscription that
    // have  expired but that still need to send some pending notification
    // to the client.
    // Once publish requests will be received from the  client
    // the notifications of those subscriptions will be processed so that
    // they can be properly disposed.
    self._closed_subscriptions = [];

    self.maxPublishRequestInQueue = options.maxPublishRequestInQueue || 100;

    self.isSessionClosed = false;

}

util.inherits(ServerSidePublishEngine, EventEmitter);
const ObjectRegistry = require("node-opcua-object-registry").ObjectRegistry;
ServerSidePublishEngine.registry = new ObjectRegistry();


ServerSidePublishEngine.prototype.dispose = function () {

    debugLog("ServerSidePublishEngine#dispose");
    const self = this;

    // force deletion of publish response not sent
    self._publish_response_queue = [];

    assert(self._publish_response_queue.length === 0, "self._publish_response_queue !=0");
    self._publish_response_queue = null;

    assert(Object.keys(self._subscriptions).length === 0, "self._subscriptions count!=0");
    self._subscriptions = {};

    assert(self._closed_subscriptions.length === 0, "self._closed_subscriptions count!=0");
    self._closed_subscriptions = null;

    ServerSidePublishEngine.registry.unregister(self);

};


ServerSidePublishEngine.prototype.process_subscriptionAcknowledgements = function (subscriptionAcknowledgements) {
    // process acknowledgements
    const self = this;
    subscriptionAcknowledgements = subscriptionAcknowledgements || [];

    const results = subscriptionAcknowledgements.map(function (subscriptionAcknowledgement) {

        const subscription = self.getSubscriptionById(subscriptionAcknowledgement.subscriptionId);
        if (!subscription) {
            return StatusCodes.BadSubscriptionIdInvalid;
        }
        return subscription.acknowledgeNotification(subscriptionAcknowledgement.sequenceNumber);
    });

    return results;
};

/**
 * get a array of subscription handled by the publish engine.
 * @property subscription {Subscription[]}
 */
ServerSidePublishEngine.prototype.__defineGetter__("subscriptions", function () {
    return _.map(this._subscriptions);
});

ServerSidePublishEngine.prototype._feed_late_subscription = function () {

    const self = this;
    if (!self.pendingPublishRequestCount) {
        return;
    }
    const starving_subscription = self.findSubscriptionWaitingForFirstPublish() || self.findLateSubscriptionSortedByPriority();

    if (starving_subscription) {
        debugLog("feeding most late subscription subscriptionId  = ".bgWhite.red, starving_subscription.id);
        starving_subscription.process_subscription();
    }
};

ServerSidePublishEngine.prototype._feed_closed_subscription = function () {

    const self = this;
    if (!self.pendingPublishRequestCount) {
        return false;
    }

    debugLog("ServerSidePublishEngine#_feed_closed_subscription");
    const closed_subscription = self._closed_subscriptions.shift();
    if (closed_subscription) {

        traceLog("_feed_closed_subscription for closed_subscription ", closed_subscription.id);

        if (closed_subscription.hasPendingNotifications) {
            closed_subscription._publish_pending_notifications();

            // now closed_subscription can be disposed
            closed_subscription.dispose();

            return true;
        }
    }
    return false
};

function _assertValidPublishData(publishData) {
    assert(publishData.request instanceof subscription_service.PublishRequest);
    assert(_.isArray(publishData.results));
    assert(_.isFunction(publishData.callback));
}

ServerSidePublishEngine.prototype.send_error_for_request = function (publishData, statusCode) {
    const self = this;
    _assertValidPublishData(publishData);
    self.send_response_for_request(publishData, new subscription_service.PublishResponse({
        responseHeader: {serviceResult: statusCode}
    }));
};

ServerSidePublishEngine.prototype._cancelPendingPublishRequest = function (statusCode) {

    const self = this;
    debugLog("Cancelling pending PublishRequest with statusCode  ".red, statusCode.toString(), " length =", self._publish_request_queue.length);

    self._publish_request_queue.forEach(function (publishData) {
        self.send_error_for_request(publishData, statusCode);
    });
    self._publish_request_queue = [];

};

ServerSidePublishEngine.prototype.cancelPendingPublishRequestBeforeChannelChange = function () {
    this._cancelPendingPublishRequest(StatusCodes.BadSecureChannelClosed);
};

ServerSidePublishEngine.prototype.cancelPendingPublishRequest = function () {
    const self = this;
    assert(self.subscriptionCount === 0);
    this._cancelPendingPublishRequest(StatusCodes.BadNoSubscription);
};

ServerSidePublishEngine.prototype.onSessionClose = function () {

    const self = this;
    self.isSessionClosed = true;
    self._cancelPendingPublishRequest(StatusCodes.BadSessionClosed);

};

function dummy_function() {
}

function prepare_timeout_info(request) {
    // record received time
    request.received_time = Date.now();
    assert(request.requestHeader.timeoutHint >= 0);
    request.timeout_time = (request.requestHeader.timeoutHint > 0) ? request.received_time + request.requestHeader.timeoutHint : 0;
}


ServerSidePublishEngine.prototype._handle_too_many_requests = function () {

    const self = this;

    if (self.pendingPublishRequestCount > self.maxPublishRequestInQueue) {

        traceLog("server has received too many PublishRequest", self.pendingPublishRequestCount, "/", self.maxPublishRequestInQueue);
        assert(self.pendingPublishRequestCount === (self.maxPublishRequestInQueue + 1));
        // When a Server receives a new Publish request that exceeds its limit it shall de-queue the oldest Publish
        // request and return a response with the result set to Bad_TooManyPublishRequests.

        // dequeue oldest request
        const publishData = self._publish_request_queue.shift();
        self.send_error_for_request(publishData, StatusCodes.BadTooManyPublishRequests);
    }

};


ServerSidePublishEngine.prototype._on_PublishRequest = function (request, callback) {

    const self = this;
    //xx console.log("#_on_PublishRequest self._publish_request_queue.length before ",self._publish_request_queue.length);

    callback = callback || dummy_function;
    assert(request instanceof subscription_service.PublishRequest);

    assert(_.isFunction(callback));

    const subscriptionAckResults = self.process_subscriptionAcknowledgements(request.subscriptionAcknowledgements);
    const publishData = {request: request, results: subscriptionAckResults, callback: callback};

    if (self._process_pending_publish_response(publishData)) {
        console.log(" PENDING RESPONSE HAS BEEN PROCESSED !");
        return;
    }

    if (self.isSessionClosed) {

        traceLog("server has received a PublishRequest but session is Closed");
        self.send_error_for_request(publishData, StatusCodes.BadSessionClosed);

    } else if (self.subscriptionCount === 0) {

        if (self._closed_subscriptions.length > 0 && self._closed_subscriptions[0].hasPendingNotifications) {

            const verif = self._publish_request_queue.length;
            // add the publish request to the queue for later processing
            self._publish_request_queue.push(publishData);

            const processed = self._feed_closed_subscription();
            assert(verif === self._publish_request_queue.length);
            assert(processed);
            return;
        }
//Xx        assert(self._publish_request_queue.length===0);
        traceLog("server has received a PublishRequest but has no subscription opened");
        self.send_error_for_request(publishData, StatusCodes.BadNoSubscription);

    } else {

        prepare_timeout_info(request);

        // add the publish request to the queue for later processing
        self._publish_request_queue.push(publishData);

        debugLog("Adding a PublishRequest to the queue ".bgWhite.red, self._publish_request_queue.length);

        self._feed_late_subscription();

        self._feed_closed_subscription();

        self._handle_too_many_requests();

    }
};

/**
 * call by a subscription when no notification message is available after the keep alive delay has
 * expired.
 *
 * @method send_keep_alive_response
 * @param subscriptionId
 * @param future_sequence_number
 * @return {Boolean} true if a publish response has been sent
 */
ServerSidePublishEngine.prototype.send_keep_alive_response = function (subscriptionId, future_sequence_number) {

    //  this keep-alive Message informs the Client that the Subscription is still active.
    //  Each keep-alive Message is a response to a Publish request in which the  notification Message
    //  parameter does not contain any Notifications and that contains the sequence number of the next
    //  Notification Message that is to be sent.
    const self = this;

    const subscription = self.getSubscriptionById(subscriptionId);
    /* istanbul ignore next */
    if (!subscription) {
        traceLog("send_keep_alive_response  => invalid subscriptionId = ", subscriptionId);
        return false;
    }

    if (self.pendingPublishRequestCount === 0) {
        return false;
    }

    const sequenceNumber = future_sequence_number;
    self.send_notification_message({
        subscriptionId: subscriptionId,
        sequenceNumber: sequenceNumber,
        notificationData: [],
        moreNotifications: false
    }, false);

    return true;
};

ServerSidePublishEngine.prototype._on_tick = function () {

    this._cancelTimeoutRequests();
};

ServerSidePublishEngine.prototype._cancelTimeoutRequests = function () {

    const self = this;

    if (self._publish_request_queue.length === 0) {
        return;
    }

    const current_time = (new Date()).getTime(); // ms

    function timeout_filter(data) {
        const request = data.request;
        const results = data.results;
        if (!request.timeout_time) {
            // no limits
            return false;
        }
        return request.timeout_time ? request.timeout_time < current_time : false;
    }

    // filter out timeout requests
    const partition = _.partition(self._publish_request_queue, timeout_filter);

    self._publish_request_queue = partition[1]; // still valid

    const invalid_published_request = partition[0];
    invalid_published_request.forEach(function (publishData) {
        console.log(" CANCELING TIMEOUT PUBLISH REQUEST ".cyan);
        const response = new subscription_service.PublishResponse({
            responseHeader: {serviceResult: StatusCodes.BadTimeout}
        });
        self.send_response_for_request(publishData, response);
    });
};


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
ServerSidePublishEngine.prototype.send_notification_message = function (param, force) {

    const self = this;
    assert(self.pendingPublishRequestCount > 0 || force);

    assert(!param.hasOwnProperty("availableSequenceNumbers"));
    assert(param.hasOwnProperty("subscriptionId"));
    assert(param.hasOwnProperty("sequenceNumber"));
    assert(param.hasOwnProperty("notificationData"));
    assert(param.hasOwnProperty("moreNotifications"));

    const subscription = self.getSubscriptionById(param.subscriptionId);


    const subscriptionId = param.subscriptionId;
    const sequenceNumber = param.sequenceNumber;
    const notificationData = param.notificationData;
    const moreNotifications = param.moreNotifications;

    const availableSequenceNumbers = subscription ? subscription.getAvailableSequenceNumbers() : [];

    const response = new subscription_service.PublishResponse({
        subscriptionId: subscriptionId,
        availableSequenceNumbers: availableSequenceNumbers,
        moreNotifications: moreNotifications,
        notificationMessage: {
            sequenceNumber: sequenceNumber,
            publishTime: new Date(),
            notificationData: notificationData
        }
    });

    if (self.pendingPublishRequestCount === 0) {
        console.log(" ---------------------------------------------------- PUSHING PUBLISH RESPONSE FOR LATE ANWSER !".bgRed.white.bold);
        self._publish_response_queue.push(response);
    } else {
        const publishData = self._publish_request_queue.shift();
        self.send_response_for_request(publishData, response);
    }

};

ServerSidePublishEngine.prototype._process_pending_publish_response = function (publishData) {

    _assertValidPublishData(publishData);
    const self = this;
    if (self._publish_response_queue.length === 0) {
        // no pending response to send
        return false;
    }
    assert(self._publish_request_queue.length === 0);
    const response = self._publish_response_queue.shift();

    self.send_response_for_request(publishData, response);
    return true;
};

ServerSidePublishEngine.prototype.send_response_for_request = function (publishData, response) {
    _assertValidPublishData(publishData);
    assert(response.responseHeader.requestHandle !== 0);
    response.results = publishData.results;
    response.responseHeader.requestHandle = publishData.request.requestHeader.requestHandle;
    publishData.callback(publishData.request, response);
};

/**
 * @method add_subscription
 * @param subscription  {Subscription}
 */
ServerSidePublishEngine.prototype.add_subscription = function (subscription) {

    const self = this;

    assert(subscription instanceof Subscription);
    assert(_.isFinite(subscription.id));
    subscription.publishEngine = subscription.publishEngine || self;
    assert(subscription.publishEngine === self);
    assert(!self._subscriptions[subscription.id]);

    debugLog("ServerSidePublishEngine#add_subscription -  adding subscription with Id:", subscription.id);
    self._subscriptions[subscription.id] = subscription;

    return subscription;
};

ServerSidePublishEngine.prototype.detach_subscription = function (subscription) {
    const self = this;
    assert(subscription instanceof Subscription);
    assert(_.isFinite(subscription.id));
    assert(subscription.publishEngine === self);
    assert(self._subscriptions[subscription.id] === subscription);

    delete self._subscriptions[subscription.id];
    subscription.publishEngine = null;

    debugLog("ServerSidePublishEngine#detach_subscription detaching subscription with Id:", subscription.id);
    return subscription;
};


/**
 * @method shutdown
 */
ServerSidePublishEngine.prototype.shutdown = function () {


    const self = this;
    assert(self.subscriptionCount === 0, "subscription shall be removed first before you can shutdown a publish engine");

    debugLog("ServerSidePublishEngine#shutdown");

    // purge _publish_request_queue
    self._publish_request_queue = [];

    // purge _publish_response_queue
    self._publish_response_queue = [];

    // purge self._closed_subscriptions
    self._closed_subscriptions.map(function(subscription){ subscription.dispose();});
    self._closed_subscriptions = [];

};

/**
 * number of pending PublishRequest available in queue
 * @property pendingPublishRequestCount
 * @type {Integer}
 */
ServerSidePublishEngine.prototype.__defineGetter__("pendingPublishRequestCount", function () {
    return this._publish_request_queue.length;
});

/**
 * number of subscriptions
 * @property subscriptionCount
 * @type {Integer}
 */
ServerSidePublishEngine.prototype.__defineGetter__("subscriptionCount", function () {
    return Object.keys(this._subscriptions).length;
});

ServerSidePublishEngine.prototype.__defineGetter__("pendingClosedSubscriptionCount", function () {
    return this._closed_subscriptions.length;
});

ServerSidePublishEngine.prototype.__defineGetter__("currentMonitoredItemCount", function () {

    const result = _.reduce(this._subscriptions, function (cumul, subscription) {
        return cumul + subscription.monitoredItemCount;
    }, 0);
    assert(_.isFinite(result));
    return result;
});

ServerSidePublishEngine.prototype.on_close_subscription = function (subscription) {
    const self = this;
    debugLog("ServerSidePublishEngine#on_close_subscription", subscription.id);
    assert(self._subscriptions.hasOwnProperty(subscription.id));
    assert(subscription.publishEngine === self,"subscription must belong to this ServerSidePublishEngine");

    if (subscription.hasPendingNotifications) {

        debugLog("ServerSidePublishEngine#on_close_subscription storing subscription", subscription.id," to _closed_subscriptions because it has pending notification");
        self._closed_subscriptions.push(subscription);
    } else {
        debugLog("ServerSidePublishEngine#on_close_subscription disposing subscription", subscription.id);

        //subscription is no longer needed
        subscription.dispose();
    }

    delete self._subscriptions[subscription.id];

    if (self.subscriptionCount === 0) {
        while (self._feed_closed_subscription()) {
            /* keep looping */
        }
        self.cancelPendingPublishRequest();
    }
};

/**
 * retrieve a subscription by id.
 * @method getSubscriptionById
 * @param subscriptionId {Integer}
 * @return {Subscription}
 */
ServerSidePublishEngine.prototype.getSubscriptionById = function (subscriptionId) {
    return this._subscriptions[subscriptionId];
};

ServerSidePublishEngine.prototype.findSubscriptionWaitingForFirstPublish = function () {
    // find all subscriptions that are late and sort them by urgency
    let subscriptions_waiting_for_first_reply = _.filter(this._subscriptions, function (subscription) {
        return !subscription.messageSent && subscription.state === SubscriptionState.LATE;
    });

    if (subscriptions_waiting_for_first_reply.length) {
        subscriptions_waiting_for_first_reply = _(subscriptions_waiting_for_first_reply).sortBy("timeToExpiration");
        debugLog("Some subscriptions with messageSent === false ");
        return subscriptions_waiting_for_first_reply[0];
    }
    return null;
};

function compare_subscriptions(s1, s2) {

    if (s1.priority === s2.priority) {

        return s1.timeToExpiration < s2.timeToExpiration;
    }
    return s1.priority > s2.priority;
}

ServerSidePublishEngine.prototype.findLateSubscriptions = function () {
    return _.filter(this._subscriptions, function (subscription) {
        return subscription.state === SubscriptionState.LATE && subscription.publishingEnabled;//&& subscription.hasMonitoredItemNotifications;
    });
};

ServerSidePublishEngine.prototype.__defineGetter__("hasLateSubscriptions", function () {
    return this.findLateSubscriptions().length > 0;
});

ServerSidePublishEngine.prototype.findLateSubscriptionSortedByPriority = function () {

    const late_subscriptions = this.findLateSubscriptions();
    if (late_subscriptions.length === 0) {
        return null;
    }
    late_subscriptions.sort(compare_subscriptions);

    // istanbul ignore next
    if (doDebug) {
        debugLog(late_subscriptions.map(function (s) {
            return "[ id = " + s.id +
                " prio=" + s.priority +
                " t=" + s.timeToExpiration +
                " ka=" + s.timeToKeepAlive +
                " m?=" + s.hasMonitoredItemNotifications + "]";
        }).join(" \n"));
    }
    return late_subscriptions[late_subscriptions.length - 1];
};

ServerSidePublishEngine.prototype.findLateSubscriptionsSortedByAge = function () {

    let late_subscriptions = this.findLateSubscriptions();
    late_subscriptions = _(late_subscriptions).sortBy("timeToExpiration");

    return late_subscriptions;
};

/**
 * @method transferSubscription
 *
 * @param subscription
 * @param destPublishEngine
 * @param sendInitialValues {boolean} true if initial values should be sent
 * @return {void}
 * @private
 */
ServerSidePublishEngine.transferSubscription= function (subscription, destPublishEngine, sendInitialValues) {

    const srcPublishEngine = subscription.publishEngine;

    assert(!destPublishEngine.getSubscriptionById(subscription.id));
    assert(srcPublishEngine.getSubscriptionById(subscription.id));


    debugLog("ServerSidePublishEngine.transferSubscription live subscriptionId =".cyan, subscription.subscriptionId);

    subscription.notifyTransfer();
    destPublishEngine.add_subscription(srcPublishEngine.detach_subscription(subscription));
    subscription.resetLifeTimeCounter();
    if (sendInitialValues) {
        subscription.resendInitialValues();
    }

    assert(destPublishEngine.getSubscriptionById(subscription.id));
    assert(!srcPublishEngine.getSubscriptionById(subscription   .id));


};

/**
 * @method transferSubscriptionsToOrphan
 * @param srcPublishEngine {ServerSidePublishEngine}
 * @param destPublishEngine {ServerSidePublishEngine}
 * @return void
 * @private
 * @static
 */
ServerSidePublishEngine.transferSubscriptionsToOrphan = function (srcPublishEngine, destPublishEngine) {

    debugLog("ServerSidePublishEngine#transferSubscriptionsToOrphan! start transferring long live subscriptions to orphan".yellow);
    const tmp = srcPublishEngine._subscriptions;
    _.forEach(tmp, function (subscription) {
        assert(subscription.publishEngine === srcPublishEngine);

        if (subscription.$session) {
            subscription.$session._unexposeSubscriptionDiagnostics(subscription);
        } else {
            console.warn("Warning:  subscription",subscription.id," has no session attached!!!");
        }

        ServerSidePublishEngine.transferSubscription(subscription, destPublishEngine, false);
    });
    assert(srcPublishEngine.subscriptionCount === 0);
    debugLog("ServerSidePublishEngine#transferSubscriptionsToOrphan! end transferring long lived subscriptions to orphan".yellow);
};

exports.ServerSidePublishEngine = ServerSidePublishEngine;

