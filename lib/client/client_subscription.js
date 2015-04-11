"use strict";
/**
 * @module opcua.client
 */
require("requirish")._(module);

var util = require("util");
var assert = require("better-assert");
var _ = require("underscore");

var EventEmitter = require("events").EventEmitter;

var subscription_service = require("lib/services/subscription_service");

var TimestampsToReturn = require("lib/services/read_service").TimestampsToReturn;

var ClientSession = require("lib/client/opcua_client").ClientSession;

var ClientMonitoredItem = require("lib/client/client_monitored_item").ClientMonitoredItem;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var NodeId = require("lib/datamodel/nodeid.js");

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
//xx var debugLog = console.log;

/**
 * a object to manage a subscription on the client side.
 *
 * @class ClientSubscription
 * @extends EventEmitter
 *
 * @param session
 * @param options {Object}
 * @param options.requestedPublishingInterval {Number}
 * @param options.requestedLifetimeCount {Number}
 * @param options.requestedMaxKeepAliveCount {Number}
 * @param options.maxNotificationsPerPublish {Number}
 * @param options.publishingEnabled {Boolean}
 * @param options.priority {Number}
 * @constructor
 *
 * events:
 *    "started",     callback(subscriptionId)  : the subscription has been initiated
 *    "terminated"                             : the subscription has been deleted
 *    "error",                                 : the subscription has received an error
 *    "keepalive",                             : the subscription has received a keep alive message from the server
 *    "received_notifications",                : the subscription has received one or more notification
 */
function ClientSubscription(session, options) {

    assert(session instanceof ClientSession);

    var self = this;
    self.publish_engine = session.getPublishEngine();


    //// options should have
    //var allowedProperties = [
    //    'requestedPublishingInterval',
    //    'requestedLifetimeCount',
    //    'requestedMaxKeepAliveCount',
    //    'maxNotificationsPerPublish',
    //    'publishingEnabled',
    //    'priority'
    //];

    options = options || {};
    options.requestedPublishingInterval = options.requestedPublishingInterval || 100;
    options.requestedLifetimeCount = options.requestedLifetimeCount || 60;
    options.requestedMaxKeepAliveCount = options.requestedMaxKeepAliveCount || 2;
    options.maxNotificationsPerPublish = options.maxNotificationsPerPublish || 2;
    options.publishingEnabled = options.publishingEnabled ? true : false;
    options.priority = options.priority || 1;


    self.publishingInterval = options.requestedPublishingInterval;
    self.lifetimeCount = options.requestedLifetimeCount;
    self.maxKeepAliveCount = options.requestedMaxKeepAliveCount;
    self.maxNotificationsPerPublish = options.maxNotificationsPerPublish;
    self.publishingEnabled = options.publishingEnabled;
    self.priority = options.priority;
    self.subscriptionId = "pending";

    self._next_client_handle = 0;
    self.monitoredItems = {};

    setImmediate(function () {

        debugLog("ClientSubscription created ".yellow.bold);
        session.createSubscription(options, function (err, response) {

            if (err) {
                /* istanbul ignore next */
                self.emit("internal_error", err);
            } else {
                self.subscriptionId = response.subscriptionId;
                self.publishingInterval = response.revisedPublishingInterval;
                self.lifetimeCount = response.revisedLifetimeCount;
                self.maxKeepAliveCount = response.revisedMaxKeepAliveCount;

                debugLog("registering callback".yellow.bold);
                self.publish_engine.registerSubscriptionCallback(self.subscriptionId, function (notificationData, publishTime) {

                    debugLog("ClientSubscription received callback  ".yellow, notificationData.length);
                    self.__on_publish_response(notificationData, publishTime);
                });
                setImmediate(function () {
                    /**
                     * notify the observers that the subscription has now started
                     * @event started
                     */
                    self.emit("started", self.subscriptionId);
                });
            }
        });
    });
}
util.inherits(ClientSubscription, EventEmitter);


ClientSubscription.prototype.__on_publish_response_DataChangeNotification = function (notification) {

    assert(notification._schema.name === "DataChangeNotification");

    var self = this;

    var monitoredItems = notification.monitoredItems;

    monitoredItems.forEach(function (monitoredItem) {

        var monitorItemObj = self.monitoredItems[monitoredItem.clientHandle];
        if (monitorItemObj) {
            assert(monitorItemObj, " expecting a monitored item");
            monitorItemObj._notify_value_change(monitoredItem.value);
        }

    });

};

ClientSubscription.prototype.__on_publish_response_StatusChangeNotification = function (notification) {

    var self = this;
    assert(notification._schema.name === "StatusChangeNotification");

    debugLog("Client has received a Status Change Notification ", notification.statusCode.toString());

    self.publish_engine.cleanup_acknowledgment_for_subscription(notification.subscriptionId);

    /**
     * notify the observers that the server has send a status changed notification (such as BadTimeout )
     * @event status_changed
     */
    self.emit("status_changed", notification.statusCode, notification.diagnosticInfo);

};


ClientSubscription.prototype.__on_publish_response = function (notificationData) {

    var self = this;


    if (notificationData.length === 0) {
        // this is a keep alive message
        debugLog("Client : received a keepalive notification from client".yellow);
        /**
         * notify the observers that a keep alive Publish Response has been received from the server.
         * @event keepalive
         */
        self.emit("keepalive");

    } else {

        /**
         * notify the observers that some notifications has been received from the server in  a PublishResponse
         * each modified monitored Item
         * @event  received_notifications
         */
        self.emit("received_notifications");
        // let publish a global event

        // now process all notifications
        notificationData.forEach(function (notification) {
            // DataChangeNotification / StatusChangeNotification / EventNotification
            switch (notification._schema.name) {
                case "DataChangeNotification":
                    // now inform each individual monitored item
                    self.__on_publish_response_DataChangeNotification(notification);
                    break;
                case "StatusChangeNotification":
                    self.__on_publish_response_StatusChangeNotification(notification);
                    break;
                case "EventNotificationList":
                    self.__on_publish_response_EventNotificationList(notification);
                    break;
                default:
                    console.log(" Invalid notification :", notification.toString());
            }
        });
    }

};


/**
 * the associated session
 * @property session
 * @type {ClientSession}
 */
ClientSubscription.prototype.__defineGetter__("session", function () {
    return this.publish_engine.session;
});


ClientSubscription.prototype._terminate_step2 = function () {
    var self = this;


    setImmediate(function () {
        /**
         * notify the observers tha the client subscription has terminated
         * @event  terminated
         */
        self.subscriptionId = "terminated";
        self.emit("terminated");
    });

};

/**
 * @method terminate
 */
ClientSubscription.prototype.terminate = function () {

    var self = this;

    if (_.isFinite(self.subscriptionId)) {

        self.publish_engine.unregisterSubscriptionCallback(self.subscriptionId);
        self.session.deleteSubscriptions({
            subscriptionIds: [self.subscriptionId]
        }, function (err) {
            if (err) {
                /**
                 * notify the observers that an error has occurred
                 * @event internal_error
                 * @param {Error} err the error
                 */
                self.emit("internal_error", err);
            }
            self._terminate_step2();
        });

    } else {
        assert(self.subscriptionId === "pending");
        self._terminate_step2();
    }
};

/**
 * @method nextClientHandle
 */
ClientSubscription.prototype.nextClientHandle = function () {
    this._next_client_handle += 1;
    return this._next_client_handle;
};


ClientSubscription.prototype._add_monitored_item = function (clientHandle, monitoredItem) {
    var self = this;
    assert(monitoredItem.constructor.name === "ClientMonitoredItem");
    assert(monitoredItem.monitoringParameters.clientHandle === clientHandle);
    self.monitoredItems[clientHandle] = monitoredItem;

    /**
     * notify the observers that a new monitored item has been added to the subscription.
     * @event item_added
     * @param {MonitoredItem} the monitored item.
     */
    self.emit("item_added", monitoredItem);
};


/**
 * add a monitor item to the subscription
 *
 * @method monitor
 * @async
 * @param itemToMonitor       // like {ReadValueId}
 * @param requestedParameters // like {MonitoringParameters}
 * @param timestampsToReturn {TimestampsToReturn}
 * @param  [done] {Function} optional done callback
 * @return {ClientMonitoredItem}
 *
 * @example:
 *
 * clientSubscription.monitor(
 *   // itemToMonitor:
 *   {
 *       nodeId: 'ns=0;i=2258',
 *       attributeId: 13,
 *       indexRange: null,
 *       dataEncoding: { namespaceIndex: 0, name: null }
 *   },
 *
 *   // monitoringMode:  'Reporting',
 *
 *   // requestedParameters:
 *   {
 *       clientHandle: 13,
 *       samplingInterval: 3000,
 *       filter:  { parameterTypeId: 'ns=0;i=0',  encodingMask: 0 },
 *       queueSize: 1,
 *       discardOldest: true
 *   },
 *   TimestampToReturn.Neither
 *   );
 *
 */
ClientSubscription.prototype.monitor = function (itemToMonitor, requestedParameters, timestampsToReturn, done) {

    assert(itemToMonitor.nodeId);
    assert(itemToMonitor.attributeId);
    assert(done === undefined || _.isFunction(done));

    // Try to resolve the nodeId and fail fast if we can't.
    NodeId.resolveNodeId(itemToMonitor.nodeId);

    timestampsToReturn = timestampsToReturn || TimestampsToReturn.Neither;

    var self = this;

    var monitoredItem = new ClientMonitoredItem(this, itemToMonitor, requestedParameters, timestampsToReturn);

    var _watch_dog = 0;

    function wait_for_subscription_and_monitor() {

        _watch_dog++;

        if (self.subscriptionId === "pending") {
            // the subscriptionID is not yet known because the server hasn't replied yet
            // let postpone this call, a little bit, to let thinks happen
            setImmediate(wait_for_subscription_and_monitor);

        } else if (self.subscriptionId === "terminated") {
            // the subscription has been terminated in the meantime
            // this indicates a potential issue in the code using this api.
            if (_.isFunction(done)) {
                done(new Error("subscription has been deleted"));
            }
        } else {
            //xxx console.log("xxxx _watch_dog ",_watch_dog);
            monitoredItem._monitor(done);
        }
    }

    setImmediate(wait_for_subscription_and_monitor);
    return monitoredItem;
};

ClientSubscription.prototype.isActive = function () {
    var self = this;
    return typeof(self.subscriptionId) !== "string";
};

ClientSubscription.prototype._remove = function (monitoredItem) {
    var self = this;
    var clientHandle = monitoredItem.monitoringParameters.clientHandle;
    //xx console.log("clientHandle = ",clientHandle);
    //xx console.log((new Error()).stack);
    assert(self.monitoredItems.hasOwnProperty(clientHandle));
    monitoredItem.removeAllListeners();
    delete self.monitoredItems[clientHandle];
};

ClientSubscription.prototype._delete_monitored_item = function (monitoredItem, callback) {
    var self = this;
    assert(self.isActive());

    var clientHandle = monitoredItem.monitoringParameters.clientHandle;

    assert(self.monitoredItems[clientHandle],"expecting existing monitoredItem");

    self.session.deleteMonitoredItems({
        subscriptionId: self.subscriptionId,
        monitoredItemIds: [monitoredItem.monitoredItemId]
    }, function (err) {

        // remove monitored items
        self._remove(monitoredItem);
        assert(!self.monitoredItems[clientHandle],"monitored item should have been removed");
        callback(err);
    });
};

ClientSubscription.prototype.setPublishingMode = function (publishingEnabled, callback) {
    assert(_.isFunction(callback));
    var self = this;
    self.session.setPublishingMode(publishingEnabled, self.subscriptionId, function (err, results) {
        if (err) {
            return callback(err);
        }
        if (results[0] !== StatusCodes.Good) {
            return callback(new Error("Cannot setPublishingMode " + results[0].toString()));
        }
        callback();
    });
};

exports.ClientSubscription = ClientSubscription;
