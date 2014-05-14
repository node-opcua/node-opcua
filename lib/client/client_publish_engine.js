var subscription_service = require("../services/subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;

var s = require("../datamodel/structures");
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var assert = require("better-assert");

var _ = require("underscore");

var debugLog  = require("../misc/utils").make_debugLog(__filename);

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
function ClientSidePublishEngine(session,options) {
    assert(session instanceof Object);

    options = options || {};
    options.keepalive_interval = options.keepalive_interval || 1000;

    this.session = session;
    this.keepalive_interval = options.keepalive_interval;

    this.subscriptionAcknowledgements = [];
    this.subscriptionIdFuncMap = {};
}


ClientSidePublishEngine.prototype.acknowledge_notification = function (subscriptionId, sequenceNumber) {
    this.subscriptionAcknowledgements.push({
        subscriptionId: subscriptionId,
        sequenceNumber: sequenceNumber
    });
};


ClientSidePublishEngine.prototype.send_publish_request = function () {
    var self = this;
    setImmediate(function(){
        self._send_publish_request();
    });
};

ClientSidePublishEngine.prototype._send_publish_request = function () {

    debugLog("sending publish request");
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


ClientSidePublishEngine.prototype.registerSubscriptionCallback = function(subscriptionId,callback) {
    var self = this;
    assert(!self.subscriptionIdFuncMap.hasOwnProperty(subscriptionId)); // already registered ?
    self.subscriptionIdFuncMap[subscriptionId] = callback;
    self.send_publish_request();
};

ClientSidePublishEngine.prototype.unregisterSubscriptionCallback = function(subscriptionId) {
    var self = this;
    assert(self.subscriptionIdFuncMap.hasOwnProperty(subscriptionId));
    delete self.subscriptionIdFuncMap[subscriptionId];
};

ClientSidePublishEngine.prototype._receive_publish_response= function(response){

    debugLog("receive publish response");
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
    if (notificationMessage.notificationData.length === 0) {
        // this is a keep-alive notification
        // in this case , we shall not acknowledge notificationMessage.sequenceNumber
        // which is only an information of what will be the future sequenceNumber.
    } else {
        self.acknowledge_notification(subscriptionId, notificationMessage.sequenceNumber);
    }

    var callback_for_subscription =  self.subscriptionIdFuncMap[subscriptionId];
    if (callback_for_subscription) {
        // feed the server with a new publish Request to the server
        self.send_publish_request();

        // delegate notificationData to the subscription callback
        callback_for_subscription(notificationMessage.notificationData,notificationMessage.publishTime);
    } else {
       console.log(" ignoring notificationMessage",notificationMessage," for subscription", subscriptionId);
    }
};
exports.ClientSidePublishEngine = ClientSidePublishEngine;