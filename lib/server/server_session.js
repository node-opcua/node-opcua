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

var WatchDog = require("lib/misc/watchdog").WatchDog;

var theWatchDog = new WatchDog();

/**
 * @class ServerSession
 *
 * OPCUA Spec 1.02
 * ---------------
 * Sessions are created to be independent of the underlying communications connection. Therefore, if a communication
 * connection fails, the Session is not immediately affected. The exact mechanism to recover from an underlying
 * communication connection error depends on the SecureChannel mapping as described in Part 6.
 *
 * Sessions are terminated by the Server automatically if the Client fails to issue a Service request on the Session
 * within the timeout period negotiated by the Server in the CreateSession Service response. This protects the Server
 * against Client failures and against situations where a failed underlying connection cannot be re-established.
 * Clients shall be prepared to submit requests in a timely manner to prevent the Session from closing automatically.
 * Clients may explicitly terminate Sessions using the CloseSession Service.
 *
 * When a Session is terminated, all outstanding requests on the Session are aborted and Bad_SessionClosed StatusCodes
 * are returned to the Client. In addition, the Server deletes the entry for the Client from its
 * SessionDiagnosticsArray Variable and notifies any other Clients who were subscribed to this entry.
 *
 * @param sessionId {Number}
 * @param sessionTimeout {Number}
 * @private
 * @constructor
 */
function ServerSession(parent,sessionId,sessionTimeout) {

    this.parent = parent; // SessionEngine

    EventEmitter.apply(this, arguments);

    assert(_.isFinite(sessionId));
    assert(sessionId !== 0, " sessionId is null/empty. this is not allowed");

    assert(_.isFinite(sessionTimeout));
    assert(sessionTimeout >= 0, " sessionTimeout");
    this.sessionTimeout = sessionTimeout;

    this.authenticationToken = new NodeId(NodeIdType.BYTESTRING, crypto.randomBytes(16));

    this.nodeId = new NodeId(NodeIdType.NUMERIC, sessionId, 0);
    assert(this.authenticationToken instanceof NodeId);
    assert(this.nodeId instanceof NodeId);

    this._subscription_counter = 0;
    this._subscriptions = {};

    this.publishEngine = new ServerSidePublishEngine();

    this.publishEngine.setMaxListeners(100);

    theWatchDog.addSubscriber(this,this.sessionTimeout);

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
        priority: request.priority,

        // ------------------- back pointer to parent
        parent: self

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
 *
 * Spec extract:
 *
 * If a Client invokes the CloseSession Service then all Subscriptions associated with the Session are also deleted
 * if the deleteSubscriptions flag is set to TRUE. If a Server terminates a Session for any other reason,
 * Subscriptions associated with the Session, are not deleted. Each Subscription has its own lifetime to protect
 * against data loss in the case of a Session termination. In these cases, the Subscription can be reassigned to
 * another Client before its lifetime expires.
 *
 * @method close
 * @param {Boolean} deleteSubscriptions : should we delete subscription ?
 */
ServerSession.prototype.close = function (deleteSubscriptions) {

    var self = this;

    theWatchDog.removeSubscriber(self);
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
    if (self.publishEngine) {
        self.publishEngine.shutdown();
        delete self.publishEngine;
        self.publishEngine = null;
    }
    // Post-Conditions
    assert(self.currentSubscriptionCount === 0);

};

/**
 * getMonitoredItems is used to get information about monitored items of a subscription.Its intended
 * use is defined in Part 4. GetMonitoredItem is defined in part 5.
 *
 * @method getMonitoredItems
 * @param subscriptionId {Integer32} Identifier of the subscription.
 * @param  result.serverHandles {Int32[]} Array of serverHandles for all MonitoredItems of the subscription identified by subscriptionId.
 *         result.clientHandles {Int32[]} Array of clientHandles for all MonitoredItems of the subscription identified by subscriptionId.
 *         result.statusCode    {StatusCode}
 *
 * from spec:
 * This method can be used to get the  list of monitored items in a subscription if CreateMonitoredItems failed due to
 * a network interruption and the client does not know if the creation succeeded in the server.
 *
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

/**
 * @method watchdogReset
 * used as a callback for the Watchdog
 * @private
 */
ServerSession.prototype.watchdogReset = function()
{
    var self = this;
    // the server session has expired and must be removed from the server
    self.emit("timeout");

};

exports.ServerSession = ServerSession;