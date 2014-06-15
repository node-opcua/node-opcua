/**
 * @module opcua.server
 */
var NodeId = require("../datamodel/nodeid").NodeId;
var NodeIdType = require("../datamodel/nodeid").NodeIdType;
var ServerSidePublishEngine = require("./server_publish_engine").ServerSidePublishEngine;
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var crypto = require("crypto");
var assert = require('better-assert');
var util = require("util");
var EventEmitter = require("events").EventEmitter;


/**
 * @class ServerSession
 * @param sessionId {Number}
 * @private
 * @constructor
 */
function ServerSession(sessionId) {

    EventEmitter.apply(this, arguments);

    this.authenticationToken = new NodeId(NodeIdType.BYTESTRING,crypto.randomBytes(16));
    this.nodeId = new NodeId(NodeIdType.NUMERIC,sessionId,0);
    assert( this.authenticationToken instanceof NodeId);
    assert( this.nodeId instanceof NodeId);


    this._subscription_counter = 0;
    this._subscriptions = {};

    this.publishEngine = new ServerSidePublishEngine();

    this.publishEngine.setMaxListeners(100);

}
util.inherits(ServerSession,EventEmitter);

var Subscription = require("./subscription").Subscription;

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
        maxLifeTimeCount:   request.requestedLifetimeCount,
        maxKeepAliveCount:  request.requestedMaxKeepAliveCount,
        maxNotificationsPerPublish: request.maxNotificationsPerPublish,
        publishingEnabled: request.publishingEnabled,
        priority: request.priority
    });

    self._subscription_counter +=1;
    var id = self._subscription_counter;

    subscription.id  = id;

    assert(!this._subscriptions[id]);
    this._subscriptions[id] = subscription;

    this.publishEngine.add_subscription(subscription);

    // Notify the owner that a new susbscription has been created
    // @event new_subscription
    // @parm {Subscription} subscription
    this.emit("new_subscription",subscription);

    return subscription;
};



/**
 * number of active subscriptions
 * @property currentSubscriptionCount
 * @type {Number}
 */
ServerSession.prototype.__defineGetter__("currentSubscriptionCount",  function() { return Object.keys(this._subscriptions).length; });
/**
 * number of subscriptions ever created since this object is live
 * @property cumulatedSubscriptionCount
 * @type {Number}
 */
ServerSession.prototype.__defineGetter__("cumulatedSubscriptionCount",function() { return this._subscription_counter; });

/**
 * retrieve an existing subscription by subscriptionId
 * @method getSubscription
 * @param subscriptionId {Integer}
 * @return {Subscription}
 */
ServerSession.prototype.getSubscription = function(subscriptionId) {
    return this._subscriptions[subscriptionId];
};

/**
 * @method deleteSubscription
 * @param subscriptionId {Integer}
 * @return {StatusCode}
 */
ServerSession.prototype.deleteSubscription = function(subscriptionId) {

    var subscription = this.getSubscription(subscriptionId);
    if (!subscription) {
        return StatusCodes.Bad_SubscriptionIdInvalid;
    }
    this._subscriptions[subscriptionId] = null;
    delete this._subscriptions[subscriptionId];

    if (this._subscriptions.length===0) {
        console.log(" should cancel publish request here ");
    }
    return StatusCodes.Good;
};

/**
 * close a ServerSession, this will also
 * @method close
 * @param {Boolean} deleteSubscriptions : should we delete subscription ?
 */
ServerSession.prototype.close = function(deleteSubscriptions)  {

    var self = this;

    // ---------------  delete associated subscriptions ---------------------

    var subscriptions_ids = Object.keys(this._subscriptions);
    assert(deleteSubscriptions === true); // I don't know what to do yet if deleteSubscriptions is false
    subscriptions_ids.forEach(function(subscription_id){
        var statusCode = self.deleteSubscription(subscription_id);
        assert(statusCode === StatusCodes.Good );
    });

    // ---------------- shut down publish engine
    self.publishEngine.shutdown();
    delete self.publishEngine;
    self.publishEngine = null;

    // Post-Conditions
    assert(self.currentSubscriptionCount === 0);

};



exports.ServerSession = ServerSession;