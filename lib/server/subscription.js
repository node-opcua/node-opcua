/**
 * @module opcua.server
 */
var subscription_service = require("../services/subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var s = require("../datamodel/structures");
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;

var assert = require("better-assert");
var _ = require("underscore");

var SequenceNumberGenerator = require("../misc/sequence_number_generator").SequenceNumberGenerator;

var EventEmitter = require("events").EventEmitter;
var util = require("util");
var debugLog = require("../misc/utils").make_debugLog(__filename);

var SubscriptionState = new Enum([
    "CLOSED",   // The Subscription has not yet been created or has terminated
    "CREATING", // The Subscription is being created
    "NORMAL",   // The Subscription is cyclically checking for Notifications from its MonitoredItems.
                // The keep-alive counter is not used in this state
    "LATE",     // The publishing timer has expired and there are Notifications available or a keep-alive Message is
                // ready to be sent, but there are no Publish requests queued. When in this state, the next Publish
                // request is processed when it is received. The keep-alive counter is not used in this state.
    "KEEPALIVE" // The Subscription is cyclically checking for Notification
                // alive counter to count down to 0 from its maximum.
]);



/**
 * @class Subscription
 * @param {Object} options
 * @param options.id {Integer} - a unique identifier
 * @param options.publishingInterval {Integer} - [optional](default:1000) the publishing interval.
 * @param options.maxKeepAliveCount  {Integer} - [optional](default:10) the max KeepAlive Count.
 * @param options.maxLifeTimeCount   {Integer} - [optional](default:10) the max Life Time Count
 * @constructor
 */
function Subscription(options) {

    options = options || {};

    EventEmitter.apply(this, arguments);
    var self = this;

    self.id = options.id || "<invalid_id>";

    /**
     * the Subscription publishing interval
     * @property  publishingInterval
     * @type {number}
     * @default 1000
     */
    self.publishingInterval = options.publishingInterval || 1000;

    /**
     * The keep alive count defines how many times the publish interval need to
     * expires without having notifications available before the server send an
     * empty message.
     * OPCUA Spec says: a value of 0 is invalid.
     * @property  maxKeepAliveCount
     * @type {number}
     * @default 1000
     *
     */
    self.maxKeepAliveCount = options.maxKeepAliveCount || 10;

    self.resetKeepAliveCounter();
    self._keep_alive_counter = self.maxKeepAliveCount ;

    /**
     * The life time count defines how many times the publish interval expires without
     * having a connection to the client to deliver data.
     * If the life time count reaches maxKeepAliveCount, the subscription will
     * automatically terminate.
     * OPCUA Spec: The life-time count shall be a minimum of three times the keep keep-alive count.
     *
     * @property  maxLifeTimeCount
     * @type {number}
     * @default 1
     */
    self.maxLifeTimeCount = options.maxLifeTimeCount || 1;

    // let's make sure that maxLifeTimeCount is at least three time maxKeepAliveCount
    self.maxLifeTimeCount = Math.max(self.maxLifeTimeCount,self.maxKeepAliveCount * 3);

    self._life_time_counter = 0;
    self.resetLifeTimeCounter();

    self.currentTick = 0;

    // notification message that are ready to be sent to the client
    self._pending_notifications = [];

    // Subscriptions maintain a retransmission queue of sent NotificationMessages
    // NotificationMessages are retained in this queue until they are acknowledged or until they have been in the queue for a minimum of one keep-alive interval
    self._sent_notifications = [];

    self._sequence_number_generator = new SequenceNumberGenerator();

    setImmediate(function(){
        self._tick();
    });

    self.timerId = setInterval(function () {
        self._tick();
    }, self.publishingInterval);

    self.monitoredItems = {}; // monitored item map

    /**
     *  number of monitored Item
     *  @property monitoredItemIdCounter
     *  @type {Number}
     */
    self.monitoredItemIdCounter = 0;
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
    self.emit("notification");
    // var notification = self.popNotificationToSend();
};

/**
 * @method _tick
 * @private
 */
Subscription.prototype._tick = function () {
    var self = this;

    self.currentTick+=1;

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

    if (self.lifeTimeHasExpired()) {

        console.log(" Subscription has expired !!!!! => Terminating");
        /**
         * notify the subscription owner that the subscription has expired by exceeding its life time.
         * @event expired
         *
         */
        self.emit("expired");
        // kill timer and delete monitored items
        self.terminate();

    } else if (self.hasPendingNotification) {
        self._attempt_to_publish_notification();

    } else {
        self.increaseKeepAliveCounter();
        if (self.keepAliveCounterHasExpired()) {
            var future_sequence_number = self._get_future_sequence_number();

            /**
             * notify the subscription owner that a keepalive message has to be sent.
             * @event keepalive
             *
             */
            self.emit("keepalive",future_sequence_number);

            self.resetKeepAliveCounter();
        }
    }
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
 * @method keepAliveCounterHasExpired
 * @private
 * @return {Boolean} true if the keep alive counter has reach its limit.
 */
Subscription.prototype.keepAliveCounterHasExpired = function() {
    var self = this;
    return self._keep_alive_counter >= self.maxKeepAliveCount;
};


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
 * @method lifeTimeHasExpired
 * @return {boolean} - true if the subscription life time has expired.
 */
Subscription.prototype.lifeTimeHasExpired = function() {
    var self = this;
    assert(self.maxLifeTimeCount>0);
    return self._life_time_counter >= self.maxLifeTimeCount;
};

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
        start_tick:self.currentTick,
        sequenceNumber: notification_message.sequenceNumber
    });
    self._attempt_to_publish_notification();
};

/**
 * Extract the next Notification that is ready to be sent to the client.
 * @method popNotificationToSend
 * @return {*}  the Notification to send.
 */
Subscription.prototype.popNotificationToSend = function() {
    var self = this;
    assert(self.pendingNotificationsCount >0);
    var notification_message = self._pending_notifications.shift();
    self._sent_notifications.push(notification_message);
    self.reset_life_time_counters();
    return notification_message;
};

Subscription.prototype.notificationHasExpired= function(notification){
    var self = this;
    assert(notification.hasOwnProperty("start_tick"));
    assert(_.isFinite(notification.start_tick + self.maxKeepAliveCount));
    return (notification.start_tick + self.maxKeepAliveCount) < self.currentTick;
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
};

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
    var availableSequenceNumber = self._sent_notifications.map(function(e,index){
        return e.notification.sequenceNumber;
    });
    return availableSequenceNumber;
};

/**
 * @method acknowledgeNotification
 * @param sequenceNumber {Number}
 * @return {StatusCode}
 */
Subscription.prototype.acknowledgeNotification = function(sequenceNumber) {
    var self = this;

    var foundIndex = -1;
    var n = _.find(self._sent_notifications,function(e,index){
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


var MonitoredItem = require("./monitored_item").MonitoredItem;


var MonitoredItemCreateRequest = require("../services/subscription_service").MonitoredItemCreateRequest;

/**
 *
 * @method createMonitoredItem
 * @param timestampsToReturn
 * @param {MonitoredItemCreateRequest} monitoredItemCreateRequest - the parameters describing the monitored Item to create
 * @return {subscription_service.MonitoredItemCreateResult}
 */
Subscription.prototype.createMonitoredItem = function(timestampsToReturn,monitoredItemCreateRequest) {

    assert(monitoredItemCreateRequest instanceof MonitoredItemCreateRequest);

    var self = this;

    var MonitoredItemCreateResult = subscription_service.MonitoredItemCreateResult;

    self.monitoredItemIdCounter +=1;
    var monitoredItemId = self.monitoredItemIdCounter;

    var monitoredItemCreateResult = new MonitoredItemCreateResult({
        statusCode: StatusCodes.Good,
        monitoredItemId: monitoredItemId,
        revisedSamplingInterval: monitoredItemCreateRequest.requestedParameters.samplingInterval,
        revisedQueueSize: monitoredItemCreateRequest.requestedParameters.queueSize,
        filterResult: null
    });

    var itemToMonitor       = monitoredItemCreateRequest.itemToMonitor;
    // test for BadNodeIdInvalid or BadNodeIdUnknown

    var monitoringMode      = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
    var requestedParameters = monitoredItemCreateRequest.requestedParameters;

    // test for BadMonitoringModeInvalid ( todo:)

    var monitoredItem = new MonitoredItem(requestedParameters);

    self.monitoredItems[monitoredItemId] = monitoredItem;

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