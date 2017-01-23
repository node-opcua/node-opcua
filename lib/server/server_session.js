/**
 * @module opcua.server
 */
import { NodeId } from "lib/datamodel/nodeid";
import { NodeIdType } from "lib/datamodel/nodeid";
import { ServerSidePublishEngine } from "lib/server/server_publish_engine";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { ContinuationPointManager } from "lib/server/continuation_point_manager";
import { NodeClass } from "lib/datamodel/nodeclass";
import {
  randomGuid
} from "lib/misc/encode_decode";
import crypto from "crypto";
import assert from "better-assert";
import util from "util";
import { EventEmitter } from "events";
import _ from "underscore";
import { WatchDog } from "lib/misc/watchdog";
import { makeNodeId } from "lib/datamodel/nodeid";
import { ObjectIds } from "lib/opcua_node_ids";
import { ServiceCounter } from "_generated_/_auto_generated_ServiceCounter";
import { SessionDiagnostics } from "_generated_/_auto_generated_SessionDiagnostics";
import { DataType } from "lib/datamodel/variant";
import { Variant } from "lib/datamodel/variant";
import { make_debugLog, checkDebugFlag } from "lib/misc/utils";
import { Subscription } from "lib/server/subscription";

const theWatchDog = new WatchDog();

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);


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
class ServerSession extends EventEmitter {
  constructor(parent, sessionId, sessionTimeout) {
    super(...arguments);
    const self = this;
    self.parent = parent; // SessionEngine

    assert(_.isFinite(sessionId));
    assert(sessionId !== 0, " sessionId is null/empty. this is not allowed");

    assert(_.isFinite(sessionTimeout));
    assert(sessionTimeout >= 0, " sessionTimeout");
    self.sessionTimeout = sessionTimeout;

    const authenticationTokenBuf = crypto.randomBytes(16);
    self.authenticationToken = new NodeId(NodeIdType.BYTESTRING, authenticationTokenBuf);

    self.nodeId = new NodeId(NodeIdType.GUID, randomGuid(), 1);

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

  get status() {
    return this.__status;
  }

  set status(value) {
    if (value === "active") {
      assert(this.__value !== "active");
      this._createSessionObjectInAddressSpace();
    }

    this.__status = value;
  }
  get addressSpace() {
    return this.parent.addressSpace;
  }
  /**
   * number of active subscriptions
   * @property currentSubscriptionCount
   * @type {Number}
   */
  get currentSubscriptionCount() {
    const self = this;
    return self.publishEngine ? self.publishEngine.subscriptionCount : 0;
  }

  /**
   * number of subscriptions ever created since this object is live
   * @property cumulatedSubscriptionCount
   * @type {Number}
   */
  get cumulatedSubscriptionCount() {
    return this._cumulatedSubscriptionCount;
  }

  /**
   * number of monitored items
   * @property currentMonitoredItemsCount
   * @type {Number}
   */
  get currentMonitoredItemsCount() {
    const self = this;
    return self.publishEngine ? self.publishEngine.currentMonitoredItemsCount : 0;
  }


  _createSessionObjectInAddressSpace() {
    const self = this;
    if (self.sessionObject) {
      return undefined;
    }
    assert(!self.sessionObject, "ServerSession#_createSessionObjectInAddressSpace already called ?");

    self.sessionObject = null;
    if (!self.addressSpace) {
      console.log("ServerSession#_createSessionObjectInAddressSpace : no addressSpace");
      return undefined; // no addressSpace
    }
    const root = self.addressSpace.findNode(makeNodeId(ObjectIds.RootFolder));
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
    const serverDiagnostics = root.objects.server.serverDiagnostics;

    if (!serverDiagnostics || !serverDiagnostics.sessionsDiagnosticsSummary) {
      console.log("ServerSession#_createSessionObjectInAddressSpace : no serverDiagnostics.sessionsDiagnosticsSummary");
      return false;
    }

    self.sessionObject = self.addressSpace.createNode({
      nodeId: self.nodeId,
      nodeClass: NodeClass.Object,
      browseName: self.sessionName || `Session:${self.nodeId.toString()}`,
      componentOf: serverDiagnostics.sessionsDiagnosticsSummary
    });

    const sessionDiagnosticsDataType = self.addressSpace.findDataType("SessionDiagnosticsDataType");
    const sessionDiagnosticsVariableType = self.addressSpace.findVariableType("SessionDiagnosticsVariableType");

    if (sessionDiagnosticsDataType && sessionDiagnosticsVariableType) {
      // the extension object
      self._sessionDiagnostics = self.addressSpace.constructExtensionObject(sessionDiagnosticsDataType, {});

      self._sessionDiagnostics.clientConnectionTime = (new Date());
      self._sessionDiagnostics.clientLastContactTime = (new Date());

      if (self.parent.clientDescription) {
        self._sessionDiagnostics.clientDescription = self.parent.clientDescription;
      }

      Object.defineProperty(self._sessionDiagnostics, "currentMonitoredItemsCount", {
        get() {
          return self.currentMonitoredItemsCount;
        }
      });
      Object.defineProperty(self._sessionDiagnostics, "currentSubscriptionsCount", {
        get() {
          return self.currentSubscriptionCount;
        }
      });
      Object.defineProperty(self._sessionDiagnostics, "currentPublishRequestsInQueue", {
        get() {
          return self.publishEngine ? self.publishEngine.pendingPublishRequestCount : 0;
        }
      });
      /*
      Object.defineProperty(self._sessionDiagnostics,"sessionId",{
          get: function() {
              return self.nodeId;
          }
      });
      */
      Object.defineProperty(self._sessionDiagnostics, "sessionName", {
        get() {
          assert(_.isString(self.sessionName));
          return self.sessionName.toString();
        }
      });


      self.sessionDiagnostics = sessionDiagnosticsVariableType.instantiate({
        browseName: "SessionDiagnostics",
        componentOf: self.sessionObject,
        value: {
          get() {
            return new Variant({ dataType: DataType.ExtensionObject, value: self._sessionDiagnostics });
          }
        }
      });
    }
    return self.sessionObject;
  }

  _removeSessionObjectFromAddressSpace() {
    const self = this;

    // todo : dump session statitics in a file or somewhere for deeper diagnostic analysis on closed session

    if (!self.addressSpace) { return; }
    if (self.sessionDiagnostics) {
      self.addressSpace.deleteNode(self.sessionDiagnostics);
      self._sessionDiagnostics = null;
      self.sessionDiagnostics = null;
    }
    if (self.sessionObject) {
      self.addressSpace.deleteNode(self.sessionObject);
      self.sessionObject = null;
    }
  }

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
  createSubscription(request) {
    assert(request.hasOwnProperty("requestedPublishingInterval")); // Duration
    assert(request.hasOwnProperty("requestedLifetimeCount"));      // Counter
    assert(request.hasOwnProperty("requestedMaxKeepAliveCount"));  // Counter
    assert(request.hasOwnProperty("maxNotificationsPerPublish"));  // Counter
    assert(request.hasOwnProperty("publishingEnabled"));           // Boolean
    assert(request.hasOwnProperty("priority"));                    // Byte

    const self = this;

    self._cumulatedSubscriptionCount += 1;

    const subscription = new Subscription({
      publishingInterval: request.requestedPublishingInterval,
      lifeTimeCount: request.requestedLifetimeCount,
      maxKeepAliveCount: request.requestedMaxKeepAliveCount,
      maxNotificationsPerPublish: request.maxNotificationsPerPublish,
      publishingEnabled: request.publishingEnabled,
      priority: request.priority,
      id: _get_next_subscriptionId(),
      // -------------------
      publishEngine: self.publishEngine

    });


    self.publishEngine.add_subscription(subscription);

    // Notify the owner that a new subscription has been created
    // @event new_subscription
    // @param {Subscription} subscription
    self.emit("new_subscription", subscription);

    subscription.once("terminated", () => {
      // Notify the owner that a new subscription has been terminated
      // @event subscription_terminated
      // @param {Subscription} subscription
      self.emit("subscription_terminated", subscription);
    });


    return subscription;
  }

  /**
   * retrieve an existing subscription by subscriptionId
   * @method getSubscription
   * @param subscriptionId {Integer}
   * @return {Subscription}
   */
  getSubscription(subscriptionId) {
    const subscription = this.publishEngine.getSubscriptionById(subscriptionId);
    if (subscription && subscription.state === SubscriptionState.CLOSED) {
      // subscription is CLOSED but has not been notified yet
      // it should be considered as excluded
      return null;
    }
    assert(!subscription || subscription.state !== SubscriptionState.CLOSED, "CLOSED subscription shall not be managed by publish engine anymore");
    return subscription;
  }

  /**
   * @method deleteSubscription
   * @param subscriptionId {Integer}
   * @return {StatusCode}
   */
  deleteSubscription(subscriptionId) {
    const subscription = this.getSubscription(subscriptionId);
    if (!subscription) {
      return StatusCodes.BadSubscriptionIdInvalid;
    }

    // xx this.publishEngine.remove_subscription(subscription);
    subscription.terminate();

    if (this.currentSubscriptionCount === 0) {
      const local_publishEngine = this.publishEngine;
      local_publishEngine.cancelPendingPublishRequest();
    }
    return StatusCodes.Good;
  }

  _deleteSubscriptions() {
    const self = this;
    assert(self.publishEngine);

    const subscriptions = self.publishEngine.subscriptions;

    subscriptions.forEach((subscription) => {
      self.deleteSubscription(subscription.id);
    });
  }

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
  close(deleteSubscriptions, reason) {
    // xx console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx => ServerSession.close() ");
    const self = this;

    if (self.publishEngine) {
      self.publishEngine.onSessionClose();
    }

    theWatchDog.removeSubscriber(self);
    // ---------------  delete associated subscriptions ---------------------


    if (!deleteSubscriptions) {
      // I don't know what to do yet if deleteSubscriptions is false
      console.log("TO DO : Closing session without deleting subscription not yet implemented");

      // to do: Put subscriptions in safe place for future transfer if any
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
  }

  /**
   * @method watchdogReset
   * used as a callback for the Watchdog
   * @private
   */
  watchdogReset() {
    const self = this;
    // the server session has expired and must be removed from the server
    self.emit("timeout");
  }
}

ServerSession.maxPublishRequestInQueue = 100;


// xx ServerSession.prototype.__defineGetter__("serverDiagnostics")

// ServerSession.prototype._createDiagnostics = function(addressSpace) {
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
// };


// note OPCUA 1.03 part 4 page 76
// The Server-assigned identifier for the Subscription (see 7.14 for IntegerId definition). This identifier shall
// be unique for the entire Server, not just for the Session, in order to allow the Subscription to be transferred
// to another Session using the TransferSubscriptions service.
// After Server start-up the generation of subscriptionIds should start from a random IntegerId or continue from
// the point before the restart.
let next_subscriptionId = Math.ceil(Math.random() * 1000000);
function _get_next_subscriptionId() {
  debugLog(" next_subscriptionId = ", next_subscriptionId);
  return next_subscriptionId++;
}


import { SubscriptionState } from "./subscription";


export { ServerSession };
