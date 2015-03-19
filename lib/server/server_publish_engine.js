"use strict";
/**
 * @module opcua.server
 */
require("requirish")._(module);
var Subscription = require("lib/server/subscription").Subscription;
var SubscriptionState = require("lib/server/subscription").SubscriptionState;

var subscription_service = require("lib/services/subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var assert = require("better-assert");
var _ = require("underscore");


var EventEmitter = require("events").EventEmitter;
var util = require("util");

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
// debugLog = console.log;

/***
 * @class ServerSidePublishEngine
 * @param options
 * @constructor
 */
function ServerSidePublishEngine(options) {

    var self = this;

    options = options || {};

    // a queue of pending publish request send by the client
    // waiting to be used by the server to send notification
    self._publish_request_queue = [];

    self._subscriptions = {};

    self.maxPublishRequestInQueue = options.maxPublishRequestInQueue || 100;
}
util.inherits(ServerSidePublishEngine, EventEmitter);

ServerSidePublishEngine.prototype.process_subscriptionAcknowledgements = function (subscriptionAcknowledgements) {
    // process acknowledgements
    var self = this;

    var results = subscriptionAcknowledgements.map(function (subscriptionAcknowledgement) {

        var subscription = self.getSubscriptionById(subscriptionAcknowledgement.subscriptionId);
        if (!subscription) {
            return StatusCodes.BadSubscriptionIdInvalid;
        }
        return subscription.acknowledgeNotification(subscriptionAcknowledgement.sequenceNumber);
    });

    return results;
};

ServerSidePublishEngine.prototype._feed_late_subscription = function() {

    var self = this;
    if (!self.pendingPublishRequestCount) { return;}

    var starving_subscriptions = self.findLateSubscriptionsSortedByAge();

    if (starving_subscriptions.length>0) {
        starving_subscriptions[0]._attempt_to_publish_notification();
    }
};

ServerSidePublishEngine.prototype._feed_closed_subscription = function() {
    var self = this;
    if (!self.pendingPublishRequestCount) { return;}
    var closed_subscription = self.findFirstClosedSubscription();
    if (closed_subscription) {

        debugLog("_feed_closed_subscription for closed_subscription ",closed_subscription.id);
        assert(closed_subscription.hasPendingNotification);

        closed_subscription._attempt_to_publish_notification();

        self.remove_subscription(closed_subscription);
    }
};


ServerSidePublishEngine.prototype.cancelPendingPublishRequest = function() {

    var self = this;
    assert(self.subscriptionCount === 0);

    debugLog("Cancelling pending PublishRequest as there is no subscription left in session: ".red, self._publish_request_queue.length);

    self._publish_request_queue.forEach(function(data){
        var request = data.request;
        var results = data.results;

        self.send_response_for_request(request, new subscription_service.PublishResponse({
            responseHeader: { serviceResult: StatusCodes.BadNoSubscription },
            results: results
        }));
    });
    self._publish_request_queue = [];

};


function dummy_function(){}

ServerSidePublishEngine.prototype._on_PublishRequest = function (request,callback) {

    var self = this;

    callback = callback || dummy_function;
    assert(_.isFunction(callback));

    request.callback = callback;

    assert(request instanceof subscription_service.PublishRequest);
    var results = self.process_subscriptionAcknowledgements(request.subscriptionAcknowledgements);

    if (self.subscriptionCount === 0) {
        debugLog("server has received a PublishRequest but has no subscription opened");
        self.send_response_for_request(request, new subscription_service.PublishResponse({
            responseHeader: { serviceResult: StatusCodes.BadNoSubscription },
            results: results
        }));
    } else if (self.pendingPublishRequestCount >= self.maxPublishRequestInQueue) {
        debugLog("server has received too many PublishRequest", self.pendingPublishRequestCount, "/", self.maxPublishRequestInQueue);
        self.send_response_for_request(request, new subscription_service.PublishResponse({
            responseHeader: { serviceResult: StatusCodes.BadTooManyPublishRequests },
            results: results
        }));
    } else {
        // add the publish request to the queue for later processing
        self._publish_request_queue.push({ request: request, results: results});

        //// find
        //var subscriptionIds = _.uniq(_.map(request.subscriptionAcknowledgements,function( subscriptionAcknowledgement){
        //    return  subscriptionAcknowledgement.subscriptionId;
        //}));
        //// should the the following subscriptions need to be stimulated to avoid timeout ???
        //// console.log(" pinging subscription",subscriptionIds);

        self._feed_late_subscription();

        self._feed_closed_subscription();
    }

};

/**
 * call by a subscription when a notification message is ready
 * @method send_notification_message
 *
 *
 * @param sequenceId
 * @param notificationMessage
 * @param availableSequenceNumbers
 */
ServerSidePublishEngine.prototype.send_notification_message = function (sequenceId, notificationMessage, availableSequenceNumbers) {
    assert(notificationMessage instanceof NotificationMessage);
    var self = this;
    self._send_publish_response(sequenceId, notificationMessage.sequenceNumber, notificationMessage.notificationData, availableSequenceNumbers);
};


/**
 * call by a subscription when no notification message is available after the keep alive delay has
 * expired.
 * @method send_keep_alive_response
 * @param subscriptionId
 * @param future_sequence_number
 */
ServerSidePublishEngine.prototype.send_keep_alive_response = function (subscriptionId, future_sequence_number) {

    //  this keep-alive Message informs the Client that the Subscription is still active.
    //  Each keep-alive Message is a response to a Publish request in which the  notification Message
    //  parameter does not contain any Notifications and that contains the sequence number of the next
    //  Notification Message that is to be sent.
    var self = this;
    if (self.pendingPublishRequestCount === 0) {
        return false;
    }
    var sequenceNumber = future_sequence_number;
    var notificationData = [];
    var subscription = self.getSubscriptionById(subscriptionId);
    if (!subscription) {
        return false;
    }
    var availableSequenceNumbers = subscription.getAvailableSequenceNumbers();
    self._send_publish_response(subscriptionId, sequenceNumber, notificationData, availableSequenceNumbers);
    return true;
};


ServerSidePublishEngine.prototype._send_publish_response = function (subscriptionId, sequenceNumber, notificationData, availableSequenceNumbers) {

    var self = this;

    assert(self.pendingPublishRequestCount > 0);
    var p = self._publish_request_queue.shift();

    var subscription = self.getSubscriptionById(subscriptionId);
    assert(subscription);

    var response = new subscription_service.PublishResponse({
        subscriptionId: subscriptionId,
        availableSequenceNumbers: availableSequenceNumbers,
        moreNotifications: false,
        notificationMessage: {
            sequenceNumber: sequenceNumber,
            publishTime: new Date(),
            notificationData: notificationData
        },
        results: p.results
    });

    self.send_response_for_request(p.request, response);
};


ServerSidePublishEngine.prototype.send_response_for_request = function (request, response) {
    var callback = request.callback;
    assert(_.isFunction(callback));
    callback(request,response);
};

/**
 * @method add_subscription
 * @param subscription  {Subscription}
 */
ServerSidePublishEngine.prototype.add_subscription = function (subscription) {

    assert(subscription instanceof Subscription);
    assert(_.isFinite(subscription.id));
    var self = this;
    assert(! self._subscriptions[subscription.id]);

    debugLog(" adding subscription with Id:",subscription.id);
    self._subscriptions[subscription.id] = subscription;
};

/**
 * @method remove_subscription
 * @param subscription {Subscription}
 */
ServerSidePublishEngine.prototype.remove_subscription = function (subscription) {

    assert(subscription instanceof Subscription);
    assert(_.isFinite(subscription.id));
    assert(this._subscriptions.hasOwnProperty(subscription.id));

    debugLog(" removing subscription with Id:",subscription.id, " state  = ",subscription.state.toString());

    //xx assert(subscription.state === SubscriptionState.CLOSED);
    //xx subscription.terminate();

    delete this._subscriptions[subscription.id];

};

/**
 * @method shutdown
 */
ServerSidePublishEngine.prototype.shutdown = function () {

    var self = this;
    var arr = _.values(self._subscriptions);
    arr.forEach(function (subscription) {
        self.remove_subscription(subscription);
    });
    assert(self.subscriptionCount === 0);

    // purge _publish_request_queue
    self._publish_request_queue = [];
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

/**
 * retrieve a subscription by id.
 * @method getSubscriptionById
 * @param subscriptionId {Integer}
 * @return {Subscription}
 */
ServerSidePublishEngine.prototype.getSubscriptionById = function (subscriptionId) {
    return this._subscriptions[subscriptionId];
};

ServerSidePublishEngine.prototype.findFirstClosedSubscription = function() {

    return _.find(this._subscriptions,function(subscription){
        return subscription.state === SubscriptionState.CLOSED;
    });
};

ServerSidePublishEngine.prototype.findLateSubscriptionsSortedByAge = function() {
    // find all subscriptions that are late and sort them by urgency

    var late_subscriptions = _.filter(this._subscriptions,function(subscription){
        return subscription.state === SubscriptionState.LATE;
    });

    late_subscriptions = _(late_subscriptions).sortBy("timeToExpiration");

    return late_subscriptions;
};


exports.ServerSidePublishEngine = ServerSidePublishEngine;
