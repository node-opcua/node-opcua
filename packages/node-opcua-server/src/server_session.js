"use strict";
/**
 * @module opcua.server
 */

const _ = require("underscore");
const crypto = require("crypto");

const NodeId = require("node-opcua-nodeid").NodeId;
const NodeIdType = require("node-opcua-nodeid").NodeIdType;
const ServerSidePublishEngine = require("./server_publish_engine").ServerSidePublishEngine;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const NodeClass = require("node-opcua-data-model").NodeClass;

const DataValue = require("node-opcua-data-value").DataValue;
const VariableIds = require("node-opcua-constants").VariableIds;

const ec = require("node-opcua-basic-types");
const assert = require("node-opcua-assert").assert;
const util = require("util");
const EventEmitter = require("events").EventEmitter;
const eoan = require("node-opcua-address-space");
const makeNodeId = require("node-opcua-nodeid").makeNodeId;
const ObjectIds = require("node-opcua-constants").ObjectIds;

const WatchDog = require("node-opcua-utils").WatchDog;
const theWatchDog = new WatchDog();

const ContinuationPointManager = require("./continuation_point_manager").ContinuationPointManager;

const utils = require("node-opcua-utils");
const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

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

    const session = this;

    session.parent = parent; // SessionEngine

    EventEmitter.apply(session, arguments);

    ServerSession.registry.register(session);

    assert(_.isFinite(sessionId));
    assert(sessionId !== 0, " sessionId is null/empty. this is not allowed");

    assert(_.isFinite(sessionTimeout));
    assert(sessionTimeout >= 0, " sessionTimeout");
    session.sessionTimeout = sessionTimeout;

    const authenticationTokenBuf = crypto.randomBytes(16);
    session.authenticationToken = new NodeId(NodeIdType.BYTESTRING, authenticationTokenBuf);

    // the sessionId
    session.nodeId = new NodeId(NodeIdType.GUID, ec.randomGuid(), 1);

    assert(session.authenticationToken instanceof NodeId);
    assert(session.nodeId instanceof NodeId);

    session._cumulatedSubscriptionCount = 0;

    session.publishEngine = new ServerSidePublishEngine({
        maxPublishRequestInQueue: ServerSession.maxPublishRequestInQueue
    });

    session.publishEngine.setMaxListeners(100);

    theWatchDog.addSubscriber(session, session.sessionTimeout);

    session.__status = "new";

    /**
     * the continuation point manager for this session
     * @property continuationPointManager
     * @type {ContinuationPointManager}
     */
    session.continuationPointManager = new ContinuationPointManager();

    /**
     * @property creationDate
     * @type {Date}
     */
    session.creationDate = new Date();


    session._registeredNodesCounter = 0;
    session._registeredNodes    = {};
    session._registeredNodesInv = {};
}

util.inherits(ServerSession, EventEmitter);

const ObjectRegistry = require("node-opcua-object-registry").ObjectRegistry;
ServerSession.registry = new ObjectRegistry();

ServerSession.prototype.dispose = function() {

    debugLog("ServerSession#dispose()");

    const self = this;

    assert(!self.sessionObject," sessionObject has not been cleared !");

    self.parent = null;
    self.authenticationToken = null;

    if (self.publishEngine) {
        self.publishEngine.dispose();
        self.publishEngine = null;
    }

    self._sessionDiagnostics = null;

    self._registeredNodesCounter = 0;
    self._registeredNodes    = null;
    self._registeredNodesInv = null;
    self.continuationPointManager = null;
    self.removeAllListeners();
    self.__status = "disposed";

    ServerSession.registry.unregister(self);

};
ServerSession.maxPublishRequestInQueue = 100;


Object.defineProperty(ServerSession.prototype, "clientConnectionTime", {
    get: function () {
        const self = this;
        return self.creationDate;
    }
});

Object.defineProperty(ServerSession.prototype, "clientLastContactTime", {
    get: function () {
        const self = this;
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
    return this.parent ? this.parent.addressSpace : null;
});

ServerSession.prototype.__defineGetter__("currentPublishRequestInQueue", function () {
    const self = this;
    return self.publishEngine ? self.publishEngine.pendingPublishRequestCount : 0;
});

//xx ServerSession.prototype.__defineGetter__("serverDiagnostics")

const ServiceCounter = require("node-opcua-common").ServiceCounter;
const SessionDiagnostics = require("node-opcua-common").SessionDiagnostics;
const SubscriptionDiagnostics = require("node-opcua-common").SubscriptionDiagnostics;


ServerSession.prototype.updateClientLastContactTime = function (currentTime) {
    const session = this;
    if (session._sessionDiagnostics && session._sessionDiagnostics.clientLastContactTime) {
        currentTime = currentTime || new Date();
        // do not record all ticks as this may be overwhelming,
        if (currentTime.getTime() - 250 >= session._sessionDiagnostics.clientLastContactTime.getTime()) {
            session._sessionDiagnostics.clientLastContactTime = currentTime;
        }
    }
};


/**
 * @method onClientSeen
 * required for watch dog
 * @param currentTime {DateTime}
 * @private
 */
ServerSession.prototype.onClientSeen = function (currentTime) {
    const session = this;

    session.updateClientLastContactTime(currentTime);

    if (session._sessionDiagnostics) {
        // see https://opcfoundation-onlineapplications.org/mantis/view.php?id=4111
        assert(session._sessionDiagnostics.hasOwnProperty("currentMonitoredItemsCount"));
        assert(session._sessionDiagnostics.hasOwnProperty("currentSubscriptionsCount"));
        assert(session._sessionDiagnostics.hasOwnProperty("currentPublishRequestsInQueue"));

        // note : https://opcfoundation-onlineapplications.org/mantis/view.php?id=4111
        // sessionDiagnostics extension object uses a different spelling
        // here with an S !!!!
        session._sessionDiagnostics.currentMonitoredItemsCount = session.currentMonitoredItemCount;
        session._sessionDiagnostics.currentSubscriptionsCount = session.currentSubscriptionCount;
        session._sessionDiagnostics.currentPublishRequestsInQueue = session.currentPublishRequestInQueue;
    }
};

ServerSession.prototype.incrementTotalRequestCount = function () {

    const session = this;
    if (session._sessionDiagnostics && session._sessionDiagnostics.totalRequestCount) {
        session._sessionDiagnostics.totalRequestCount.totalCount += 1;
    }
};

const lowerFirstLetter = require("node-opcua-utils").lowerFirstLetter;

ServerSession.prototype.incrementRequestTotalCounter = function (counterName) {
    const session = this;
    if (session._sessionDiagnostics) {
        const propName = lowerFirstLetter(counterName + "Count");
        if (!session._sessionDiagnostics.hasOwnProperty(propName)) {
            console.log(" cannot find", propName);
            //xx return;
        }
        //   console.log(self._sessionDiagnostics.toString());
        session._sessionDiagnostics[propName].totalCount = session._sessionDiagnostics[propName].totalCount + 1;
    }
};
ServerSession.prototype.incrementRequestErrorCounter = function (counterName) {
    const session = this;
    if (session._sessionDiagnostics) {
        const propName = lowerFirstLetter(counterName + "Count");
        if (!session._sessionDiagnostics.hasOwnProperty(propName)) {
            console.log(" cannot find", propName);
            //xx  return;
        }
        session._sessionDiagnostics[propName].errorCount += 1;
    }
};

/**
 * return rootFolder.objects.server.serverDiagnostics.sessionsDiagnosticsSummary
 * @returns {UAObject}
 */
ServerSession.prototype.getSessionDiagnosticsArray = function () {
    const self = this;
    return self.addressSpace.rootFolder.objects.server.serverDiagnostics.sessionsDiagnosticsSummary.sessionDiagnosticsArray
};

ServerSession.prototype._createSessionObjectInAddressSpace = function () {

    const session = this;
    if (session.sessionObject) {
        return;
    }
    assert(!session.sessionObject, "ServerSession#_createSessionObjectInAddressSpace already called ?");

    session.sessionObject = null;
    if (!session.addressSpace) {
        debugLog("ServerSession#_createSessionObjectInAddressSpace : no addressSpace");
        return; // no addressSpace
    }
    const root = session.addressSpace.findNode(makeNodeId(ObjectIds.RootFolder));
    assert(root, "expecting a root object");

    if (!root.objects) {
        debugLog("ServerSession#_createSessionObjectInAddressSpace : no object folder");
        return false;
    }
    if (!root.objects.server) {
        debugLog("ServerSession#_createSessionObjectInAddressSpace : no server object");
        return false;
    }

    // self.addressSpace.findNode(makeNodeId(ObjectIds.Server_ServerDiagnostics));
    const serverDiagnosticsNode = root.objects.server.serverDiagnostics;

    if (!serverDiagnosticsNode || !serverDiagnosticsNode.sessionsDiagnosticsSummary) {
        debugLog("ServerSession#_createSessionObjectInAddressSpace : no serverDiagnostics.sessionsDiagnosticsSummary");
        return false;
    }

    const sessionDiagnosticsDataType = session.addressSpace.findDataType("SessionDiagnosticsDataType");

    const sessionDiagnosticsObjectType = session.addressSpace.findObjectType("SessionDiagnosticsObjectType");
    const sessionDiagnosticsVariableType = session.addressSpace.findVariableType("SessionDiagnosticsVariableType");

    const references = [];
    if (sessionDiagnosticsObjectType) {
        references.push({referenceType: "HasTypeDefinition", isForward: true, nodeId: sessionDiagnosticsObjectType});
    }

    session.sessionObject = session.addressSpace.createNode({
        nodeId: session.nodeId,
        nodeClass: NodeClass.Object,
        browseName: session.sessionName || "Session:" + session.nodeId.toString(),
        componentOf: serverDiagnosticsNode.sessionsDiagnosticsSummary,
        typeDefinition: sessionDiagnosticsObjectType,
        references: references
    });

    if (sessionDiagnosticsDataType && sessionDiagnosticsVariableType) {

        // the extension object
        session._sessionDiagnostics = session.addressSpace.constructExtensionObject(sessionDiagnosticsDataType, {});
        session._sessionDiagnostics.session = session;

        // install property getter on property that are unlikely to change
        if (session.parent.clientDescription) {
            session._sessionDiagnostics.clientDescription = session.parent.clientDescription;
        }

        Object.defineProperty(session._sessionDiagnostics, "clientConnectionTime", {
            get: function () {
                return this.session.clientConnectionTime;
            }
        });

        Object.defineProperty(session._sessionDiagnostics, "actualSessionTimeout", {
            get: function () {
                return this.session.sessionTimeout;
            }
        });

        Object.defineProperty(session._sessionDiagnostics, "sessionId", {
            get: function () {
                return this.session.nodeId;
            }
        });

        Object.defineProperty(session._sessionDiagnostics, "sessionName", {
            get: function () {
                assert(_.isString(session.sessionName));
                return this.session.sessionName.toString();
            }
        });

        session.sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
            browseName: "SessionDiagnostics",
            componentOf: session.sessionObject,
            extensionObject: session._sessionDiagnostics,
            minimumSamplingInterval: 2000 // 2 seconds
        });

        session._sessionDiagnostics = session.sessionDiagnostics.$extensionObject;
        assert(session._sessionDiagnostics.session === session);

        const sessionDiagnosticsArray = session.getSessionDiagnosticsArray();

        // add sessionDiagnostics into sessionDiagnoticsArray
        eoan.addElement(session._sessionDiagnostics, sessionDiagnosticsArray);

    }

    const subscriptionDiagnosticsArrayType = session.addressSpace.findVariableType("SubscriptionDiagnosticsArrayType");
    assert(subscriptionDiagnosticsArrayType.nodeId.toString() === "ns=0;i=2171");

    session.subscriptionDiagnosticsArray=
        eoan.createExtObjArrayNode(session.sessionObject, {
            browseName: "SubscriptionDiagnosticsArray",
            complexVariableType: "SubscriptionDiagnosticsArrayType",
            variableType: "SubscriptionDiagnosticsType",
            indexPropertyName: "subscriptionId",
            minimumSamplingInterval: 2000 // 2 seconds
        });

    return session.sessionObject;
};

ServerSession.prototype._removeSessionObjectFromAddressSpace = function () {

    const session = this;

    // todo : dump session statistics in a file or somewhere for deeper diagnostic analysis on closed session

    if (!session.addressSpace) {
        return;
    }
    if (session.sessionDiagnostics) {

        const sessionDiagnosticsArray = session.getSessionDiagnosticsArray();
        eoan.removeElement(sessionDiagnosticsArray, session.sessionDiagnostics.$extensionObject);

        session.addressSpace.deleteNode(session.sessionDiagnostics);

        assert(session._sessionDiagnostics.session === session);
        session._sessionDiagnostics.session = null;

        session._sessionDiagnostics = null;
        session.sessionDiagnostics = null;

    }
    if (session.sessionObject) {
        session.addressSpace.deleteNode(session.sessionObject);
        session.sessionObject = null;
    }
};

const Subscription = require("./server_subscription").Subscription;




ServerSession.prototype._getSubscriptionDiagnosticsArray = function () {

    const session = this;
    if (!session.addressSpace) {
        if (doDebug) {
            console.warn("ServerSession#_getSubscriptionDiagnosticsArray : no addressSpace");
        }
        return null; // no addressSpace
    }

    const subscriptionDiagnosticsArray = session.subscriptionDiagnosticsArray;
    if (!subscriptionDiagnosticsArray) {
        return null; // no subscriptionDiagnosticsArray
    }
    assert(subscriptionDiagnosticsArray.browseName.toString() === "SubscriptionDiagnosticsArray");
    return subscriptionDiagnosticsArray;
};

ServerSession.prototype._exposeSubscriptionDiagnostics = function (subscription) {
    const session = this;
    debugLog("ServerSession#_exposeSubscriptionDiagnostics");
    assert(subscription.$session === session);
    const subscriptionDiagnosticsArray = session._getSubscriptionDiagnosticsArray();
    const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
    assert(subscriptionDiagnostics.$subscription == subscription);

    if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
        //xx console.log("GGGGGGGGGGGGGGGG => ServerSession Exposing subscription diagnostics =>",subscription.id,"on session", session.nodeId.toString());
        eoan.addElement(subscriptionDiagnostics, subscriptionDiagnosticsArray);
    }
};

function compareSessionId(sessionDiagnostics1, sessionDiagnostics2) {
    return sessionDiagnostics1.sessionId.toString() == sessionDiagnostics2.sessionId.toString();
}

ServerSession.prototype._unexposeSubscriptionDiagnostics = function (subscription) {

    const session = this;
    const subscriptionDiagnosticsArray = session._getSubscriptionDiagnosticsArray();
    const subscriptionDiagnostics = subscription.subscriptionDiagnostics;
    assert(subscriptionDiagnostics instanceof SubscriptionDiagnostics);
    if (subscriptionDiagnostics && subscriptionDiagnosticsArray) {
        //xx console.log("GGGGGGGGGGGGGGGG => ServerSession **Unexposing** subscription diagnostics =>",subscription.id,"on session", session.nodeId.toString());
        eoan.removeElement(subscriptionDiagnosticsArray, subscriptionDiagnostics);
    }
    debugLog("ServerSession#_unexposeSubscriptionDiagnostics");
};


ServerSession.prototype.assignSubscription = function (subscription) {
    const session = this;
    assert(!subscription.$session);
    assert(session.nodeId instanceof NodeId);


    subscription.$session = session;

    subscription.sessionId = session.nodeId;

    session._cumulatedSubscriptionCount += 1;

    // Notify the owner that a new subscription has been created
    // @event new_subscription
    // @param {Subscription} subscription
    session.emit("new_subscription", subscription);

    // add subscription diagnostics to SubscriptionDiagnosticsArray
    session._exposeSubscriptionDiagnostics(subscription);

    subscription.once("terminated", function () {
        //Xx session._unexposeSubscriptionDiagnostics(subscription);
        // Notify the owner that a new subscription has been terminated
        // @event subscription_terminated
        // @param {Subscription} subscription
        session.emit("subscription_terminated", subscription);
    });


};
ServerSession.prototype.createSubscription = function(parameters) {
    const session = this;
    const subscription = session.parent._createSubscriptionOnSession(session,parameters);
    session.assignSubscription(subscription);
    assert(subscription.$session === session);
    assert(subscription._sessionId instanceof NodeId);
    assert(subscription._sessionId = session.nodeId);
    return subscription;
};


/**
 * number of active subscriptions
 * @property currentSubscriptionCount
 * @type {Number}
 */
ServerSession.prototype.__defineGetter__("currentSubscriptionCount", function () {
    const self = this;
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
    const self = this;
    return self.publishEngine ? self.publishEngine.currentMonitoredItemCount : 0;
});


const SubscriptionState = require("./server_subscription").SubscriptionState;
/**
 * retrieve an existing subscription by subscriptionId
 * @method getSubscription
 * @param subscriptionId {Number}
 * @return {Subscription}
 */
ServerSession.prototype.getSubscription = function (subscriptionId) {
    const subscription = this.publishEngine.getSubscriptionById(subscriptionId);
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
 * @param subscriptionId {Number}
 * @return {StatusCode}
 */
ServerSession.prototype.deleteSubscription = function (subscriptionId) {

    const session = this;
    const subscription = session.getSubscription(subscriptionId);
    if (!subscription) {
        return StatusCodes.BadSubscriptionIdInvalid;
    }

    //xx this.publishEngine.remove_subscription(subscription);
    subscription.terminate();

    if (session.currentSubscriptionCount === 0) {

        const local_publishEngine = session.publishEngine;
        local_publishEngine.cancelPendingPublishRequest();
    }
    return StatusCodes.Good;
};

ServerSession.prototype._deleteSubscriptions = function () {

    const session = this;
    assert(session.publishEngine);

    const subscriptions = session.publishEngine.subscriptions;

    subscriptions.forEach(function (subscription) {
        session.deleteSubscription(subscription.id);
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
    const session = this;

    if (session.publishEngine) {
        session.publishEngine.onSessionClose();
    }

    theWatchDog.removeSubscriber(session);
    // ---------------  delete associated subscriptions ---------------------


    if (!deleteSubscriptions && session.currentSubscriptionCount !== 0) {

        // I don't know what to do yet if deleteSubscriptions is false
        console.log("TO DO : Closing session without deleting subscription not yet implemented");
        //to do: Put subscriptions in safe place for future transfer if any

    }

    session._deleteSubscriptions();

    assert(session.currentSubscriptionCount === 0);


    // Post-Conditions
    assert(session.currentSubscriptionCount === 0);

    session.status = "closed";
    /**
     * @event session_closed
     * @param deleteSubscriptions {Boolean}
     * @param reason {String}
     */
    session.emit("session_closed", session, deleteSubscriptions, reason);


    // ---------------- shut down publish engine
    if (session.publishEngine) {

        // remove subscription
        session.publishEngine.shutdown();

        assert(session.publishEngine.subscriptionCount === 0);
        session.publishEngine.dispose();
        session.publishEngine = null;
    }

    session._removeSessionObjectFromAddressSpace();

    assert(!session.sessionDiagnostics, "ServerSession#_removeSessionObjectFromAddressSpace must be called");
    assert(!session.sessionObject, "ServerSession#_removeSessionObjectFromAddressSpace must be called");

};

/**
 * @method watchdogReset
 * used as a callback for the Watchdog
 * @private
 */
ServerSession.prototype.watchdogReset = function () {
    const self = this;
    // the server session has expired and must be removed from the server
    self.emit("timeout");
};

const registeredNodeNameSpace = 9999  ;

ServerSession.prototype.registerNode = function(nodeId) {

    assert(nodeId instanceof NodeId);
    const session = this;

    if (nodeId.namespace === 0 && nodeId.identifierType.value === NodeIdType.NUMERIC.value) {
        return nodeId;
    }

    const key = nodeId.toString();

    const registeredNode = session._registeredNodes[key];
    if (registeredNode) {
        // already registered
        return registeredNode;
    }

    const node = session.addressSpace.findNode(nodeId);
    if (!node) {
        return nodeId;
    }

    session._registeredNodesCounter +=1;

    const aliasNodeId = makeNodeId(session._registeredNodesCounter,registeredNodeNameSpace);
    session._registeredNodes[key] = aliasNodeId;
    session._registeredNodesInv[aliasNodeId.toString()] = node;
    return aliasNodeId;
};

ServerSession.prototype.unRegisterNode = function(aliasNodeId) {

    assert(aliasNodeId instanceof NodeId);
    if (aliasNodeId.namespace !== registeredNodeNameSpace) {
        return aliasNodeId; // not a registered Node
    }
    const session = this;


    const node = session._registeredNodesInv[aliasNodeId.toString()];
    if (!node) {
        return ;
    }
    session._registeredNodesInv[aliasNodeId.toString()] = null;
    session._registeredNodes[node.nodeId.toString()] = null;

};

ServerSession.prototype.resolveRegisteredNode = function(aliasNodeId) {

    const session = this;
    if (aliasNodeId.namespace !== registeredNodeNameSpace) {
        return aliasNodeId; // not a registered Node
    }
    const node = session._registeredNodesInv[aliasNodeId.toString()];
    if (!node) {
        return aliasNodeId;
    }
    return node.nodeId;
};

/**
 * true if the underlying channel has been closed or aborted...
 */
ServerSession.prototype.__defineGetter__("aborted", function () {
    const session = this;
    if (!session.channel) {
        return true;
    }
    return session.channel.aborted;
});

function on_channel_abort()
{
    const session = this;
    debugLog("ON CHANNEL ABORT ON  SESSION!!!");
    /**
     * @event channel_aborted
     */
    session.emit("channel_aborted");
}

ServerSession.prototype._attach_channel = function(channel) {
    const session = this;
    assert(session.nonce && session.nonce instanceof Buffer);
    session.channel = channel;
    session.secureChannelId = channel.secureChannelId;
    const key = session.authenticationToken.toString("hex");
    assert(!channel.sessionTokens.hasOwnProperty(key), "channel has already a session");
    channel.sessionTokens[key] = session;

    // when channel is aborting
    session.channel_abort_event_handler = on_channel_abort.bind(session);
    channel.on("abort", session.channel_abort_event_handler);

};

ServerSession.prototype._detach_channel = function() {

    const session = this;
    const channel = session.channel;
    assert(channel,"expecting a valid channel");
    assert(session.nonce && session.nonce instanceof Buffer);
    assert(session.authenticationToken);
    const key = session.authenticationToken.toString("hex");
    assert(channel.sessionTokens.hasOwnProperty(key));
    assert(session.channel);
    assert(_.isFunction(session.channel_abort_event_handler));
    channel.removeListener("abort", session.channel_abort_event_handler);

    delete channel.sessionTokens[key];
    session.channel = null;
    session.secureChannelId = null;
};

exports.ServerSession = ServerSession;
