"use strict";
require("requirish")._(module);
var _ = require("underscore");
var subscription_service = require("lib/services/subscription_service");
var assert = require("better-assert");

var utils = require("lib/misc/utils");
var debugLog = utils.make_debugLog(__filename);
var doDebug = utils.checkDebugFlag(__filename);

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

//xx var debugLog = console.log;

/**
 * A client side implementation to deal with publish service.
 *
 * @class ClientSidePublishEngine
 *
 * @param session {ClientSession} - the client session
 * @constructor
 *
 * The ClientSidePublishEngine encapsulates the mechanism to
 * deal with a OPCUA Server and constantly sending PublishRequest
 * The ClientSidePublishEngine also performs  notification acknowledgements.
 * Finally, ClientSidePublishEngine dispatch PublishResponse to the correct
 * Subscription id callback
 */
function ClientSidePublishEngine(session) {
    assert(session instanceof Object);

    this.session = session;

    this.subscriptionAcknowledgements = [];
    this.subscriptionMap = {};

    this.timeoutHint = 10000; // 10 s by default

    this.activeSubscriptionCount = 0;

    // number of pending Publish request sent to the server and awaited for being processed by the server
    this.nbPendingPublishRequests = 0;

    // the maximum number of publish requests we think that the server can queue.
    // we will adjust this value .
    this.nbMaxPublishRequestsAcceptedByServer = 1000;
}


/**
 * @method acknowledge_notification
 * @param subscriptionId {Number} the subscription id
 * @param sequenceNumber {Number} the sequence number
 */
ClientSidePublishEngine.prototype.acknowledge_notification = function (subscriptionId, sequenceNumber) {
    this.subscriptionAcknowledgements.push({
        subscriptionId: subscriptionId,
        sequenceNumber: sequenceNumber
    });
};

ClientSidePublishEngine.prototype.cleanup_acknowledgment_for_subscription = function (subscriptionId) {

    this.subscriptionAcknowledgements = this.subscriptionAcknowledgements.filter(function (a) {
        return a.subscriptionId !== subscriptionId;
    });
};

/**
 * @method send_publish_request
 */
ClientSidePublishEngine.prototype.send_publish_request = function () {
    var self = this;

    if (self.nbPendingPublishRequests >= self.nbMaxPublishRequestsAcceptedByServer) {
        return;
    }
    assert(self.subscriptionCount >0);

    setImmediate(function () {
        if (!self.session) {
            // session has been terminated
            return;
        }
        self._send_publish_request();
    });
};


ClientSidePublishEngine.prototype._send_publish_request = function () {

    var self = this;
    assert(self.session, "ClientSidePublishEngine terminated ?");

    self.nbPendingPublishRequests +=1;

    debugLog("sending publish request".yellow,self.nbPendingPublishRequests);

    var subscriptionAcknowledgements = self.subscriptionAcknowledgements;
    self.subscriptionAcknowledgements = [];

    // as started in the spec (Spec 1.02 part 4 page 81 5.13.2.2 Function DequeuePublishReq())
    // the server will dequeue the PublishRequest  in first-in first-out order
    // and will validate if the publish request is still valid by checking the timeoutHint in the RequestHeader.
    // If the request timed out, the server will send a Bad_Timeout service result for the request and de-queue
    // another publish request.
    //
    // in Part 4. page 144 Request Header the timeoutHint is described this way.
    // timeoutHint UInt32 This timeout in milliseconds is used in the Client side Communication Stack to
    //                    set the timeout on a per-call base.
    //                    For a Server this timeout is only a hint and can be used to cancel long running
    //                    operations to free resources. If the Server detects a timeout, he can cancel the
    //                    operation by sending the Service result Bad_Timeout. The Server should wait
    //                    at minimum the timeout after he received the request before cancelling the operation.
    //                    The value of 0 indicates no timeout.
    // In issue#40 (MonitoredItem on changed not fired), we have found that some server might wrongly interpret
    // the timeoutHint of the request header ( and will bang a Bad_Timeout regardless if client send timeoutHint=0)
    // as a work around here , we force the timeoutHint to be set to a suitable value.
    //
    // see https://github.com/node-opcua/node-opcua/issues/141
    // This suitable value shall be at least the time between two keep alive signal that the server will send.
    // (i.e revisedLifetimeCount * revisedPublishingInterval)

    // also ( part 3 - Release 1.03 page 140)
    // The Server shall check the timeoutHint parameter of a PublishRequest before processing a PublishResponse.
    // If the request timed out, a Bad_Timeout Service result is sent and another PublishRequest is used.
    // The value of 0 indicates no timeout

    // in our case:

    assert( self.nbPendingPublishRequests >0);
    var calculatedTimeout = self.nbPendingPublishRequests * self.timeoutHint;

    var publish_request = new subscription_service.PublishRequest({
        requestHeader: {timeoutHint: calculatedTimeout}, // see note
        subscriptionAcknowledgements: subscriptionAcknowledgements
    });

    var active = true;

    self.session.publish(publish_request, function (err, response) {

        self.nbPendingPublishRequests -= 1;
        if (err) {
            debugLog("ClientSidePublishEngine.prototype._send_publish_request callback ".cyan, err.message.yellow);

            // istanbul ignore next
            if (err.message.match(/BadNoSubscription/) && self.activeSubscriptionCount >=1) {
                // there is something wrong happening here.
                // the server tells us that there is no subscription for this session
                // but the client have some active subscription left.
                // This could happen if the client has missed or not received the StatusChange Notification
                debugLog(" WARNING :   SERVER TELLS THAT IT HAS NO SUBSCRIPTION , BUT CLIENT DISAGREE".bgWhite.red);
                debugLog("self.activeSubscriptionCount =",self.activeSubscriptionCount);
                active = false;
            }

            if (err.message.match(/BadSessionClosed|BadSessionIdInvalid/)) {
                //
                // server has closed the session ....
                // may be the session timeout is shorted than the subscription life time
                // and the client does not send intermediate keepAlive request to keep the connection working.
                //
                debugLog(" WARNING : SERVER TELLS THAT THE SESSION HAS CLOSED ...".bgWhite.red);
                debugLog("   the ClientSidePublishEngine shall now be disabled, as server will reject any further request");
                // close all active subscription....
                active = false;
            }
            if (err.message.match(/BadTooManyPublishRequests/)) {

                // preventing queue overflow
                // -------------------------
                //   if the client send too many publish requests that the server can queue, the server returns
                //   a Service result of BadTooManyPublishRequests.
                //
                //   let adjust the nbMaxPublishRequestsAcceptedByServer value so we never overflow the server
                //   with extraneous publish requests in the future.
                //
                self.nbMaxPublishRequestsAcceptedByServer = Math.min(self.nbPendingPublishRequests,self.nbMaxPublishRequestsAcceptedByServer);
                active = false;

                debugLog(" WARNING : SERVER TELLS THAT TOO MANY PUBLISH REQUEST HAS BEEN SEND ...".bgWhite.red);
                debugLog(" On our side nbPendingPublishRequests = ",self.nbPendingPublishRequests);
                debugLog(" => nbMaxPublishRequestsAcceptedByServer =",self.nbMaxPublishRequestsAcceptedByServer);
            }
        } else {
            if (doDebug) {
                debugLog("ClientSidePublishEngine.prototype._send_publish_request callback ".cyan);
            }
            self._receive_publish_response(response);
        }

        // feed the server with a new publish Request to the server
        if (active  && self.activeSubscriptionCount>0 ) {
            self.send_publish_request();
        }
    });
};

ClientSidePublishEngine.prototype.terminate = function () {
    this.session = null;
};


/**
 * the number of active subscriptions managed by this publish engine.
 * @property subscriptionCount
 * @type {Number}
 */
ClientSidePublishEngine.prototype.__defineGetter__("subscriptionCount", function () {
    var self = this;
    return Object.keys(self.subscriptionMap).length;
});

ClientSidePublishEngine.publishRequestCountInPipeline = 5;

/**
 * @method registerSubscription
 *
 * @param subscription.subscriptionId
 * @param subscription.timeoutHint
 * @param subscription.onNotificationMessage {Function} callback
 */
ClientSidePublishEngine.prototype.registerSubscription = function (subscription) {

    debugLog("ClientSidePublishEngine#registerSubscription ",subscription.subscriptionId);

    assert(arguments.length === 1);
    var self = this;
    assert(_.isFinite(subscription.subscriptionId));
    assert(!self.subscriptionMap.hasOwnProperty(subscription.subscriptionId)); // already registered ?
    assert(_.isFunction(subscription.onNotificationMessage));
    assert(_.isFinite(subscription.timeoutHint));

    self.activeSubscriptionCount += 1;
    self.subscriptionMap[subscription.subscriptionId] = subscription;

    self.timeoutHint = Math.max(self.timeoutHint,subscription.timeoutHint);
    debugLog("                       setting timeoutHit = ",self.timeoutHint,subscription.timeoutHint);

    // Spec 1.03 part 4 5.13.5 Publish
    // [..] in high latency networks, the Client may wish to pipeline Publish requests
    // to ensure cyclic reporting from the Server. Pipelining involves sending more than one Publish
    // request for each Subscription before receiving a response. For example, if the network introduces a
    // delay between the Client and the Server of 5 seconds and the publishing interval for a Subscription
    // is one second, then the Client will have to issue Publish requests every second instead of waiting for
    // a response to be received before sending the next request.
    self.send_publish_request();

    // send more than one publish request to server to cope with latency
    for (var i = 0; i < ClientSidePublishEngine.publishRequestCountInPipeline - 1; i++) {
        self.send_publish_request();
    }
};
/**
 * @method unregisterSubscription
 *
 * @param subscriptionId
 */
ClientSidePublishEngine.prototype.unregisterSubscription = function (subscriptionId) {

    debugLog("ClientSidePublishEngine#unregisterSubscription ",subscriptionId);

    assert(_.isFinite(subscriptionId) && subscriptionId >0);
    var self = this;
    self.activeSubscriptionCount -= 1;
    assert(self.subscriptionMap.hasOwnProperty(subscriptionId));
    delete self.subscriptionMap[subscriptionId];
};

/***
 * get the client subscription from Id
 * @method getSubscription
 * @param subscriptionId {Number} the subscription Id
 * @return {Subscription|null}
 */
ClientSidePublishEngine.prototype.getSubscription = function (subscriptionId) {
    var self = this;
    assert(_.isFinite(subscriptionId) && subscriptionId >0);
    assert(self.subscriptionMap.hasOwnProperty(subscriptionId));
    return self.subscriptionMap[subscriptionId];
};

ClientSidePublishEngine.prototype._receive_publish_response = function (response) {

    debugLog("receive publish response".yellow.bold);
    var self = this;

    // the id of the subscription sending the notification message
    var subscriptionId = response.subscriptionId;

    // the sequence numbers available in this subscription
    // for retransmission and not acknowledged by the client
    // -- var available_seq = response.availableSequenceNumbers;

    // has the server more notification for us ?
    // -- var moreNotifications = response.moreNotifications;

    var notificationMessage = response.notificationMessage;
    //  notificationMessage.sequenceNumber
    //  notificationMessage.publishTime
    //  notificationMessage.notificationData[]

    notificationMessage.notificationData = notificationMessage.notificationData || [];

    if (notificationMessage.notificationData.length !== 0) {
        self.acknowledge_notification(subscriptionId, notificationMessage.sequenceNumber);
    }
    //else {
    // this is a keep-alive notification
    // in this case , we shall not acknowledge notificationMessage.sequenceNumber
    // which is only an information of what will be the future sequenceNumber.
    //}

    var subscription = self.subscriptionMap[subscriptionId];

    if (subscription && self.session !== null) {

        // delegate notificationData to the subscription callback
        subscription.onNotificationMessage(notificationMessage);

    } else {
        debugLog(" ignoring notificationMessage", notificationMessage, " for subscription", subscriptionId);
        debugLog(" because there is no subscription.");
        debugLog(" or because there is no session for the subscription (session terminated ?).");
    }
};

var async = require("async");

ClientSidePublishEngine.prototype.republish = function(callback) {

    var self = this;

    // After re-establishing the connection the Client shall call Republish in a loop, starting with the next expected
    // sequence number and incrementing the sequence number until the Server returns the status Bad_MessageNotAvailable.
    // After receiving this status, the Client shall start sending Publish requests with the normal Publish handling.
    // This sequence ensures that the lost NotificationMessages queued in the Server are not overwritten by new
    // Publish responses
    function _republish(subscription,subscriptionId,_i_callback) {

        assert(subscription.subscriptionId === +subscriptionId);

        var done = false;

        function _send_republish(_b_callback) {
            var request = new subscription_service.RepublishRequest({
                subscriptionId: subscription.subscriptionId,
                retransmitSequenceNumber: subscription.lastSequenceNumber+1
            });

            debugLog(" republish Request for subscription",request.subscriptionId," retransmitSequenceNumber=",request.retransmitSequenceNumber);

            self.session.republish(request,function(err,response){
                if (!err &&  response.responseHeader.serviceResult === StatusCodes.Good) {
                    subscription.onNotificationMessage(response.notificationMessage);
                } else {


                    if (!err) {
                        err = response.responseHeader.serviceResult.toString();
                    }
                    debugLog(" _send_republish ends with ",err.message);
                    done = true;
                }
                _b_callback(err);
            });
        }

        setImmediate(function() {

            assert(_.isFunction(_i_callback));
            async.whilst(function (){ return !done},_send_republish,function(err) {

                debugLog("nbPendingPublishRequest = ",self.nbPendingPublishRequests);
                debugLog(" _republish ends with ",err ? err.message : "null");
                _i_callback(err);
            });
        });
    }

    function repairSubscription(subscription,subscriptionId,_the_callback) {

        _republish(subscription,subscriptionId,function (err) {


            if (err && err.message.match(/SubscriptionIdInvalid/)) {

                // _republish failed because subscriptionId is not valid anymore on server side.
                //
                // This could happen when the subscription has timed out and has been deleted by server
                // Subscription may time out if the duration of the connection break exceed the max life time
                // of the subscription.
                //
                // In this case, Client must recreate a subscription and recreate monitored item without altering
                // the event handlers
                //
                return subscription.recreateSubscriptionAndMonitoredItem(_the_callback);

            }
            _the_callback();

        });

    }

    async.forEachOf(self.subscriptionMap,repairSubscription,callback);
};

exports.ClientSidePublishEngine = ClientSidePublishEngine;
