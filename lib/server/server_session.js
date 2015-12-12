"use strict";
/**
 * @module opcua.server
 */
require("requirish")._(module);
var NodeId = require("lib/datamodel/nodeid").NodeId;
var NodeIdType = require("lib/datamodel/nodeid").NodeIdType;
var ServerSidePublishEngine = require("lib/server/server_publish_engine").ServerSidePublishEngine;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var ContinuationPointManager = require("lib/server/continuation_point_manager").ContinuationPointManager;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;

var ec = require("lib/misc/encode_decode");
var crypto = require("crypto");
var assert = require("better-assert");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var _ = require("underscore");

var WatchDog = require("lib/misc/watchdog").WatchDog;

var theWatchDog = new WatchDog();

/**
 *
 * A Server session object.
 *
 * **from OPCUA Spec 1.02:**
 *
 * * Sessions are created to be independent of the underlying communications connection. Therefore, if a communication
 *   connection fails, the Session is not immediately affected. The exact mechanism to recover from an underlying
 *   communication connection error depends on the SecureChannel mapping as described in Part 6.
 *
 * * Sessions are terminated by the Server automatically if the Client fails to issue a Service request on the Session
 *   within the timeout period negotiated by the Server in the CreateSession Service response. This protects the Server
 *   against Client failures and against situations where a failed underlying connection cannot be re-established.
 *
 * * Clients shall be prepared to submit requests in a timely manner to prevent the Session from closing automatically.
 *
 * * Clients may explicitly terminate Sessions using the CloseSession Service.
 *
 * * When a Session is terminated, all outstanding requests on the Session are aborted and Bad_SessionClosed StatusCodes
 *   are returned to the Client. In addition, the Server deletes the entry for the Client from its
 *   SessionDiagnosticsArray Variable and notifies any other Clients who were subscribed to this entry.
 *
 * @class ServerSession
 *
 * @param parent {SessionEngine}
 * @param sessionId {Number}
 * @param sessionTimeout {Number}
 * @private
 * @constructor
 */
function ServerSession(parent, sessionId, sessionTimeout) {

    this.parent = parent; // SessionEngine

    EventEmitter.apply(this, arguments);

    assert(_.isFinite(sessionId));
    assert(sessionId !== 0, " sessionId is null/empty. this is not allowed");

    assert(_.isFinite(sessionTimeout));
    assert(sessionTimeout >= 0, " sessionTimeout");
    this.sessionTimeout = sessionTimeout;

    this.authenticationToken = new NodeId(NodeIdType.BYTESTRING, crypto.randomBytes(16));

    this.nodeId = new NodeId(NodeIdType.GUID, ec.randomGuid(), 1);

    assert(this.authenticationToken instanceof NodeId);
    assert(this.nodeId instanceof NodeId);

    this._subscription_counter = 0;

    this.publishEngine = new ServerSidePublishEngine();

    this.publishEngine.setMaxListeners(100);

    theWatchDog.addSubscriber(this, this.sessionTimeout);

    this.__status = "new";

    /**
     * the continuation point manager for this session
     * @property continuationPointManager
     * @type {ContinuationPointManager}
     */
    this.continuationPointManager = new ContinuationPointManager();

}
util.inherits(ServerSession, EventEmitter);

var eoan = require("lib/address_space/extension_object_array_node");
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var ObjectIds = require("lib/opcua_node_ids").ObjectIds;


Object.defineProperty(ServerSession.prototype,"status",{
    get: function()  {
        return this.__status;
    },
    set: function(value) {

        if (value === "active" ) {
            assert(this.__value!== "active");
            this._createSessionObjectInAddressSpace();
        }

        this.__status = value;
    }
});

ServerSession.prototype.__defineGetter__("addressSpace",function() { return this.parent.addressSpace; });

//xx ServerSession.prototype.__defineGetter__("serverDiagnostics")

var ServiceCounter     = require("schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/ServiceCounter").ServiceCounter;
var SessionDiagnostics = require("schemas/39394884f696ff0bf66bacc9a8032cc074e0158e/SessionDiagnostics").SessionDiagnostics;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;

ServerSession.prototype._createSessionObjectInAddressSpace = function() {

    var self = this;
    if (self.sessionObject) {
        return ; 
    }
    assert(!self.sessionObject,"ServerSession#_createSessionObjectInAddressSpace already called ?");

    self.sessionObject = null;
    if (!self.addressSpace) {
        console.log("ServerSession#_createSessionObjectInAddressSpace : no addressSpace");
        return ; // no addressSpace
    }
    var root = self.addressSpace.findNode(makeNodeId(ObjectIds.RootFolder));
    assert(root,"expecting a root object");

    if(!root.objects) {
        console.log("ServerSession#_createSessionObjectInAddressSpace : no object folder");
        return false;
    }
    if(!root.objects.server) {
        console.log("ServerSession#_createSessionObjectInAddressSpace : no server object");
        return false;
    }
    // self.addressSpace.findNode(makeNodeId(ObjectIds.Server_ServerDiagnostics));
    var serverDiagnostics =  root.objects.server.serverDiagnostics;

     if (!serverDiagnostics || !serverDiagnostics.sessionsDiagnosticsSummary) {
        console.log("ServerSession#_createSessionObjectInAddressSpace : no serverDiagnostics.sessionsDiagnosticsSummary");
        return false;
    }

    self.sessionObject = self.addressSpace.createNode({
        nodeId: self.nodeId,
        nodeClass: NodeClass.Object,
        browseName: self.sessionName || "Session:" + self.nodeId.toString(),
        componentOf: serverDiagnostics.sessionsDiagnosticsSummary
    });

    var sessionDiagnosticsDataType = self.addressSpace.findDataType("SessionDiagnosticsDataType");
    var sessionDiagnosticsVariableType = self.addressSpace.findVariableType("SessionDiagnosticsVariableType");

    if (sessionDiagnosticsDataType && sessionDiagnosticsVariableType) {

        self.sessionDiagnotics = self.addressSpace.constructExtensionObject(sessionDiagnosticsDataType);

        self.sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
            browseName: "SessionDiagnostics",
            componentOf: self.sessionObject,
            value: new Variant({ dataType: DataType.ExtensionObject, value:  self.sessionDiagnotics })
        });

    }
    return self.sessionObject;
};

//ServerSession.prototype._createDiagnostics = function(addressSpace) {
//    var self = this;
//
//    if (!self.sessionObject) {
//        return 0;
//    }
//    // create SessionsDiagnosticsSummary
//    var serverDiagnostics = addressSpace.findNode("ServerDiagnostics");
//    var subscriptionDiagnosticsArray = serverDiagnostics.getComponentByName("SubscriptionDiagnosticsArray");
//    eoan.bindExtObjArrayNode(subscriptionDiagnosticsArray,"SubscriptionDiagnosticsType","subscriptionId");
//
//};

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
        lifeTimeCount: request.requestedLifetimeCount,
        maxKeepAliveCount: request.requestedMaxKeepAliveCount,
        maxNotificationsPerPublish: request.maxNotificationsPerPublish,
        publishingEnabled: request.publishingEnabled,
        priority: request.priority,

        // -------------------
        publishEngine: self.publishEngine

    });

    self._subscription_counter += 1;
    subscription.id = self._subscription_counter;

    self.publishEngine.add_subscription(subscription);

    // Notify the owner that a new subscription has been created
    // @event new_subscription
    // @param {Subscription} subscription
    self.emit("new_subscription", subscription);

    subscription.once("terminated",function() {

        // Notify the owner that a new subscription has been terminated
        // @event subscription_terminated
        // @param {Subscription} subscription
        self.emit("subscription_terminated", subscription);
    });


    return subscription;
};


/**
 * number of active subscriptions
 * @property currentSubscriptionCount
 * @type {Number}
 */
ServerSession.prototype.__defineGetter__("currentSubscriptionCount", function () {
    var self = this;
    return self.publishEngine ? self.publishEngine.subscriptionCount : 0;
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
    return this.publishEngine.getSubscriptionById(subscriptionId);
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

    this.publishEngine.remove_subscription(subscription);
    subscription.terminate();

    if (this.currentSubscriptionCount === 0) {
        // xx console.log(" should cancel publish request here !".red);
        this.publishEngine.cancelPendingPublishRequest();
    }
    return StatusCodes.Good;
};

ServerSession.prototype._deleteSubscriptions = function () {
    var self = this;
    var subscriptions = self.publishEngine.subscriptions;

    subscriptions.forEach(function (subscription) {
        self.deleteSubscription(subscription.id);
    });

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

    //xx console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx => ServerSession.close() ");
    var self = this;

    theWatchDog.removeSubscriber(self);
    // ---------------  delete associated subscriptions ---------------------


    if (!deleteSubscriptions) {
        // I don't know what to do yet if deleteSubscriptions is false
        console.log("TO DO : Closing session without deleting subscription not yet implemented");
    }

    self._deleteSubscriptions();
    assert(self.currentSubscriptionCount === 0);

    // ---------------- shut down publish engine
    if (self.publishEngine) {

        // remove subscription
        self.publishEngine.shutdown();

        assert(self.publishEngine.subscriptionCount === 0);
        delete self.publishEngine;
        self.publishEngine = null;
    }
    // Post-Conditions
    assert(self.currentSubscriptionCount === 0);

    self.status = "closed";
    self.emit("session_closed", self, deleteSubscriptions);


};

/**
 * @method watchdogReset
 * used as a callback for the Watchdog
 * @private
 */
ServerSession.prototype.watchdogReset = function () {
    var self = this;
    // the server session has expired and must be removed from the server
    self.emit("timeout");
};

/**
 * @method changeToChannel
 * @private
 * @param channel
 */
ServerSession.prototype.changeToChannel = function (channel) {
    var self = this;
    if (self.publishEngine) {
        self.publishEngine.cancelPendingPublishRequestBeforeChannelChange();
    }
    self.channel.session_nonce = "CANCELED";
    self.channel = channel;
    self.secureChannelId = channel.secureChannelId;
};


exports.ServerSession = ServerSession;
