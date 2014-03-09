/**
 *
 * @param opcua_client
 * @constructor
 */
var subscription_service = require("../subscription_service");
var s = require("../structures");
var StatusCodes = require("../opcua_status_code").StatusCodes;

var assert = require("better-assert");
var should = require("should");
var _ = require("underscore");
var NotificationMessage = subscription_service.NotificationMessage;


var EventEmitter = require("events").EventEmitter;
var util = require("util");
function Subscription(options) {

    options = options || {};

    EventEmitter.apply(this, arguments);
    var self = this;

    self.id = options.id || "<invalid_id>";
    self.publishingInterval = options.publishingInterval || 1000;

    // the live time count defines how many times the publish interval expires without
    // having a connection to the client to deliver data.
    self.liveTimeCount = options.liveTimeCount || 10;
    self.live_without_client = 0;

    // the keep alive count defines how many times the publish interval need to
    // expires without having notifications available before the server send an
    // empty message.
    self.maxKeepAliveCount = options.maxKeepAliveCount || 10;
    self.curKeepAliveCount = 0;

    self.timerId = setInterval(function () {
        self._tick();
    }, self.publishingInterval);

}
util.inherits(Subscription, EventEmitter);

Subscription.prototype.__defineGetter__("has_pending_notification", function () {
    var self = this;
    return self.notification;
});
Subscription.prototype.set_notification = function (notification) {
    var self = this;
    self.notification = notification;
};

/**
 *
 * @private
 */
Subscription.prototype._tick = function () {
    var self = this;

    // request a notification update
    self.emit("perform_update");

    self.live_without_client += 1;
    if (self.live_without_client >= self.liveTimeCount) {
        self.emit("expired");
        // kill timer
        self.terminate();
    } else if (self.has_pending_notification) {
        self.emit("notification", self.notification);
        self.curKeepAliveCount = 0;
        self.notification = null;
    } else {
        self.curKeepAliveCount += 1;
        if (self.curKeepAliveCount >= self.maxKeepAliveCount) {
            self.emit("keepalive");
            self.curKeepAliveCount = 0;
        }
    }
};

/**
 *
 *  the server invokes the ping_from_client method of the subscription
 *  when the client has send a Publish Request, so that the subscription
 *  can reset its live_without_client counter.
 *
 */
Subscription.prototype.ping_from_client = function () {
    var self = this;
    self.live_without_client = 0;
};

Subscription.prototype.terminate = function () {
    var self = this;
    clearTimeout(self.timerId);
    self.timerId = 0;
};

function ServerSidePublishEngine() {
    var self = this;

    self.__next_sequence_number = 0;

    self._publish_request_queue = [];

    self._sent_notifications = {};
    self._pending_notifications = {};

    self.availableSequenceNumbers = [];

    self.subscriptions = [];

}

function make_subscription_sequenceNumber_key(subscriptionId, sequenceNumber) {
    return subscriptionId.toString() + "#" + sequenceNumber.toString();
}

function make_subscriptionAcknowledgement_key(subscriptionAcknowledgement) {
    return make_subscription_sequenceNumber_key(
        subscriptionAcknowledgement.subscriptionId,
        subscriptionAcknowledgement.sequenceNumber);
}

ServerSidePublishEngine.prototype.process_subscriptionAcknowledgements = function (subscriptionAcknowledgements) {
    // process acknowledgements
    subscriptionAcknowledgements.forEach(function (subscriptionAcknowledgement) {
        var key = make_subscriptionAcknowledgement_key(subscriptionAcknowledgement);
        delete self._sent_nofitifications[key];
    });
};

ServerSidePublishEngine.prototype._on_PublishRequest = function (request) {

    var self = this;
    self.process_subscriptionAcknowledgements(request.subscriptionAcknowledgements);

    if (self.subscriptions.length === 0) {
        self.send_response_for_request(request,new s.ServiceFault({
            responseHeader: { serviceResult: StatusCodes.Bad_NoSubscription }
        }));
    } else {
        // add the publish request to the queue for later processing
        self._publish_request_queue.push({ request: request });
    }
};

// counter
ServerSidePublishEngine.prototype._get_next_sequence_number = function () {
    this.__next_sequence_number += 1;
    return this.__next_sequence_number;
};
// counter
ServerSidePublishEngine.prototype._get_future_sequence_number = function () {
    return this.__next_sequence_number+1;
};
/**
 * call by a subscription when a notification message is ready
 *
 */
ServerSidePublishEngine.prototype.send_notification_message = function (subscriptionId, notificationMessage) {
    assert(notificationMessage instanceof NotificationMessage);
    var self = this;
    var sequence_number = self._get_next_sequence_number();

};
/**
 * call by a subscription when no notification message is available after the keep alive delay has
 * expired.
 *
 */
ServerSidePublishEngine.prototype.send_keep_alive_response = function (subscriptionId) {

    var self = this;
    var p = self._publish_request_queue.shift();
    //xx ({ request: request });

    //  this keep-alive Message informs the Client that the Subscription is still active.
    //  Each keep-alive Message is a response to a Publish request in which the  notification Message
    //  parameter does not contain any Notifications and that contains the sequence number of the next
    //  Notification Message that is to be sent.

    var future_sequence_number = self._get_future_sequence_number();

    var response = new subscription_service.PublishResponse({
        subscriptionId: subscriptionId,
        availableSequenceNumbers: self.availableSequenceNumbers,
        moreNotifications: false,
        notificationMessage: {
            sequenceNumber: future_sequence_number,
            publishTime: new Date(),
            notificationData: [ /* empty */]
        }
    });

    self.send_response_for_request(p.request,response);

};
ServerSidePublishEngine.prototype.send_response_for_request = function(request,response){

};
ServerSidePublishEngine.prototype.add_subscription = function(subscription) {

    var self = this;
    self.subscriptions.push(subscription);
    assert(subscription.id);
    var publish_engine = this;
    subscription.on("keepalive",function(){

        publish_engine.send_keep_alive_response(subscription.id);

    }).on("terminate",function(){

    }).on("notification",function(){

    });
};
ServerSidePublishEngine.prototype.remove_subscription = function(subscription) {
    subscription.terminate();
};
ServerSidePublishEngine.prototype.shutdown = function(){

    var self = this;
    self.subscriptions.forEach(function(subscription){
        subscription.terminate();
    });
    self.subscriptions =[];
};


ServerSidePublishEngine.prototype.__defineGetter__("pendingPublishRequestCount",function(){
    return this._publish_request_queue.length;
});


exports.ServerSidePublishEngine = ServerSidePublishEngine;
exports.Subscription = Subscription;