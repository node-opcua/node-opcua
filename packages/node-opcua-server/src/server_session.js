"use strict";
/**
 * @module opcua.server
 */

var NodeId = require("node-opcua-nodeid").NodeId;
var NodeIdType = require("node-opcua-nodeid").NodeIdType;
var ServerSidePublishEngine = require("./server_publish_engine").ServerSidePublishEngine;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var ContinuationPointManager = require("./continuation_point_manager").ContinuationPointManager;
var NodeClass = require("node-opcua-data-model").NodeClass;

var DataValue = require("node-opcua-data-value").DataValue;
var VariableIds = require("node-opcua-constants").VariableIds;

var ec = require("node-opcua-basic-types");
var crypto = require("crypto");
var assert = require("node-opcua-assert");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var _ = require("underscore");

var WatchDog = require("node-opcua-utils/src/watchdog").WatchDog;

var theWatchDog = new WatchDog();

var utils = require("node-opcua-utils");
var debugLog = require("node-opcua-debug").make_debugLog(__filename);
var doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

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

    var self = this;
    self.parent = parent; // SessionEngine

    EventEmitter.apply(self, arguments);

    assert(_.isFinite(sessionId));
    assert(sessionId !== 0, " sessionId is null/empty. this is not allowed");

    assert(_.isFinite(sessionTimeout));
    assert(sessionTimeout >= 0, " sessionTimeout");
    self.sessionTimeout = sessionTimeout;

    var authenticationTokenBuf = crypto.randomBytes(16);
    self.authenticationToken = new NodeId(NodeIdType.BYTESTRING, authenticationTokenBuf);

    // the sessionId
    self.nodeId = new NodeId(NodeIdType.GUID, ec.randomGuid(), 1);

    assert(self.authenticationToken instanceof NodeId);
    assert(self.nodeId instanceof NodeId);

    self._cumulatedSubscriptionCount = 0;

    self.publishEngine = new ServerSidePublishEngine({
        maxPublishRequestInQueue: ServerSession.maxPublishRequestInQueue
    });

    self.publishEngine.setMaxListeners(100);

    theWatchDog.addSubscriber(self, self.sessionTimeout);

    self.__status = "new";

    /**
     * the continuation point manager for this session
     * @property continuationPointManager
     * @type {ContinuationPointManager}
     */
    self.continuationPointManager = new ContinuationPointManager();

    /**
     * @property creationDate
     * @type {Date}
     */
    self.creationDate = new Date();

}
util.inherits(ServerSession, EventEmitter);

ServerSession.maxPublishRequestInQueue = 100;

var eoan = require("node-opcua-address-space");
var makeNodeId = require("node-opcua-nodeid").makeNodeId;
var ObjectIds = require("node-opcua-constants").ObjectIds;

Object.defineProperty(ServerSession.prototype, "clientConnectionTime", {
    get: function () {
        var self = this;
        return self.creationDate;
    }
});

Object.defineProperty(ServerSession.prototype, "clientLastContactTime", {
    get: function () {
        var self = this;
        return self._watchDogData.last_seen;
    }
});

Object.defineProperty(ServerSession.prototype, "status", {
    get: function () {
        return this.__status;
    },
    set: function (value) {

        if (value === "active") {
            assert(this.__value !== "active");
            this._createSessionObjectInAddressSpace();
        }
        this.__status = value;
    }
});

ServerSession.prototype.__defineGetter__("addressSpace", function () {
    return this.parent.addressSpace;
});

ServerSession.prototype.__defineGetter__("currentPublishRequestInQueue", function() {
    var self = this;
    return self.publishEngine ? self.publishEngine.pendingPublishRequestCount : 0;
});

//xx ServerSession.prototype.__defineGetter__("serverDiagnostics")

var ServiceCounter = require("node-opcua-common").ServiceCounter;
var SessionDiagnostics = require("node-opcua-common").SessionDiagnostics;
var SubscriptionDiagnostics = require("node-opcua-common").SubscriptionDiagnostics;

var DataType = require("node-opcua-variant").DataType;
var Variant = require("node-opcua-variant").Variant;
var getCurrentClock = require("node-opcua-date-time").getCurrentClock;




ServerSession.prototype.updateClientLastContactTime = function(currentTime) {
    var self = this;
    if (self._sessionDiagnostics && self._sessionDiagnostics.clientLastContactTime) {
        currentTime = currentTime  || new Date();
        // do not record all ticks as this may be overwhelming,
        if (currentTime.getTime()  - 250 >= self._sessionDiagnostics.clientLastContactTime.getTime()) {
            self._sessionDiagnostics.clientLastContactTime = currentTime;
        }
    }
};


/**
 * required for watch dog
 */
ServerSession.prototype.onClientSeen = function(currentTime) {
    var self = this;

    self.updateClientLastContactTime(currentTime);

    if (self._sessionDiagnostics) {
        // see https://opcfoundation-onlineapplications.org/mantis/view.php?id=4111
        assert(self._sessionDiagnostics.hasOwnProperty("currentMonitoredItemsCount"));
        assert(self._sessionDiagnostics.hasOwnProperty("currentSubscriptionsCount"));
        assert(self._sessionDiagnostics.hasOwnProperty("currentPublishRequestsInQueue"));

        // note : https://opcfoundation-onlineapplications.org/mantis/view.php?id=4111
        // sessionDiagnostics extension object uses a different spelling
        // here with an S !!!!
        self._sessionDiagnostics.currentMonitoredItemsCount = self.currentMonitoredItemCount;
        self._sessionDiagnostics.currentSubscriptionsCount = self.currentSubscriptionCount;
        self._sessionDiagnostics.currentPublishRequestsInQueue = self.currentPublishRequestInQueue;
    }
};

ServerSession.prototype.incrementTotalRequestCount = function () {

    var self = this;
    if (self._sessionDiagnostics && self._sessionDiagnostics.totalRequestCount) {
        self._sessionDiagnostics.totalRequestCount.totalCount += 1;
    }
};

var lowerFirstLetter = require("node-opcua-utils").lowerFirstLetter;

ServerSession.prototype.incrementRequestTotalCounter = function (counterName) {
    var self = this;
    if (self._sessionDiagnostics) {
        var propName = lowerFirstLetter(counterName + "Count");
        if (!self._sessionDiagnostics.hasOwnProperty(propName)) {
            console.log(" cannot find" ,propName);
           //xx return;
        }
     //   console.log(self._sessionDiagnostics.toString());
        self._sessionDiagnostics[propName].totalCount = self._sessionDiagnostics[propName].totalCount + 1;
    }
};
ServerSession.prototype.incrementRequestErrorCounter = function (counterName) {
    var self = this;
    if (self._sessionDiagnostics) {
        var propName = lowerFirstLetter(counterName + "Count");
        if (!self._sessionDiagnostics.hasOwnProperty(propName)) {
            console.log(" cannot find" ,propName);
          //xx  return;
        }
        self._sessionDiagnostics[propName].errorCount +=1;
    }
};

ServerSession.prototype._createSessionObjectInAddressSpace = function () {

    var self = this;
    if (self.sessionObject) {
        return;
    }
    assert(!self.sessionObject, "ServerSession#_createSessionObjectInAddressSpace already called ?");

    self.sessionObject = null;
    if (!self.addressSpace) {
        console.log("ServerSession#_createSessionObjectInAddressSpace : no addressSpace");
        return; // no addressSpace
    }
    var root = self.addressSpace.findNode(makeNodeId(ObjectIds.RootFolder));
    assert(root, "expecting a root object");

    if (!root.objects) {
        console.log("ServerSession#_createSessionObjectInAddressSpace : no object folder");
        return false;
    }
    if (!root.objects.server) {
        console.log("ServerSession#_createSessionObjectInAddressSpace : no server object");
        return false;
    }

    // self.addressSpace.findNode(makeNodeId(ObjectIds.Server_ServerDiagnostics));
    var serverDiagnosticsNode = root.objects.server.serverDiagnostics;

    if (!serverDiagnosticsNode || !serverDiagnosticsNode.sessionsDiagnosticsSummary) {
        console.log("ServerSession#_createSessionObjectInAddressSpace : no serverDiagnostics.sessionsDiagnosticsSummary");
        return false;
    }

    var sessionDiagnosticsDataType = self.addressSpace.findDataType("SessionDiagnosticsDataType");

    var sessionDiagnosticsObjectType = self.addressSpace.findObjectType("SessionDiagnosticsObjectType");
    var sessionDiagnosticsVariableType = self.addressSpace.findVariableType("SessionDiagnosticsVariableType");

    var references = [];
    if (sessionDiagnosticsObjectType) {
        references.push({referenceType: "HasTypeDefinition", isForward: true, nodeId: sessionDiagnosticsObjectType});
    }

    self.sessionObject = self.addressSpace.createNode({
        nodeId: self.nodeId,
        nodeClass: NodeClass.Object,
        browseName: self.sessionName || "Session:" + self.nodeId.toString(),
        componentOf: serverDiagnosticsNode.sessionsDiagnosticsSummary,
        typeDefinition: sessionDiagnosticsObjectType,
        references: references
    });

    if (sessionDiagnosticsDataType && sessionDiagnosticsVariableType) {

        // the extension object
        self._sessionDiagnostics = self.addressSpace.constructExtensionObject(sessionDiagnosticsDataType, {});

        // install property getter on property that are unlikely to change
        if (self.parent.clientDescription) {
            self._sessionDiagnostics.clientDescription = self.parent.clientDescription;
        }

        Object.defineProperty(self._sessionDiagnostics, "clientConnectionTime", {
            get: function () {
                return self.clientConnectionTime;
            }
        });

        Object.defineProperty(self._sessionDiagnostics, "actualSessionTimeout", {
            get: function () {
                return self.sessionTimeout;
            }
        });

        Object.defineProperty(self._sessionDiagnostics,"sessionId",{
            get: function() {
                return self.nodeId;
            }
        });
        Object.defineProperty(self._sessionDiagnostics, "sessionName", {
            get: function () {
                assert(_.isString(self.sessionName));
                return self.sessionName.toString();
            }
        });

        self.sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
            browseName: "SessionDiagnostics",
            componentOf: self.sessionObject,
            extensionObject: self._sessionDiagnostics,
            minimumSamplingInterval: 2000 // 2 seconds
        });

        self._sessionDiagnostics = self.sessionDiagnostics.$extensionObject;
    }
    return self.sessionObject;
};

ServerSession.prototype._removeSessionObjectFromAddressSpace = function () {

    var self = this;

    // todo : dump session statistics in a file or somewhere for deeper diagnostic analysis on closed session

    if (!self.addressSpace) {
        return;
    }
    if (self.sessionDiagnostics) {
        self.addressSpace.deleteNode(self.sessionDiagnostics);
        self._sessionDiagnostics = null;
        self.sessionDiagnostics = null;

    }
    if (self.sessionObject) {
        self.addressSpace.deleteNode(self.sessionObject);
        self.sessionObject = null;
    }
};

var Subscription = require("./subscription").Subscription;


// note OPCUA 1.03 part 4 page 76
// The Server-assigned identifier for the Subscription (see 7.14 for IntegerId definition). This identifier shall
// be unique for the entire Server, not just for the Session, in order to allow the Subscription to be transferred
// to another Session using the TransferSubscriptions service.
// After Server start-up the generation of subscriptionIds should start from a random IntegerId or continue from
// the point before the restart.
var next_subscriptionId = Math.ceil(Math.random() * 1000000);

function _get_next_subscriptionId() {
    debugLog(" next_subscriptionId = ", next_subscriptionId);
    return next_subscriptionId++;
}


var eoan = require("node-opcua-address-space");

ServerSession.prototype._getSubscriptionDiagnosticsArray = function () {

    var self = this;
    if (!self.addressSpace) {
        if (doDebug) {
            console.warn("ServerSession#_exposeSubscriptionDiagnostics : no addressSpace");
        }
        return null; // no addressSpace
    }
    var subscriptionDiagnosticsType = self.addressSpace.findVariableType("SubscriptionDiagnosticsType");
    if (!subscriptionDiagnosticsType) {
        if (doDebug) {
            console.warn("ServerSession#_exposeSubscriptionDiagnostics : cannot find SubscriptionDiagnosticsType");
        }
    }

    // SubscriptionDiagnosticsArray = i=2290
    var subscriptionDiagnosticsArray = self.addressSpace.findNode(makeNodeId(VariableIds.Server_ServerDiagnostics_SubscriptionDiagnosticsArray));

    return subscriptionDiagnosticsArray;
};
ServerSession.prototype._exposeSubscriptionDiagnostics = function (subscription) {

    var self = this;
    var subscriptionDiagnosticsArray = self._getSubscriptionDiagnosticsArray();
    var subscriptionDiagnostics = subscription.subscriptionDiagnostics;
    if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
        eoan.addElement(subscriptionDiagnostics, subscriptionDiagnosticsArray);
    }
};

ServerSession.prototype._unexposeSubscriptionDiagnostics = function (subscription) {

    var self = this;
    var subscriptionDiagnosticsArray = self._getSubscriptionDiagnosticsArray();
    var subscriptionDiagnostics = subscription.subscriptionDiagnostics;
    if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
        eoan.removeElement(subscriptionDiagnosticsArray, subscriptionDiagnostics);
    }
};
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

    self._cumulatedSubscriptionCount += 1;

    var subscription = new Subscription({
        publishingInterval: request.requestedPublishingInterval,
        lifeTimeCount: request.requestedLifetimeCount,
        maxKeepAliveCount: request.requestedMaxKeepAliveCount,
        maxNotificationsPerPublish: request.maxNotificationsPerPublish,
        publishingEnabled: request.publishingEnabled,
        priority: request.priority,
        id: _get_next_subscriptionId(),
        // -------------------
        publishEngine: self.publishEngine,
        sessionId: self.nodeId
    });


    self.publishEngine.add_subscription(subscription);

    // Notify the owner that a new subscription has been created
    // @event new_subscription
    // @param {Subscription} subscription
    +self.emit("new_subscription", subscription);

    // add subscription diagnostics to SubscriptionDiagnosticsArray
    self._exposeSubscriptionDiagnostics(subscription);

    subscription.once("terminated", function () {

        self._unexposeSubscriptionDiagnostics(subscription);

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
    return this._cumulatedSubscriptionCount;
});

/**
 * number of monitored items
 * @property currentMonitoredItemCount
 * @type {Number}
 */
ServerSession.prototype.__defineGetter__("currentMonitoredItemCount", function () {
    var self = this;
    return self.publishEngine ? self.publishEngine.currentMonitoredItemCount : 0;
});


var SubscriptionState = require("./subscription").SubscriptionState;
/**
 * retrieve an existing subscription by subscriptionId
 * @method getSubscription
 * @param subscriptionId {Integer}
 * @return {Subscription}
 */
ServerSession.prototype.getSubscription = function (subscriptionId) {
    var subscription = this.publishEngine.getSubscriptionById(subscriptionId);
    if (subscription && subscription.state === SubscriptionState.CLOSED) {
        // subscription is CLOSED but has not been notified yet
        // it should be considered as excluded
        return null;
    }
    assert(!subscription || subscription.state !== SubscriptionState.CLOSED, "CLOSED subscription shall not be managed by publish engine anymore");
    return subscription;
};

/**
 * @method deleteSubscription
 * @param subscriptionId {Integer}
 * @return {StatusCode}
 */
ServerSession.prototype.deleteSubscription = function (subscriptionId) {

    var self = this;
    var subscription = self.getSubscription(subscriptionId);
    if (!subscription) {
        return StatusCodes.BadSubscriptionIdInvalid;
    }

    //xx this.publishEngine.remove_subscription(subscription);
    subscription.terminate();


    if (self.currentSubscriptionCount === 0) {

        var local_publishEngine = self.publishEngine;
        local_publishEngine.cancelPendingPublishRequest();
    }
    return StatusCodes.Good;
};

ServerSession.prototype._deleteSubscriptions = function () {

    var self = this;
    assert(self.publishEngine);

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
 * @param {String} [reason = "CloseSession"] the reason for closing the session (shall be "Timeout", "Terminated" or "CloseSession")
 *
 */
ServerSession.prototype.close = function (deleteSubscriptions, reason) {

    //xx console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx => ServerSession.close() ");
    var self = this;

    if (self.publishEngine) {
        self.publishEngine.onSessionClose();
    }

    theWatchDog.removeSubscriber(self);
    // ---------------  delete associated subscriptions ---------------------


    if (!deleteSubscriptions && self.currentSubscriptionCount !== 0) {

        // I don't know what to do yet if deleteSubscriptions is false
        console.log("TO DO : Closing session without deleting subscription not yet implemented");
        //to do: Put subscriptions in safe place for future transfer if any

    }

    self._deleteSubscriptions();

    assert(self.currentSubscriptionCount === 0);

    // ---------------- shut down publish engine
    if (self.publishEngine) {


        // remove subscription
        self.publishEngine.shutdown();

        assert(self.publishEngine.subscriptionCount === 0);
        self.publishEngine = null;
    }

    // Post-Conditions
    assert(self.currentSubscriptionCount === 0);

    self.status = "closed";
    /**
     * @event session_closed
     * @param deleteSubscriptions {Boolean}
     * @param reason {String}
     */
    self.emit("session_closed", self, deleteSubscriptions, reason);

    self._removeSessionObjectFromAddressSpace();

    assert(!self.sessionDiagnostics, "ServerSession#_removeSessionObjectFromAddressSpace must be called");
    assert(!self.sessionObject, "ServerSession#_removeSessionObjectFromAddressSpace must be called");


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


exports.ServerSession = ServerSession;
