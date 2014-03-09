
var Subscription = require("./subscription").Subscription;

var subscription_service = require("../subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var s = require("../structures");
var StatusCodes = require("../opcua_status_code").StatusCodes;

var assert = require("better-assert");
var _ = require("underscore");


var EventEmitter = require("events").EventEmitter;
var util = require("util");


function ServerSidePublishEngine() {
    var self = this;

    self._publish_request_queue = [];


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
    var p = self._publish_request_queue.shift();
    //xx ({ request: request });

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

};
ServerSidePublishEngine.prototype.add_subscription = function(subscription) {

    var self = this;
    self.subscriptions.push(subscription);
    assert(subscription.id);
    var publish_engine = this;
    subscription.on("keepalive",function(sequenceNumber){

        publish_engine.send_keep_alive_response(subscription.id,sequenceNumber);

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