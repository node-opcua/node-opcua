var subscription_service = require("../subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;

var s = require("../structures");
var StatusCodes = require("../opcua_status_code").StatusCodes;
var assert = require("better-assert");

var _ = require("underscore");

/**
 * The ClientSidePublishEngine encapsulates the mechanism to
 * deal with a OPCUA Server and constantly sending PublishRequest
 * The ClientSidePublishEngine also performs  notification acknowledgements.
 * Finally, ClientSidePublishEngine dispatch PublishResponse to the correct
 * Subscription id callback
 *
 * @param session
 * @constructor
 */
function ClientSidePublishEngine(session) {
    assert(session instanceof Object);
    this.session = session;
    this.keepalive_interval = 1000;
    this.subscriptionAcknowledgements = [];
    this.publish_timer_id = null;
    this.subscriptionIdFuncMap = {};
}

ClientSidePublishEngine.prototype.start = function () {
    var self = this;

    // send the initial publish
    setImmediate(function(){
        self._send_publish_request();
        assert(self.publish_timer_id === null); //
        self.publish_timer_id = setInterval(function () {
            self._send_publish_request()
        }, self.keepalive_interval);

    });
};

ClientSidePublishEngine.prototype.stop = function () {
    var self = this;
    if(_.isObject(self.publish_timer_id)) {
        clearInterval(self.publish_timer_id);
        self.publish_timer_id = "stopped";
    }
};


ClientSidePublishEngine.prototype.acknowledge_notification = function (subscriptionId, sequenceNumber) {
    this.subscriptionAcknowledgements.push({
        subscriptionId: subscriptionId,
        sequenceNumber: sequenceNumber
    });
};

ClientSidePublishEngine.prototype._send_publish_request = function () {

    var self = this;
    assert(self.publish_timer_id !== "stopped");
    var subscriptionAcknowledgements = self.subscriptionAcknowledgements;
    self.subscriptionAcknowledgements = [];

    var publish_request = new subscription_service.PublishRequest({
        subscriptionAcknowledgements: subscriptionAcknowledgements
    });
    self.session.publish(publish_request, function (err, response) {
        if (err) {

        } else {
            self._receive_publish_response(response);
        }
    });
};


ClientSidePublishEngine.prototype.registerSubscriptionCallback = function(subscriptionId,callback) {
    var self = this;
    assert(!self.subscriptionIdFuncMap.hasOwnProperty(subscriptionId)); // already registered ?
    self.subscriptionIdFuncMap[subscriptionId] = callback;
};

ClientSidePublishEngine.prototype._receive_publish_response= function(response){

    var self = this;

    // the id of the subscription sending the notification message
    var subscriptionId = response.subscriptionId;

    // the sequence numbers available in this subscription
    // for retransmission and not acknowledged by the client
    var available_seq = response.availableSequenceNumbers;

    // has the server more notification for us ?
    var moreNotifications = response.moreNotifications;

    var notificationMessage = response.notificationMessage;
    //  notificationMessage.sequenceNumber
    //  notificationMessage.publishTime
    //  notificationMessage.notificationData[]
    self.acknowledge_notification(subscriptionId, notificationMessage.sequenceNumber);
    console.log(" RECEIVING NOTIFICATION FROM SERVER");

    var callback_for_subscription =  self.subscriptionIdFuncMap[subscriptionId];
    if (callback_for_subscription) {
        callback_for_subscription(subscriptionId,notificationMessage);
    } else {
        console.log(" ignoring notificationMessage",notificationMessage," for subscription", subscriptionId);
    }
};
exports.ClientSidePublishEngine = ClientSidePublishEngine;