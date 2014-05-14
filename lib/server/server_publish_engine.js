
var Subscription = require("./subscription").Subscription;

var subscription_service = require("../services/subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var s = require("../datamodel/structures");
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;

var assert = require("better-assert");
var _ = require("underscore");


var EventEmitter = require("events").EventEmitter;
var util = require("util");

var debugLog = require("../utils").make_debugLog(__filename);


/***
 *
 * @param options
 * @constructor
 */
function ServerSidePublishEngine(options) {

    var self = this;

    options = options||{};

    // a queue of pending publish request send by the client
    // waiting to be used by the server to send notification
    self._publish_request_queue = [];

    self._subscriptions = {};

    self.maxPublishRequestInQueue = options.maxPublishRequestInQueue || 100;
}
util.inherits(ServerSidePublishEngine,EventEmitter);

ServerSidePublishEngine.prototype.process_subscriptionAcknowledgements = function (subscriptionAcknowledgements) {
    // process acknowledgements
    var self = this;

    var results = subscriptionAcknowledgements.map(function (subscriptionAcknowledgement) {

        var subscription = self.getSubscriptionById(subscriptionAcknowledgement.subscriptionId);
        assert(subscription); // expecting a existing subscription
        return subscription.acknowledgeNotification(subscriptionAcknowledgement.sequenceNumber);
    });

    return results;
};

ServerSidePublishEngine.prototype._on_PublishRequest = function (request) {

    var self = this;

    assert(request instanceof subscription_service.PublishRequest);
    var results = self.process_subscriptionAcknowledgements(request.subscriptionAcknowledgements);

    if (self.subscriptionCount === 0) {
        debugLog("server has received a PublishRequest but has no subscription opened");
        self.send_response_for_request(request,new subscription_service.PublishResponse({
            responseHeader: { serviceResult: StatusCodes.Bad_NoSubscription },
            results: results
        }));
    } else if (self.pendingPublishRequestCount >= self.maxPublishRequestInQueue ) {
        debugLog("server has received too many PublishRequest" ,self.pendingPublishRequestCount ,"/" , self.maxPublishRequestInQueue);
        self.send_response_for_request(request,new subscription_service.PublishResponse({
            responseHeader: { serviceResult: StatusCodes.Bad_TooManyPublishRequests },
            results: results
        }));
    } else {
        // add the publish request to the queue for later processing
        assert(request); // should have a valid request
        self._publish_request_queue.push({ request: request , results: results});
    }

};


/**
 * call by a subscription when a notification message is ready
 *
 */
ServerSidePublishEngine.prototype.send_notification_message = function (sequenceId,notificationMessage,availableSequenceNumbers) {
    assert(notificationMessage instanceof NotificationMessage);
    var self = this;
    self._send_publish_response(sequenceId,notificationMessage.sequenceNumber,notificationMessage.notificationData,availableSequenceNumbers);
};


/**
 * call by a subscription when no notification message is available after the keep alive delay has
 * expired.
 *
 */
ServerSidePublishEngine.prototype.send_keep_alive_response = function (subscriptionId,future_sequence_number) {

    //  this keep-alive Message informs the Client that the Subscription is still active.
    //  Each keep-alive Message is a response to a Publish request in which the  notification Message
    //  parameter does not contain any Notifications and that contains the sequence number of the next
    //  Notification Message that is to be sent.
    var self = this;
    if (self.pendingPublishRequestCount ===0) {
        return;
    }
    var sequenceNubmer = future_sequence_number;
    var notificationData = [];
    var subscription = self.getSubscriptionById(subscriptionId);
    assert(subscription);
    var availableSequenceNumbers = subscription.getAvailableSequenceNumbers();

    self._send_publish_response(subscriptionId,sequenceNubmer,notificationData,availableSequenceNumbers);

};

ServerSidePublishEngine.prototype._send_publish_response = function(subscriptionId,sequenceNumber,notificationData,availableSequenceNumbers){

    var self = this;

    assert(self.pendingPublishRequestCount>0);
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

    self.send_response_for_request(p.request,response);
};




ServerSidePublishEngine.prototype.send_response_for_request = function(request,response){
   var self =this;
   self.emit("publishResponse",request,response);
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

        // the subscription has ended because life counter has expired


    }).on("notification",function(){
        if (self.pendingPublishRequestCount>0) {
            var subscriptionId = subscription.id;
            var availableSequenceNumbers = subscription.getAvailableSequenceNumbers();
            var notificationMessage= subscription.popNotificationToSend().notification;
            self.send_notification_message(subscriptionId,notificationMessage,availableSequenceNumbers);
            //xx var dump = require("../utils").dump;
            //xx dump(notificationMessage);
        }
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
