
var subscription_service = require("../subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;

var s = require("../structures");
var StatusCodes = require("../opcua_status_code").StatusCodes;
var assert = require("better-assert");

var _ = require("underscore");


function ClientSidePublishEngine(session) {

    assert(session instanceof Object);
    this.session = session;
    this.keepalive_interval = 1000;
    this.subscriptionAcknowledgements = [];
}
ClientSidePublishEngine.prototype.start = function () {
    var self = this;
    self.publish_timer_id = setInterval(function () {
        self._send_publish_request()
    }, self.keepalive_interval);
};

ClientSidePublishEngine.prototype.stop = function () {
    var self = this;
    clearInterval(self.publish_timer_id);
};


ClientSidePublishEngine.prototype.acknowledge_notification = function (subscriptionId, sequenceNumber) {
    this.subscriptionAcknowledgements.push({
        subscriptionId: subscriptionId,
        sequenceNumber: sequenceNumber
    });
};

ClientSidePublishEngine.prototype._send_publish_request = function () {

    var self = this;
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

ClientSidePublishEngine.prototype._receive_publish_response= function(response){

    var self = this;

    // the id of the subscription sending the notification message
    var subscriptionId = response.subscriptionId;

    // the sequence numbers available in this subscription
    // for retransmission and not acknowledged by the client
    var available_seq = response.availableSequenceNumbers;

    var moreNotifications = response.moreNotifications;

    var notificationMessage = response.notificationMessage;
    //  notificationMessage.sequenceNumber
    //  notificationMessage.publishTime
    //  notificationMessage.notificationData[]
    self.acknowledge_notification(subscriptionId, notificationMessage.sequenceNumber);

};
exports.ClientSidePublishEngine = ClientSidePublishEngine;