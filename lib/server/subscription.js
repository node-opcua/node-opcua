"use strict";
/**
 * @module opcua.server
 */
require("requirish")._(module);
var subscription_service = require("lib/services/subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var StatusChangeNotification =subscription_service.StatusChangeNotification;

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var Enum = require("enum");
var assert = require("better-assert");
var _ = require("underscore");

var SequenceNumberGenerator = require("lib/misc/sequence_number_generator").SequenceNumberGenerator;

var EventEmitter = require("events").EventEmitter;
var util = require("util");
var debugLog = require("lib/misc/utils").make_debugLog(__filename);
//xx debugLog = console.log;
var doDebug = true;

var SubscriptionState = new Enum([
    "CLOSED",   // The Subscription  has terminated
    "CREATING", // The Subscription is being created
    "NORMAL",   // The Subscription is cyclically checking for Notifications from its MonitoredItems.
                // The keep-alive counter is not used in this state
    "LATE",     // The publishing timer has expired and there are Notifications available or a keep-alive Message is
                // ready to be sent, but there are no Publish requests queued. When in this state, the next Publish
                // request is processed when it is received. The keep-alive counter is not used in this state.
    "KEEPALIVE" // The Subscription is cyclically checking for Notification
                // alive counter to count down to 0 from its maximum.
]);
exports.SubscriptionState = SubscriptionState;


var minimumPublishingInterval = 50;
var defaultPublishingInterval = 1000;

// verify that the injected publishEngine provides the expected services
// regarding the Subscription requirements...
function _assert_valid_publish_engine(publishEngine) {
    assert(_.isObject(publishEngine));
    assert(_.isNumber(publishEngine.pendingPublishRequestCount));
    assert(_.isFunction(publishEngine.send_notification_message));
    assert(_.isFunction(publishEngine.send_keep_alive_response));
}
/**
 * @class Subscription
 * @param {Object} options
 * @param options.id {Integer} - a unique identifier
 * @param options.publishingInterval {Integer} - [optional](default:1000) the publishing interval.
 * @param options.maxKeepAliveCount  {Integer} - [optional](default:10) the max KeepAlive Count.
 * @param options.maxLifeTimeCount   {Integer} - [optional](default:10) the max Life Time Count
 * @param options.publishingEnabled  {Boolean} - [optional](default:true)
 * @constructor
 */
function Subscription(options) {

    options = options || {};


    EventEmitter.apply(this, arguments);
    var self = this;

    self.publishEngine = options.publishEngine;
    _assert_valid_publish_engine(self.publishEngine);

    self.id = options.id || "<invalid_id>";

    /**
     * the Subscription publishing interval
     * @property  publishingInterval
     * @type {number}
     * @default 1000
     */
    self.publishingInterval = options.publishingInterval || defaultPublishingInterval;
    self.publishingInterval=Math.max(self.publishingInterval,minimumPublishingInterval);

    /**
     * The keep alive count defines how many times the publish interval need to
     * expires without having notifications available before the server send an
     * empty message.
     * OPCUA Spec says: a value of 0 is invalid.
     * @property  maxKeepAliveCount
     * @type {number}
     * @default 10
     *
     */
    self.maxKeepAliveCount = options.maxKeepAliveCount || 10;

    self.resetKeepAliveCounter();

    /**
     * The life time count defines how many times the publish interval expires without
     * having a connection to the client to deliver data.
     * If the life time count reaches maxKeepAliveCount, the subscription will
     * automatically terminate.
     * OPCUA Spec: The life-time count shall be a minimum of three times the keep keep-alive count.
     *
     * Note: this has to be interpreted as without having a PublishRequest available
     * @property  maxLifeTimeCount
     * @type {number}
     * @default 1
     */
    self.maxLifeTimeCount = options.maxLifeTimeCount || 1;

    // let's make sure that maxLifeTimeCount is at least three time maxKeepAliveCount
    self.maxLifeTimeCount = Math.max(self.maxLifeTimeCount,self.maxKeepAliveCount * 3);

    self._life_time_counter = 0;
    self.resetLifeTimeCounter();


    // notification message that are ready to be sent to the client
    self._pending_notifications = [];

    // Subscriptions maintain a retransmission queue of sent NotificationMessages
    // NotificationMessages are retained in this queue until they are acknowledged or until they have been in the queue for a minimum of one keep-alive interval
    self._sent_notifications = [];

    self._sequence_number_generator = new SequenceNumberGenerator();

    // initial state of the subscription
    self.state = SubscriptionState.CREATING;

    self.timerId = null;

    self.publishIntervalCount = 0;

    self.monitoredItems = {}; // monitored item map

    /**
     *  number of monitored Item
     *  @property monitoredItemIdCounter
     *  @type {Number}
     */
    self.monitoredItemIdCounter = 0;


    //  from the spec:
    // When a Subscription is created, the first Message is sent at the end of the first publishing cycle to
    // inform the Client that the Subscription is operational. A NotificationMessage is sent if there are
    // Notifications ready to be reported. If there are none, a keep-alive Message is sent instead that
    // contains a sequence number of 1, indicating that the first NotificationMessage has not yet been sent.
    // This is the only time a keep-alive Message is sent without waiting for the maximum keep-alive count
    // to be reached, as specified in (f) above.
    setImmediate(function(){
        // subscription is now in Normal state
        self.state = SubscriptionState.NORMAL;

        // make sure that a keep-alive Message will be send at the end of the first publishing cycle
        // if there are no Notifications ready.
        self._keep_alive_counter = self.maxKeepAliveCount ;

        self.timerId = setInterval(self._tick.bind(self), self.publishingInterval);
    });

    self.publishingEnabled = (options.publishingEnabled === null || options.publishingEnabled === undefined) ? true : options.publishingEnabled;
}

util.inherits(Subscription, EventEmitter);

// counter
Subscription.prototype._get_next_sequence_number = function () {
    return this._sequence_number_generator.next();
};

// counter
Subscription.prototype._get_future_sequence_number = function () {
   return this._sequence_number_generator.future();
};


Subscription.prototype.setPublishingMode = function(publishingEnabled) {
    this.publishingEnabled = publishingEnabled;
    return StatusCodes.Good;
};


/**
 *  _attempt_to_publish_notification send a "notification" event:
 *
 * @method _attempt_to_publish_notification *
 * @private
 *
 * the event receiver shall implement a method that looks like:
 *
 * @example
 *
 *     subscription.on("notification",function() {
 *         if (can_publish) {
 *             var notification = subscription.popNotificationToSend();
 *             send_notification(notification);
 *         }
 *     });
 *
 */
Subscription.prototype._attempt_to_publish_notification = function () {


    var self = this;
    assert(self.hasPendingNotification);

    self.emit("notification");

    var publishEngine = self.publishEngine;
    if (publishEngine.pendingPublishRequestCount > 0) {

        var subscriptionId = self.id;
        var availableSequenceNumbers = self.getAvailableSequenceNumbers();
        var notificationMessage = self.popNotificationToSend().notification;
        publishEngine.send_notification_message(subscriptionId, notificationMessage, availableSequenceNumbers);

        if (doDebug) { debugLog("Subscription sending a notificationMessage ",subscriptionId, notificationMessage.toString());}

        if (self.state === SubscriptionState.LATE || self.state === SubscriptionState.KEEPALIVE) {
            self.state = SubscriptionState.NORMAL;
        }

    } else {

        assert( self.state !== SubscriptionState.CLOSED);
        if (self.state !== SubscriptionState.LATE) {
            debugLog("Subscription is now Late due to lack of PublishRequest to process");
        }
        // publishEngine has no PublishRequest available to process :
        self.state = SubscriptionState.LATE;
    }


};

/**
 * @method _tick
 * @private
 */
Subscription.prototype._tick = function () {
    var self = this;

    self.publishIntervalCount+=1;
    /**
     * request a notification update from the subscription owner.
     * @event perform_update
     *
     * this event is sent when the subscription requires a data update. it is up to the subscription owner to
     * perform the necessary operations to update the monitored values.
     *
     */
    self.emit("perform_update");
    // collect notification from monitored items
    self.prepareNotification();

    self.increaseLifeTimeCounter();

    self.discardOldSentNotifications();

    if (self.lifeTimeHasExpired) {

        debugLog(" Subscription has expired !!!!! => Terminating".red.bold);
        /**
         * notify the subscription owner that the subscription has expired by exceeding its life time.
         * @event expired
         *
         */
        self.emit("expired");

        // kill timer and delete monitored items
        self.terminate();

    } else if (self.hasPendingNotification && self.publishingEnabled) {

        self._attempt_to_publish_notification();

    } else {
        self.increaseKeepAliveCounter();

        if (self.keepAliveCounterHasExpired) {

            if (self._sendKeepAliveResponse()) {
                //
                self.resetKeepAliveCounter();
                // life time counter
                self.resetLifeTimeCounter();
            }
        }
    }
};


/**
 *
 * @private
 */
Subscription.prototype._sendKeepAliveResponse = function() {

    var self = this;

    var future_sequence_number = self._get_future_sequence_number();

    if(self.publishEngine.send_keep_alive_response(self.id, future_sequence_number)) {
        /**
         * notify the subscription owner that a keepalive message has to be sent.
         * @event keepalive
         *
         */
        self.emit("keepalive",future_sequence_number);
        return true;
    }
    return false;
};



    /**
 * @method resetKeepAliveCounter
 * @private
 * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
 * the CreateSubscription Service( 5.13.2).
 */
Subscription.prototype.resetKeepAliveCounter = function() {
    var self = this;
    self._keep_alive_counter = 0;
};

/**
 * @method increaseKeepAliveCounter
 * @private
 */
Subscription.prototype.increaseKeepAliveCounter = function() {
    var self = this;
    self._keep_alive_counter += 1;
};

/**
 * @property keepAliveCounterHasExpired
 * @private
 * @type {Boolean} true if the keep alive counter has reach its limit.
 */
Subscription.prototype.__defineGetter__("keepAliveCounterHasExpired",function() {
    var self = this;
    return self._keep_alive_counter >= self.maxKeepAliveCount;
});


/**
 * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
 * the CreateSubscription Service( 5.13.2).
 * @method resetLifeTimeCounter
 * @private
 */
Subscription.prototype.resetLifeTimeCounter = function() {
    var self = this;
    self._life_time_counter = 0;
};
/**
 * @method increaseLifeTimeCounter
 * @private
 */
Subscription.prototype.increaseLifeTimeCounter = function() {
    var self = this;
    self._life_time_counter +=1;
};

/**
 * returns True if the subscription life time has expired.
 *
 * @property lifeTimeHasExpired
 * @type {boolean} - true if the subscription life time has expired.
 */
Subscription.prototype.__defineGetter__("lifeTimeHasExpired",function() {
    var self = this;
    assert(self.maxLifeTimeCount>0);
    return self._life_time_counter >= self.maxLifeTimeCount;
});

/**
 * number of milliseconds before this subscription times out (lifeTimeHasExpired === true);
 * @property timeToExpiration
 * @type {Number}
 */
Subscription.prototype.__defineGetter__("timeToExpiration",function(){
    var self = this;
    return (self.maxLifeTimeCount - self._life_time_counter ) * self.publishingInterval;
});


/**
 *
 *  the server invokes the reset_life_time_counters method of the subscription
 *  when the server  has send a Publish Response, so that the subscription
 *  can reset its life time counter.
 *
 * @method reset_life_time_counters
 *
 */
Subscription.prototype.reset_life_time_counters = function () {
    var self = this;
    self.resetLifeTimeCounter();
    self.resetKeepAliveCounter();

};

/**
 * Terminates the subscription.
 * @method terminate
 *
 * Calling this method will also remove any monitored items.
 *
 */
Subscription.prototype.terminate = function () {
    var self = this;

    assert(self.state !== SubscriptionState.CLOSED, "terminate already called ?");
    // stop timer
    clearTimeout(self.timerId);
    self.timerId = 0;

    // dispose all monitoredItem
    var keys = Object.keys(self.monitoredItems);

    keys.forEach(function(key){
        var status = self.removeMonitoredItem(key);
        assert(status === StatusCodes.Good);
    });

    assert(self.monitoredItemCount === 0);

    // notify new terminated status
    debugLog("adding StatusChangeNotification notification message for BadTimeout subscription = ",self.id);
    self.addNotificationMessage(new StatusChangeNotification({statusCode:StatusCodes.BadTimeout}));

    self.state = SubscriptionState.CLOSED;
    /**
     * notify the subscription owner that the subscription has been terminated.
     * @event "terminated"
     */
    self.emit("terminated");
};

/**
 * @method addNotificationMessage
 * @param notificationData {DataChangeNotification|EventNotification}
 */
Subscription.prototype.addNotificationMessage = function(notificationData) {

    var self = this;

    assert(_.isObject(notificationData));

    var notification_message= new NotificationMessage({
        sequenceNumber: self._get_next_sequence_number(),
        publishTime: new Date(),
        notificationData: [ notificationData ]
    });

    assert(notification_message.hasOwnProperty("sequenceNumber"));
    self._pending_notifications.push({
        notification: notification_message,
        start_tick:self.publishIntervalCount,
        sequenceNumber: notification_message.sequenceNumber
    });

};

/**
 * Extract the next Notification that is ready to be sent to the client.
 * @method popNotificationToSend
 * @return {NotificationMessage}  the Notification to send._pending_notifications
 */
Subscription.prototype.popNotificationToSend = function() {
    var self = this;
    assert(self.pendingNotificationsCount >0);
    var notification_message = self._pending_notifications.shift();
    self._sent_notifications.push(notification_message);
    self.reset_life_time_counters();
    return notification_message;
};

/**
 * returns true if the notification has expired
 * @method notificationHasExpired
 * @param notification
 * @return {boolean}
 */
Subscription.prototype.notificationHasExpired= function(notification){
    var self = this;
    assert(notification.hasOwnProperty("start_tick"));
    assert(_.isFinite(notification.start_tick + self.maxKeepAliveCount));
    return (notification.start_tick + self.maxKeepAliveCount) < self.publishIntervalCount;
};

/**
 * discardOldSentNotification find all sent notification message that have expired keep-alive
 * and destroy them.
 * @method discardOldSentNotifications
 * @private
 *
 * Subscriptions maintain a retransmission queue of sent  NotificationMessages.
 * NotificationMessages are retained in this queue until they are acknowledged or until they have
 * been in the queue for a minimum of one keep-alive interval.
 *
 */
Subscription.prototype.discardOldSentNotifications = function() {
    var self = this;
    var arr = _.filter(self._sent_notifications,function(notification){
       return self.notificationHasExpired(notification);
    });
    var results = arr.map(function(notification){
        return self.acknowledgeNotification(notification.sequenceNumber);
    });
    return results;
};

function getSequenceNumbers(arr) {
    return arr.map(function(e){return e.notification.sequenceNumber; });
}
/**
 *  returns in an array the sequence numbers of the notifications that haven't been
 *  acknowledged yet.
 *
 *  @method getAvailableSequenceNumbers
 *  @return {Integer[]}
 *
 */
Subscription.prototype.getAvailableSequenceNumbers = function() {
    var self = this;
    var availableSequenceNumbers = getSequenceNumbers(self._sent_notifications);
    var pendingSequenceNumbers =   getSequenceNumbers(self._pending_notifications);
    return [].concat(availableSequenceNumbers,pendingSequenceNumbers);
};

/**
 * @method acknowledgeNotification
 * @param sequenceNumber {Number}
 * @return {StatusCode}
 */
Subscription.prototype.acknowledgeNotification = function(sequenceNumber) {
    var self = this;

    var foundIndex = -1;
    _.find(self._sent_notifications,function(e,index){
        if(e.sequenceNumber ===  sequenceNumber){
            foundIndex = index;
        }
    });
    if (foundIndex === -1) {
        return StatusCodes.BadSequenceNumberUnknown;
    } else {
        self._sent_notifications.splice(foundIndex,1);
        return StatusCodes.Good;
    }
};


/**
 *
 * @property pendingNotificationsCount  - number of pending notifications
 * @type {Number}
 */
Subscription.prototype.__defineGetter__("pendingNotificationsCount",function() {
    return this._pending_notifications.length;
});

/**
 * return True is there are pending notifications for this subscription.
 * @property hasPendingNotification
 * @type {Boolean}
 */
Subscription.prototype.__defineGetter__("hasPendingNotification", function () {
    var self = this;
    return self.pendingNotificationsCount>0;
});


/**
 * number of sent notifications
 * @property sentNotificationsCount
 * @type {Number}
 */
Subscription.prototype.__defineGetter__("sentNotificationsCount",function() {
    return this._sent_notifications.length;
});

/**
 * number of monitored items.
 * @property monitoredItemCount
 * @type {Number}
 */
Subscription.prototype.__defineGetter__("monitoredItemCount",function() {
    return Object.keys(this.monitoredItems).length;
});


var MonitoredItem = require("lib/server/monitored_item").MonitoredItem;


var MonitoredItemCreateRequest = require("lib/services/subscription_service").MonitoredItemCreateRequest;



Subscription.prototype.adjustSamplingInterval = function(samplingInterval,node) {

    var self = this;

    if (samplingInterval === null) {

        samplingInterval = MonitoredItem.defaultSamplingInterval;

    } else  if (samplingInterval <0) {
        // - The value -1 indicates that the default sampling interval defined by the publishing
        //   interval of the Subscription is requested.
        // - Any negative number is interpreted as -1.
        samplingInterval =  self.publishingInterval;

    } else if (samplingInterval < MonitoredItem.minimumSamplingInterval) {

        // The value 0 indicates that the Server should use the fastest practical rate.
        samplingInterval =  MonitoredItem.minimumSamplingInterval;

        var node_minimumSamplingInterval = (node && node.minimumSamplingInterval)? node.minimumSamplingInterval : 0;

        samplingInterval = Math.max(samplingInterval,node_minimumSamplingInterval);


    } else if (samplingInterval > MonitoredItem.maximumSamplingInterval) {
        // If the requested samplingInterval is higher than the
        // maximum sampling interval supported by the Server, the maximum sampling
        // interval is returned.
        samplingInterval =  MonitoredItem.maximumSamplingInterval;
    }
    return samplingInterval;
};


/**
 *
 * @method createMonitoredItem
 * @param timestampsToReturn
 * @param {MonitoredItemCreateRequest} monitoredItemCreateRequest - the parameters describing the monitored Item to create
 * @param node {BaseNode}
 * @return {subscription_service.MonitoredItemCreateResult}
 */
Subscription.prototype.createMonitoredItem = function(timestampsToReturn,monitoredItemCreateRequest,node) {

    assert(monitoredItemCreateRequest instanceof MonitoredItemCreateRequest);

    var self = this;

    var MonitoredItemCreateResult = subscription_service.MonitoredItemCreateResult;

    self.monitoredItemIdCounter +=1;
    var monitoredItemId = self.monitoredItemIdCounter;

    //-- var itemToMonitor       = monitoredItemCreateRequest.itemToMonitor;

    // TODO: test for BadNodeIdUnknown

    //xx console.log("xxxxx itemToMonitor ".red,itemToMonitor.toString());
    var monitoringMode      = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
    var requestedParameters = monitoredItemCreateRequest.requestedParameters;

    //xx console.log("xxxxx requested samplingInterval".cyan,requestedParameters.samplingInterval);
    // adjust requestedParameters.samplingInterval
    requestedParameters.samplingInterval = self.adjustSamplingInterval(requestedParameters.samplingInterval,node);

    requestedParameters.monitoredItemId = monitoredItemId;

    var monitoredItem = new MonitoredItem(requestedParameters);
    monitoredItem.timestampsToReturn = timestampsToReturn;

    assert(monitoredItem.monitoredItemId === monitoredItemId);
    self.monitoredItems[monitoredItemId] = monitoredItem;

    var monitoredItemCreateResult = new MonitoredItemCreateResult({
        statusCode: StatusCodes.Good,
        monitoredItemId: monitoredItemId,
        revisedSamplingInterval: monitoredItem.samplingInterval,
        revisedQueueSize: monitoredItem.queueSize,
        filterResult: null
    });


    monitoredItem.setMonitoringMode(monitoringMode);

    return monitoredItemCreateResult;
};

/**
 * get a monitoredItem by Id.
 * @method getMonitoredItem
 * @param monitoredItemId  {Number} the id of the monitored item to get.
 * @return {MonitoredItem}
 */
Subscription.prototype.getMonitoredItem = function(monitoredItemId) {
    assert(_.isFinite(monitoredItemId));
    var self = this;
    return self.monitoredItems[monitoredItemId];
};

/**
 * getMonitoredItems is used to get information about monitored items of a subscription.Its intended
 * use is defined in Part 4. This method is the implementation of the Standard OPCUA GetMonitoredItems Method.
 * @method getMonitoredItems
 * @param  result.serverHandles {Int32[]} Array of serverHandles for all MonitoredItems of the subscription identified by subscriptionId.
 *         result.clientHandles {Int32[]} Array of clientHandles for all MonitoredItems of the subscription identified by subscriptionId.
 *         result.statusCode    {StatusCode}
 */
Subscription.prototype.getMonitoredItems = function(/*out*/ result) {

    result = result || {};
    var subscription = this;
    result.serverHandles = [];
    result.clientHandles = [];
    result.statusCode = StatusCodes.Good;

    Object.keys(subscription.monitoredItems).forEach(function(monitoredItemId){

        var monitoredItem = subscription.getMonitoredItem(monitoredItemId);

        result.clientHandles.push(monitoredItem.clientHandle);
        // TODO:  serverHandle is defined anywhere in the OPCUA Specification 1.02
        //        I am not sure what shall be reported for serverHandle...
        //        using monitoredItem.monitoredItemId instead...
        //        May be a clarification in the OPCUA Spec is required.
        result.serverHandles.push(monitoredItemId);

    });
    return result;
};

/**
 * remove a monitored Item from the subscription.
 * @method removeMonitoredItem
 * @param monitoredItemId  {Number} the id of the monitored item to get.
 */
Subscription.prototype.removeMonitoredItem = function(monitoredItemId) {

    debugLog("Removing monitoredIem ", monitoredItemId);

    assert(_.isFinite(monitoredItemId));
    var self = this;
    if (!self.monitoredItems.hasOwnProperty(monitoredItemId)) {
        return StatusCodes.BadMonitoredItemIdInvalid;
    }

    var monitoredItem = self.monitoredItems[monitoredItemId];

    monitoredItem.terminate();

    delete self.monitoredItems[monitoredItemId];

    return StatusCodes.Good;

};

// collect DataChangeNotification
Subscription.prototype.collectDataChangeNotification = function(){

    var self = this;


    var monitoredItems = [];

    var keys = Object.keys(self.monitoredItems);

    keys.forEach(function(key){
       var monitoredItem = self.monitoredItems[key];
       var notifications = monitoredItem.extractMonitoredItemNotifications();
       monitoredItems = monitoredItems.concat(notifications);
    });

    if (monitoredItems.length === 0) {
        return null;
    }
    var DataChangeNotification = subscription_service.DataChangeNotification;

    return new DataChangeNotification({
        monitoredItems: monitoredItems,
        diagnosticInfos: []
    });
};

Subscription.prototype.prepareNotification = function(){
    var self = this;
    var notifications = self.collectDataChangeNotification();
    if (notifications) {
        self.addNotificationMessage(notifications);
    }
};



exports.Subscription = Subscription;