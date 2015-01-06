/**
 * @module opcua.server
 */
require("requirish")._(module);
var NodeId = require("lib/datamodel/nodeid").NodeId;
var NodeIdType = require("lib/datamodel/nodeid").NodeIdType;
var ServerSidePublishEngine = require("lib/server/server_publish_engine").ServerSidePublishEngine;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var crypto = require("crypto");
var assert = require("better-assert");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var _ = require("underscore");

/**
 * @class ServerSession
 * @param sessionId {Number}
 * @private
 * @constructor
 */
function ServerSession(sessionId) {

    assert(_.isFinite(sessionId));
    assert(sessionId !== 0, " sessionId is null/empty. this is not allowed");

    EventEmitter.apply(this, arguments);

    this.authenticationToken = new NodeId(NodeIdType.BYTESTRING, crypto.randomBytes(16));
    this.nodeId = new NodeId(NodeIdType.NUMERIC, sessionId, 0);
    assert(this.authenticationToken instanceof NodeId);
    assert(this.nodeId instanceof NodeId);

    this._subscription_counter = 0;
    this._subscriptions = {};

    this.publishEngine = new ServerSidePublishEngine();

    this.publishEngine.setMaxListeners(100);

}
util.inherits(ServerSession, EventEmitter);

var Subscription = require("lib/server/subscription").Subscription;

/**
 * create a new subscription
 * @method createSubscription
 * @param request
 * @param request.requestedPublishingInterval {Duration}
 * @param request.requestedLifetimeCount {Counter}
 * @param request.requestedMaxKeepAliveCount {Counter}
 * @param request.maxNotificationsPerPublish {Counter}
 * @param request.publishingEnabled {Boolean}
 * @param request.priority {Byte}
 * @return {Subscription}
 */
ServerSession.prototype.createSubscription = function (request) {

    assert(request.hasOwnProperty("requestedPublishingInterval")); // Duration
    assert(request.hasOwnProperty("requestedLifetimeCount"));      // Counter
    assert(request.hasOwnProperty("requestedMaxKeepAliveCount"));  // Counter
    assert(request.hasOwnProperty("maxNotificationsPerPublish"));  // Counter
    assert(request.hasOwnProperty("publishingEnabled"));           // Boolean
    assert(request.hasOwnProperty("priority"));                    // Byte

    var self = this;

    var subscription = new Subscription({
        publishingInterval: request.requestedPublishingInterval,
        maxLifeTimeCount: request.requestedLifetimeCount,
        maxKeepAliveCount: request.requestedMaxKeepAliveCount,
        maxNotificationsPerPublish: request.maxNotificationsPerPublish,
        publishingEnabled: request.publishingEnabled,
        priority: request.priority
    });

    self._subscription_counter += 1;
    var id = self._subscription_counter;

    subscription.id = id;

    assert(!this._subscriptions[id]);
    this._subscriptions[id] = subscription;

    this.publishEngine.add_subscription(subscription);

    // Notify the owner that a new susbscription has been created
    // @event new_subscription
    // @parm {Subscription} subscription
    this.emit("new_subscription", subscription);

    return subscription;
};


/**
 * number of active subscriptions
 * @property currentSubscriptionCount
 * @type {Number}
 */
ServerSession.prototype.__defineGetter__("currentSubscriptionCount", function () {
    return Object.keys(this._subscriptions).length;
});
/**
 * number of subscriptions ever created since this object is live
 * @property cumulatedSubscriptionCount
 * @type {Number}
 */
ServerSession.prototype.__defineGetter__("cumulatedSubscriptionCount", function () {
    return this._subscription_counter;
});

/**
 * retrieve an existing subscription by subscriptionId
 * @method getSubscription
 * @param subscriptionId {Integer}
 * @return {Subscription}
 */
ServerSession.prototype.getSubscription = function (subscriptionId) {
    return this._subscriptions[subscriptionId];
};

/**
 * @method deleteSubscription
 * @param subscriptionId {Integer}
 * @return {StatusCode}
 */
ServerSession.prototype.deleteSubscription = function (subscriptionId) {

    var subscription = this.getSubscription(subscriptionId);
    if (!subscription) {
        return StatusCodes.BadSubscriptionIdInvalid;
    }
    this._subscriptions[subscriptionId] = null;
    delete this._subscriptions[subscriptionId];

    subscription.terminate();
    assert(subscription.monitoredItemCount === 0);

    if (this._subscriptions.length === 0) {
        console.log(" should cancel publish request here !");
    }
    return StatusCodes.Good;
};

/**
 * close a ServerSession, this will also delete the subscriptions if the flag is set.
 * @method close
 * @param {Boolean} deleteSubscriptions : should we delete subscription ?
 */
ServerSession.prototype.close = function (deleteSubscriptions) {

    var self = this;

    // ---------------  delete associated subscriptions ---------------------

    var subscriptions_ids = Object.keys(this._subscriptions);

    if (!deleteSubscriptions) {
        // I don't know what to do yet if deleteSubscriptions is false
        console.log("TO DO : Closing session without deleteing subscription not yet implemented");
    } else {
        subscriptions_ids.forEach(function (subscription_id) {
            var statusCode = self.deleteSubscription(subscription_id);
            assert(statusCode === StatusCodes.Good);
        });
        assert(self.currentSubscriptionCount === 0);
    }


    // ---------------- shut down publish engine
    self.publishEngine.shutdown();
    delete self.publishEngine;
    self.publishEngine = null;

    // Post-Conditions
    assert(self.currentSubscriptionCount === 0);

};

/**
 * getMonitoredItems is used to get information about monitored items of a subscription.Its intended
 * use is defined in Part 4.
 * @method getMonitoredItems
 * @param subscriptionId {Integer32} Identifier of the subscription.
 * @param  result.serverHandles {Int32[]} Array of serverHandles for all MonitoredItems of the subscription identified by subscriptionId.
 *         result.clientHandles {Int32[]} Array of clientHandles for all MonitoredItems of the subscription identified by subscriptionId.
 *         result.statusCode    {StatusCode}
 */
ServerSession.prototype.getMonitoredItems = function(subscriptionId,/*out*/ result) {

    var self = this;
    var subscription = self.getSubscription(subscriptionId);
    if (!subscription) {
         result.statusCode = StatusCodes.Bad_SubscriptionIdInvalid;
        return;
    }
    return subscription.getMonitoredItems(/*out*/ result);
};

exports.ServerSession = ServerSession;