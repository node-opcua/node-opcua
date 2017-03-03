"use strict";
/**
 * @module opcua.client
 */
require("requirish")._(module);

var util = require("util");
var assert = require("better-assert");
var _ = require("underscore");

var EventEmitter = require("events").EventEmitter;

var utils = require("lib/misc/utils");

var subscription_service = require("lib/services/subscription_service");

var TimestampsToReturn = require("lib/services/read_service").TimestampsToReturn;

var ClientSession = require("lib/client/opcua_client").ClientSession;

var ClientMonitoredItem = require("lib/client/client_monitored_item").ClientMonitoredItem;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var NodeId = require("lib/datamodel/nodeid.js");

var read_service = require("lib/services/read_service");
var AttributeIds = read_service.AttributeIds;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
var doDebug = require("lib/misc/utils").checkDebugFlag(__filename);

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
    options.requestedLifetimeCount      = options.requestedLifetimeCount      || 60;
    options.requestedMaxKeepAliveCount  = options.requestedMaxKeepAliveCount  || 10;
    options.maxNotificationsPerPublish  = utils.isNullOrUndefined(options.maxNotificationsPerPublish) ? 0  :  options.maxNotificationsPerPublish;
    options.publishingEnabled           = options.publishingEnabled ? true : false;
    options.priority                    = options.priority || 1;


    self.publishingInterval             = options.requestedPublishingInterval;
    self.lifetimeCount                  = options.requestedLifetimeCount;
    self.maxKeepAliveCount              = options.requestedMaxKeepAliveCount;
    self.maxNotificationsPerPublish     = options.maxNotificationsPerPublish;
    self.publishingEnabled              = options.publishingEnabled;
    self.priority                       = options.priority;

    self.subscriptionId                 = "pending";

    self._next_client_handle = 0;
    self.monitoredItems = {};

    /**
     * set to True when the server has notified us that this sbuscription has timed out
     * ( maxLifeCounter x published interval without being able to process a PublishRequest
     * @property hasTimedOut
     * @type {boolean}
     */
    self.hasTimedOut = false;

    setImmediate(function () {

        self.__create_subscription(function(err){

            if (!err) {


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


ClientSubscription.prototype.__create_subscription = function(callback) {

    assert(_.isFunction(callback));

    var self = this;

    var session =   self.publish_engine.session;

    debugLog("ClientSubscription created ".yellow.bold);

    var request =new subscription_service.CreateSubscriptionRequest({
        requestedPublishingInterval: self.publishingInterval,
        requestedLifetimeCount:      self.lifetimeCount,
        requestedMaxKeepAliveCount:  self.maxKeepAliveCount,
        maxNotificationsPerPublish:  self.maxNotificationsPerPublish,
        publishingEnabled:           self.publishingEnabled,
        priority:                    self.priority
    });

    session.createSubscription(request, function (err, response) {

        if (err) {
            /* istanbul ignore next */
            self.emit("internal_error", err);
            if (callback) { return callback(err); }

        } else {
            self.subscriptionId      = response.subscriptionId;
            self.publishingInterval  = response.revisedPublishingInterval;
            self.lifetimeCount       = response.revisedLifetimeCount;
            self.maxKeepAliveCount   = response.revisedMaxKeepAliveCount;

            self.timeoutHint = (self.maxKeepAliveCount + 10 ) * self.publishingInterval;

            if (doDebug) {
                debugLog("registering callback".yellow.bold);
                debugLog("publishingInterval               ".yellow.bold,self.publishingInterval);
                debugLog("lifetimeCount                    ".yellow.bold,self.lifetimeCount);
                debugLog("maxKeepAliveCount                ".yellow.bold,self.maxKeepAliveCount);
                debugLog("publish request timeout hint =   ".yellow.bold,self.timeoutHint);
            }

            self.publish_engine.registerSubscription(self);

            if (callback) { callback(err); }
        }
    });
};


ClientSubscription.prototype.__on_publish_response_DataChangeNotification = function (notification) {

    assert(notification._schema.name === "DataChangeNotification");

    var self = this;

    var monitoredItems = notification.monitoredItems;

    monitoredItems.forEach(function (monitoredItem) {
        var monitorItemObj = self.monitoredItems[monitoredItem.clientHandle];
        if (monitorItemObj) {
            if (monitorItemObj.itemToMonitor.attributeId === AttributeIds.EventNotifier) {
                console.log("Warning".yellow," Server send a DataChangeNotification for an EventNotifier. EventNotificationList was expected".cyan);
                console.log("         the Server may not be fully OPCUA compliant".cyan,". This notification will be ignored.".yellow);
            } else {
                monitorItemObj._notify_value_change(monitoredItem.value);
            }
        }

    });

};

ClientSubscription.prototype.__on_publish_response_StatusChangeNotification = function (notification) {

    var self = this;

    assert(notification._schema.name === "StatusChangeNotification");

    debugLog("Client has received a Status Change Notification ", notification.statusCode.toString());

    self.publish_engine.cleanup_acknowledgment_for_subscription(notification.subscriptionId);

    if (notification.statusCode === StatusCodes.GoodSubscriptionTransferred) {
        // OPCUA UA Spec 1.0.3 : part 3 - page 82 - 5.13.7 TransferSubscriptions:
        // If the Server transfers the Subscription to the new Session, the Server shall issue a StatusChangeNotification
        // notificationMessage with the status code Good_SubscriptionTransferred to the old Session.
        console.log("ClientSubscription#__on_publish_response_StatusChangeNotification : GoodSubscriptionTransferred");
        self.hasTimedOut = true;
        self.terminate();
    }
    if (notification.statusCode === StatusCodes.BadTimeout) {
        // the server tells use that the subscription has timed out ..
        // this mean that this subscription has been closed on the server side and cannot process any
        // new PublishRequest.
        //
        // from Spec OPCUA Version 1.03 Part 4 - 5.13.1.1 Description : Page 69:
        //
        // h. Subscriptions have a lifetime counter that counts the number of consecutive publishing cycles in
        //    which there have been no Publish requests available to send a Publish response for the
        //    Subscription. Any Service call that uses the SubscriptionId or the processing of a Publish
        //    response resets the lifetime counter of this Subscription. When this counter reaches the value
        //    calculated for the lifetime of a Subscription based on the MaxKeepAliveCount parameter in the
        //    CreateSubscription Service (5.13.2), the Subscription is closed. Closing the Subscription causes
        //    its MonitoredItems to be deleted. In addition the Server shall issue a StatusChangeNotification
        //    notificationMessage with the status code Bad_Timeout.
        //
        self.hasTimedOut = true;
        self.terminate();
    }
    /**
     * notify the observers that the server has send a status changed notification (such as BadTimeout )
     * @event status_changed
     */
    self.emit("status_changed", notification.statusCode, notification.diagnosticInfo);

};

ClientSubscription.prototype.__on_publish_response_EventNotificationList = function (notification) {
    assert(notification._schema.name === "EventNotificationList");

    var self = this;

    notification.events.forEach(function (event) {
        var monitorItemObj = self.monitoredItems[event.clientHandle];
        assert(monitorItemObj, "Expecting a monitored item");


        monitorItemObj._notify_value_change(event.eventFields);
    });
};

ClientSubscription.prototype.onNotificationMessage = function (notificationMessage) {

    var self = this;

    assert(notificationMessage.hasOwnProperty("sequenceNumber"));
    self.lastSequenceNumber = notificationMessage.sequenceNumber;

    self.emit("raw_notification",notificationMessage);

    var notificationData = notificationMessage.notificationData;

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
        self.emit("received_notifications",notificationMessage);
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


ClientSubscription.prototype._terminate_step2 = function (callback) {
    var self = this;


    setImmediate(function () {
        /**
         * notify the observers tha the client subscription has terminated
         * @event  terminated
         */
        self.subscriptionId = "terminated";
        self.emit("terminated");
        callback();
    });

};

/**
 * @method terminate
 */
ClientSubscription.prototype.terminate = function (callback) {

    var self = this;

    callback = callback || function(){};

    if (self.subscriptionId === "terminated") {
        // already terminated... just ignore
        callback(new Error("Already Terminated"));
        return;
    }

    if (_.isFinite(self.subscriptionId)) {

        self.publish_engine.unregisterSubscription(self.subscriptionId);

        if (!self.session) {
            return self._terminate_step2(callback);
        }


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
            self._terminate_step2(callback);
        });

    } else {
        assert(self.subscriptionId === "pending");
        self._terminate_step2(callback);
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
    assert(self.isActive(),"subscription must be active and not terminated");
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
 * @param itemToMonitor                        {ReadValueId}
 * @param itemToMonitor.nodeId                 {NodeId}
 * @param itemToMonitor.attributeId            {AttributeId}
 * @param itemToMonitor.indexRange             {null|NumericRange}
 * @param itemToMonitor.dataEncoding
 * @param requestedParameters                  {MonitoringParameters}
 * @param requestedParameters.clientHandle     {IntegerId}
 * @param requestedParameters.samplingInterval {Duration}
 * @param requestedParameters.filter           {ExtensionObject|null} EventFilter/DataChangeFilter
 * @param requestedParameters.queueSize        {Counter}
 * @param requestedParameters.discardOldest    {Boolean}
 * @param timestampsToReturn                   {Number} //{TimestampsToReturnId}
 * @param  [done]                              {Function} optional done callback
 * @return {ClientMonitoredItem}
 *
 *
 * Monitoring a simple Value Change
 * ---------------------------------
 *
 * @example:
 *
 *   clientSubscription.monitor(
 *     // itemToMonitor:
 *     {
 *       nodeId: "ns=0;i=2258",
 *       attributeId: AttributeIds.Value,
 *       indexRange: null,
 *       dataEncoding: { namespaceIndex: 0, name: null }
 *     },
 *     // requestedParameters:
 *     {
 *        clientHandle: 13,
 *        samplingInterval: 3000,
 *        filter: null,
 *        queueSize: 1,
 *        discardOldest: true
 *     },
 *     TimestampsToReturn.Neither
 *   );
 *
 * Monitoring a Value Change With a DataChange  Filter
 * ---------------------------------------------------
 *
 * options.trigger       {DataChangeTrigger} {Status|StatusValue|StatusValueTimestamp}
 * options.deadbandType  {DeadbandType}      {None|Absolute|Percent}
 * options.deadbandValue {Double}

 * @example:
 *
 *   clientSubscription.monitor(
 *     // itemToMonitor:
 *     {
 *       nodeId: "ns=0;i=2258",
 *       attributeId: AttributeIds.Value,
 *     },
 *     // requestedParameters:
 *     {
 *        clientHandle: 23456789,
 *        samplingInterval: 3000,
 *        filter: new DataChangeFilter({
 *             trigger: DataChangeTrigger.StatusValue,
 *             deadbandType: DeadBandType.Absolute,
 *             deadbandValue: 0.1
 *        }),
 *        queueSize: 1,
 *        discardOldest: true
 *     },
 *     TimestampsToReturn.Neither
 *   );
 *
 *
 * Monitoring an Event
 * -------------------
 *
 *  If the monitor attributeId is EventNotifier then the filter must be specified
 *
 * @example:
 *
 *  var filter =  new subscription_service.EventFilter({
 *    selectClauses: [
 *             { browsePath: [ {name: 'ActiveState'  }, {name: 'id'}  ]},
 *             { browsePath: [ {name: 'ConditionName'}                ]}
 *    ],
 *    whereClause: []
 *  });
 *
 *  clientSubscription.monitor(
 *     // itemToMonitor:
 *     {
 *       nodeId: "ns=0;i=2258",
 *       attributeId: AttributeIds.EventNotifier,
 *       indexRange: null,
 *       dataEncoding: { namespaceIndex: 0, name: null }
 *     },
 *     // requestedParameters:
 *     {
 *        clientHandle: 13,
 *        samplingInterval: 3000,
 *
 *        filter: filter,
 *
 *        queueSize: 1,
 *        discardOldest: true
 *     },
 *     TimestampsToReturn.Neither
 *   );
 *
 *
 *
 *
 *
 *
 */
ClientSubscription.prototype.monitor = function (itemToMonitor, requestedParameters, timestampsToReturn, done) {

    var self = this;
    assert(itemToMonitor.nodeId);
    assert(itemToMonitor.attributeId);
    assert(done === undefined || _.isFunction(done));
    assert(!_.isFunction(timestampsToReturn));

    // Try to resolve the nodeId and fail fast if we can't.
    NodeId.resolveNodeId(itemToMonitor.nodeId);

    timestampsToReturn = timestampsToReturn || TimestampsToReturn.Neither;


    var monitoredItem = new ClientMonitoredItem(this, itemToMonitor, requestedParameters, timestampsToReturn);

    var _watch_dog = 0;

    function wait_for_subscription_and_monitor() {

        _watch_dog++;

        if (self.subscriptionId === "pending") {
            // the subscriptionID is not yet known because the server hasn't replied yet
            // let postpone this call, a little bit, to let things happen
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


/**
 *
 * @param itemsToCreate
 * @param timestampsToReturn
 * @param done
 */
ClientSubscription.prototype.monitorItems = function (itemsToCreate, timestampsToReturn, done) {

  // TODO

};



ClientSubscription.prototype.isActive = function () {
    var self = this;
    return typeof self.subscriptionId !== "string";
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

    assert(self.monitoredItems[clientHandle], "expecting existing monitoredItem");

    self.session.deleteMonitoredItems({
        subscriptionId: self.subscriptionId,
        monitoredItemIds: [monitoredItem.monitoredItemId]
    }, function (err) {

        // remove monitored items
        self._remove(monitoredItem);
        assert(!self.monitoredItems[clientHandle], "monitored item should have been removed");
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



var async = require("async");
/**
 *  utility function to recreate new subscription
 *  @method recreateSubscriptionAndMonitoredItem
 */
ClientSubscription.prototype.recreateSubscriptionAndMonitoredItem = function(callback) {

    debugLog("ClientSubscription#recreateSubscriptionAndMonitoredItem");
    var subscription = this;

    var monitoredItems_old = subscription.monitoredItems;

    subscription.publish_engine.unregisterSubscription(subscription.subscriptionId);

    async.series([

        subscription.__create_subscription.bind(subscription),

        function (callback) {

            var test  = subscription.publish_engine.getSubscription(subscription.subscriptionId);
            assert(test === subscription);

            // re-create monitored items

            var itemsToCreate = [];
            _.forEach(monitoredItems_old,function(monitoredItem,clientHandle) {
                assert(monitoredItem.monitoringParameters.clientHandle > 0);
                itemsToCreate.push({
                    itemToMonitor: monitoredItem.itemToMonitor,
                    monitoringMode: monitoredItem.monitoringMode,
                    requestedParameters: monitoredItem.monitoringParameters
                });

            });

            var createMonitorItemsRequest = new subscription_service.CreateMonitoredItemsRequest({
                subscriptionId:     subscription.subscriptionId,
                timestampsToReturn:  read_service.TimestampsToReturn.Both, // self.timestampsToReturn,
                itemsToCreate: itemsToCreate
            });

            subscription.session.createMonitoredItems(createMonitorItemsRequest, function (err, response) {

                if (!err) {
                    assert(response instanceof subscription_service.CreateMonitoredItemsResponse);
                    var monitoredItemResults = response.results;

                    monitoredItemResults.forEach(function(monitoredItemResult,index) {

                        var clientHandle = itemsToCreate[index].requestedParameters.clientHandle;
                        var monitoredItem = subscription.monitoredItems[clientHandle];

                        if (monitoredItemResult.statusCode === StatusCodes.Good) {

                            monitoredItem.result = monitoredItemResult;
                            monitoredItem.monitoredItemId = monitoredItemResult.monitoredItemId;
                            monitoredItem.monitoringParameters.samplingInterval = monitoredItemResult.revisedSamplingInterval;
                            monitoredItem.monitoringParameters.queueSize = monitoredItemResult.revisedQueueSize;
                            monitoredItem.filterResult = monitoredItemResult.filterResult;

                            // istanbul ignore next
                            if (doDebug) {
                                debugLog("monitoredItemResult.statusCode = ",monitoredItemResult.toString());
                            }

                        } else {
                            // TODO: what should we do ?
                            debugLog("monitoredItemResult.statusCode = ",monitoredItemResult.statusCode.toString());
                        }
                    });

                }
                callback(err);
            });


        }


    ],callback);
};

exports.ClientSubscription = ClientSubscription;
