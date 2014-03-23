
/**
 *
 * @param opcua_client
 * @constructor
 */
var subscription_service = require("../subscription_service");
var NotificationMessage = subscription_service.NotificationMessage;
var s = require("../structures");
var StatusCodes = require("../opcua_status_code").StatusCodes;

var assert = require("better-assert");
var _ = require("underscore");

var SequenceNumberGenerator = require("../sequence_number_generator").SequenceNumberGenerator;

var EventEmitter = require("events").EventEmitter;
var util = require("util");

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

function Subscription(options) {

    options = options || {};

    EventEmitter.apply(this, arguments);
    var self = this;

    self.id = options.id || "<invalid_id>";

    self.publishingInterval = options.publishingInterval || 1000;

    // the keep alive count defines how many times the publish interval need to
    // expires without having notifications available before the server send an
    // empty message.
    self.maxKeepAliveCount = options.maxKeepAliveCount || 10;
    self.resetKeepAliveCounter();
    self._keep_alive_counter = self.maxKeepAliveCount ;

    // the life time count defines how many times the publish interval expires without
    // having a connection to the client to deliver data.
    // If the life time count reaches maxKeepAliveCount, the subscription will
    // automatically terminate
    self.maxLifeTimeCount = options.maxLifeTimeCount ||  self.maxKeepAliveCount;
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
 *  the event receiver shall implement a
 *  subscription.on("notification",function() {
 *      if (can_publish) {
 *         var notification = subscription.popNotificationToSend();
 *         send_notificiation(notification);
 *      }
 *  });
 *
 * @private
 */
Subscription.prototype._attempt_to_publish_notification = function () {

    var self = this;
    self.emit("notification");
    //
    // var notification = self.popNotificationToSend();
    // self.resetKeepAliveCounter();
};

/**
 *
 * @private
 */
Subscription.prototype._tick = function () {
    var self = this;

    self.currentTick+=1;

    // request a notification update
    self.emit("perform_update");

    self.increaseLifeTimeCounter();
    self.discardOldSentNotifications();

    if (self.lifeTimeHasExpired()) {
        self.emit("expired");
        // kill timer
        self.terminate();

    } else if (self.hasPendingNotification) {
        self._attempt_to_publish_notification();

    } else {
        self.increaseKeepAliveCounter();
        if (self.keepAliveCounterHasExpired()) {
            var future_sequence_number = self._get_future_sequence_number();
            self.emit("keepalive",future_sequence_number);
            self.resetKeepAliveCounter();
        }
    }
};
/**
 * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
 * the CreateSubscription Service( 5.13.2).
 */
Subscription.prototype.resetKeepAliveCounter = function() {
    var self = this;
    self._keep_alive_counter = 0;
};
Subscription.prototype.increaseKeepAliveCounter = function() {
    var self = this;
    self._keep_alive_counter += 1;
};

Subscription.prototype.keepAliveCounterHasExpired = function() {
    var self = this;
    return self._keep_alive_counter >= self.maxKeepAliveCount;
};


/**
 * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
 * the CreateSubscription Service( 5.13.2).
 */
Subscription.prototype.resetLifeTimeCounter = function() {
    var self = this;
    self._life_time_counter = 0;
};
Subscription.prototype.increaseLifeTimeCounter = function() {
    var self = this;
    self._life_time_counter +=1;
};
Subscription.prototype.lifeTimeHasExpired = function() {
    var self = this;
    assert(self.maxLifeTimeCount>0);
    return self._life_time_counter >= self.maxLifeTimeCount;
};

/**
 *
 *  the server invokes the ping_from_client method of the subscription
 *  when the client has send a Publish Request, so that the subscription
 *  can reset its life time counter.
 *
 */
Subscription.prototype.ping_from_client = function () {
    var self = this;
    self.resetLifeTimeCounter();
};

Subscription.prototype.terminate = function () {
    var self = this;
    clearTimeout(self.timerId);
    self.timerId = 0;
};

Subscription.prototype.addNotificationMessage = function(notificationData) {

    var self = this;

    assert(_.isArray(notificationData));

    var notification_message= new NotificationMessage({
        sequenceNumber: self._get_next_sequence_number(),
        publishTime: new Date(),
        notificationData: notificationData
    });

    assert(notification_message.hasOwnProperty("sequenceNumber"));
    self._pending_notifications.push({
        notification: notification_message,
        start_tick:self.currentTick,
        sequenceNumber: notification_message.sequenceNumber
    });
    self._attempt_to_publish_notification();
};

Subscription.prototype.popNotificationToSend = function() {
    var self = this;
    assert(self.pendingNotificationsCount >0);
    var notification_message = self._pending_notifications.shift();
    self._sent_notifications.push(notification_message);
    self.resetKeepAliveCounter();
    return notification_message;
};

Subscription.prototype.notificationHasExpired= function(notification){
    var self = this;
    assert(notification.hasOwnProperty("start_tick"));
    assert(_.isFinite(notification.start_tick + self.maxKeepAliveCount));
    return (notification.start_tick + self.maxKeepAliveCount) < self.currentTick;
};

/**
 * Subscriptions maintain a retransmission queue of sent  NotificationMessages.
 * NotificationMessages are retained in this queue until they are acknowledged or until they have
 * been in the queue for a minimum of one keep-alive interval.
 *
 * discardOldSentNotification find all sent notification message that have expired keep-alive
 * and destroy them
 */
Subscription.prototype.discardOldSentNotifications = function() {
    var self = this;
    var arr = _.filter(self._sent_notifications,function(notification){
       return self.notificationHasExpired(notification);
    });
    arr.forEach(function(notification){
        self.acknowledgeNotification(notification.sequenceNumber);
    });
};

/**
 *  returns and array of  sequence number of notifications that haven't been
 *  acknowledged yet
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


Subscription.prototype.acknowledgeNotification = function(sequenceNumber) {
    var self = this;

    var foundIndex = -1;
    var n = _.find(self._sent_notifications,function(e,index){
        if(e.sequenceNumber ===  sequenceNumber){
            foundIndex = index;
        }
    });
    assert(foundIndex !== -1);
    self._sent_notifications.splice(foundIndex,1);
};


/**
 * @property : number of pending notification
 */
Subscription.prototype.__defineGetter__("pendingNotificationsCount",function() {
    return this._pending_notifications.length;
});

Subscription.prototype.__defineGetter__("hasPendingNotification", function () {
    var self = this;
    return self.pendingNotificationsCount>0;
});

Subscription.prototype.__defineGetter__("sentNotificationsCount",function() {
    return this._sent_notifications.length;
});
exports.Subscription = Subscription;