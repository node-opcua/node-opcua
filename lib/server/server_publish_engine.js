
var Subscription = require("./subscription").Subscription;

var subscription_service = require("../subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var s = require("../structures");
var StatusCodes = require("../opcua_status_code").StatusCodes;

var assert = require("better-assert");
var _ = require("underscore");


var EventEmitter = require("events").EventEmitter;
var util = require("util");


/***
 *
 * @param options
 * @constructor
 */
function ServerSidePublishEngine(options) {

    options = options||{};
    var self = this;

    self._publish_request_queue = [];

    self.availableSequenceNumbers = [];

    self._subscriptions = {};

    self.maxPublishRequestInQueue = options.maxPublishRequestInQueue || 100;
}
util.inherits(ServerSidePublishEngine,EventEmitter);

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

    assert(request instanceof subscription_service.PublishRequest);
    var self = this;
    self.process_subscriptionAcknowledgements(request.subscriptionAcknowledgements);

    if (self.subscriptionCount === 0) {
        self.send_response_for_request(request,new s.ServiceFault({
            responseHeader: { serviceResult: StatusCodes.Bad_NoSubscription }
        }));
    } else if (self.pendingPublishRequestCount >= self.maxPublishRequestInQueue ) {
        self.send_response_for_request(request,new s.ServiceFault({
            responseHeader: { serviceResult: StatusCodes.Bad_TooManyPublishRequests }
        }));
    } else {
        // add the publish request to the queue for later processing
        assert(request); // should have a valid request
        self._publish_request_queue.push({ request: request });
    }
};


/**
 * call by a subscription when a notification message is ready
 *
 */
ServerSidePublishEngine.prototype.send_notification_message = function (subscriptionId, notificationMessage) {
    assert(notificationMessage instanceof NotificationMessage);
    var self = this;

};
/**
 * call by a subscription when no notification message is available after the keep alive delay has
 * expired.
 *
 */
ServerSidePublishEngine.prototype.send_keep_alive_response = function (subscriptionId,future_sequence_number) {

    var self = this;
    if (self._publish_request_queue.length===0) {
        return;
    }
    assert(self._publish_request_queue.length>0);
    var p = self._publish_request_queue.shift();

    //  this keep-alive Message informs the Client that the Subscription is still active.
    //  Each keep-alive Message is a response to a Publish request in which the  notification Message
    //  parameter does not contain any Notifications and that contains the sequence number of the next
    //  Notification Message that is to be sent.

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
    this.emit("publishResponse",request,response);
};

ServerSidePublishEngine.prototype.add_subscription = function(subscription) {

    assert(subscription instanceof Subscription);
    assert(_.isFinite(subscription.id));
    var self = this;
    self._subscriptions[subscription.id] = subscription;
    var publish_engine = this;
    subscription.on("keepalive",function(sequenceNumber){

        publish_engine.send_keep_alive_response(subscription.id,sequenceNumber);

    }).on("terminate",function(){

    }).on("notification",function(){
        console.log("Subscription ready to send some notification")
    });
};

ServerSidePublishEngine.prototype.remove_subscription = function(subscription) {
    assert(subscription instanceof Subscription);
    assert(_.isFinite(subscription.id));
    assert(this._subscriptions.hasOwnProperty(subscription.id));
    subscription.terminate();
    delete this._subscriptions[subscription.id];

};

ServerSidePublishEngine.prototype.shutdown = function(){

    var self = this;
    var arr = _.values(self._subscriptions);
    arr.forEach(function(subscription){
        self.remove_subscription(subscription);
    });
    assert(self.subscriptionCount === 0);

    // purge _publish_request_queue
    self._publish_request_queue = [];
};

ServerSidePublishEngine.prototype.__defineGetter__("pendingPublishRequestCount",function(){
    return this._publish_request_queue.length;
});

ServerSidePublishEngine.prototype.__defineGetter__("subscriptionCount",function(){
    return Object.keys(this._subscriptions).length;
});

ServerSidePublishEngine.prototype.getSubscriptionById = function(subscriptionId) {
   return this._subscriptions[subscriptionId];
};

exports.ServerSidePublishEngine = ServerSidePublishEngine;
