/**
 * @module opcua.server
 */

import Dequeue from "dequeue";
import subscription_service from "lib/services/subscription_service";
const NotificationMessage = subscription_service.NotificationMessage;
const StatusChangeNotification = subscription_service.StatusChangeNotification;

import { StatusCodes } from "lib/datamodel/opcua_status_code";
import Enum from "lib/misc/enum";
import assert from "better-assert";
import _ from "underscore";
import { AttributeIds } from "lib/datamodel/attributeIds";
import { SequenceNumberGenerator } from "lib/misc/sequence_number_generator";
import { EventEmitter } from "events";
import util from "util";
import { ObjectRegistry } from "lib/misc/objectRegistry";
import { MonitoredItem } from "lib/server/monitored_item";
import { MonitoredItemCreateRequest } from "lib/services/subscription_service";


import { checkSelectClauses } from "lib/tools/tools_event_filter";

import { UAVariable } from "lib/address_space/ua_variable";
import { validateFilter } from "./validate_filter";
import { is_valid_dataEncoding } from "lib/misc/data_encoding";

import {
  make_debugLog,
  checkDebugFlag
} from "lib/misc/utils";


const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

const SubscriptionState = new Enum([
  "CLOSED",   // The Subscription has not yet been created or has terminated.
  "CREATING", // The Subscription is being created
  "NORMAL",   // The Subscription is cyclically checking for Notifications from its MonitoredItems.
  // The keep-alive counter is not used in this state.
  "LATE",     // The publishing timer has expired and there are Notifications available or a keep-alive Message is
  // ready to be sent, but there are no Publish requests queued. When in this state, the next Publish
  // request is processed when it is received. The keep-alive counter is not used in this state.
  "KEEPALIVE",// The Subscription is cyclically checking for Notification
  // alive counter to count down to 0 from its maximum.
  "TERMINATED"
]);
export { SubscriptionState };
import { SubscriptionDiagnostics } from "_generated_/_auto_generated_SubscriptionDiagnostics";

const minimumPublishingInterval = 100;  // fastest possible
const defaultPublishingInterval = 100;
const maximumPublishingInterval = 1000 * 60 * 60 * 24 * 30; // 1 month

function _adjust_publishing_interval(publishingInterval) {
  publishingInterval = publishingInterval || defaultPublishingInterval;
  publishingInterval = Math.max(publishingInterval, minimumPublishingInterval);
  publishingInterval = Math.min(publishingInterval, maximumPublishingInterval);
  return publishingInterval;
}

const minimumMaxKeepAliveCount = 2;
const maximumMaxKeepAliveCount = 12000;
function _adjust_maxKeepAliveCount(maxKeepAliveCount, publishingInterval) {
  maxKeepAliveCount = maxKeepAliveCount || minimumMaxKeepAliveCount;
  maxKeepAliveCount = Math.max(maxKeepAliveCount, minimumMaxKeepAliveCount);
  maxKeepAliveCount = Math.min(maxKeepAliveCount, maximumMaxKeepAliveCount);
  return maxKeepAliveCount;
}
function _adjust_lifeTimeCount(lifeTimeCount, maxKeepAliveCount) {
  lifeTimeCount = lifeTimeCount || 1;

  // let's make sure that lifeTimeCount is at least three time maxKeepAliveCount
  // Note : the specs say ( part 3  - CreateSubscriptionParameter )
  //        "The lifetime count shall be a minimum of three times the keep keep-alive count."
  lifeTimeCount = Math.max(lifeTimeCount, maxKeepAliveCount * 3);
  return lifeTimeCount;
}

function _adjust_publishinEnable(publishingEnabled) {
  return (publishingEnabled === null || publishingEnabled === undefined) ? true : !!publishingEnabled;
}

function _adjust_maxNotificationsPerPublish(maxNotificationsPerPublish) {
  maxNotificationsPerPublish += 0;
  assert(_.isNumber(maxNotificationsPerPublish));
  return (maxNotificationsPerPublish >= 0) ? maxNotificationsPerPublish : 0;
}
// verify that the injected publishEngine provides the expected services
// regarding the Subscription requirements...
function _assert_valid_publish_engine(publishEngine) {
  assert(_.isObject(publishEngine));
  assert(_.isNumber(publishEngine.pendingPublishRequestCount));
  assert(_.isFunction(publishEngine.send_notification_message));
  assert(_.isFunction(publishEngine.send_keep_alive_response));
  assert(_.isFunction(publishEngine.on_close_subscription));
}


function installSubscriptionDiagnostics(self) {
  self.subscriptionDiagnostics = new SubscriptionDiagnostics({});

  // "sessionId"
  self.subscriptionDiagnostics.__defineGetter__("sessionId", () => self.sessionId);
  self.subscriptionDiagnostics.__defineGetter__("subscriptionId", () => self.id);
  self.subscriptionDiagnostics.__defineGetter__("priority", () => self.priority);
  self.subscriptionDiagnostics.__defineGetter__("publishingInterval", () => self.publishingInterval);
  self.subscriptionDiagnostics.__defineGetter__("maxLifetimeCount", () => self.lifeTimeCount);
  self.subscriptionDiagnostics.__defineGetter__("maxKeepAliveCount", () => self.maxKeepAliveCount);
  self.subscriptionDiagnostics.__defineGetter__("maxNotificationsPerPublish", () => self.maxNotificationsPerPublish);
  self.subscriptionDiagnostics.__defineGetter__("publishingEnabled", () => self.publishingEnabled);
  self.subscriptionDiagnostics.__defineGetter__("monitoredItemCount", () => self.monitoredItemCount);
  self.subscriptionDiagnostics.__defineGetter__("nextSequenceNumber", () => self._get_future_sequence_number());
  self.subscriptionDiagnostics.__defineGetter__("disabledMonitoredItemCount", () => self.disabledMonitoredItemCount);

  /* those member of self.subscriptionDiagnostics are handled directly

   modifyCount
   enableCount,
   disableCount,
   republishRequestCount,
   notificationsCount,
   publishRequestCount,
   dataChangeNotificationsCount,
   eventNotificationsCount,
  */

  /*
   those members are not updated yet in the code :
   "republishMessageRequestCount",
   "republishMessageCount",
   "transferRequestCount",
   "transferredToAltClientCount",
   "transferredToSameClientCount",
   "latePublishRequestCount",
   "currentKeepAliveCount",
   "currentLifetimeCount",
   "unacknowledgedMessageCount",
   "discardedMessageCount",
   "monitoringQueueOverflowCount",
   "eventQueueOverFlowCount"
   */
  // add object in Variable SubscriptionDiagnosticArray (i=2290) ( Array of SubscriptionDiagnostics)
  // add properties in Variable to reflect
}

/**
 * The Subscription class used in the OPCUA server side.
 * @class Subscription
 * @param {Object} options
 * @param options.id {Integer} - a unique identifier
 * @param options.publishingInterval {Integer} - [optional](default:1000) the publishing interval.
 * @param options.maxKeepAliveCount  {Integer} - [optional](default:10) the max KeepAlive Count.
 * @param options.lifeTimeCount      {Integer} - [optional](default:10) the max Life Time Count
 * @param options.publishingEnabled  {Boolean} - [optional](default:true)
 * @param options.maxNotificationsPerPublish {Integer} - [optional](default:0)
 * @param options.priority {Byte}
 * @constructor
 */
class Subscription extends EventEmitter {
  constructor(options = {}) {
    super(...arguments);
    const self = this;

    self.publishEngine = options.publishEngine;
    _assert_valid_publish_engine(self.publishEngine);

    self.id = options.id || "<invalid_id>";

    self.priority = options.priority || 0;


    /**
     * the Subscription publishing interval
     * @property  publishingInterval
     * @type {number}
     * @default 1000
     */
    self.publishingInterval = _adjust_publishing_interval(options.publishingInterval);

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
    self.maxKeepAliveCount = _adjust_maxKeepAliveCount(
      options.maxKeepAliveCount,
      self.publishingInterval);

    self.resetKeepAliveCounter();

    /**
     * The life time count defines how many times the publish interval expires without
     * having a connection to the client to deliver data.
     * If the life time count reaches maxKeepAliveCount, the subscription will
     * automatically terminate.
     * OPCUA Spec: The life-time count shall be a minimum of 
     *   three times the keep keep-alive count.
     *
     * Note: this has to be interpreted as without having a PublishRequest available
     * @property  lifeTimeCount
     * @type {Number}
     * @default 1
     */
    self.lifeTimeCount = _adjust_lifeTimeCount(
      options.lifeTimeCount,
      self.maxKeepAliveCount);


    /**
     * The maximum number of notifications that the Client wishes to receive in a
     * single Publish response. A value of zero indicates that there is no limit.
     * The number of notifications per Publish is the sum of monitoredItems in the
     * DataChangeNotification and events in the EventNotificationList.
     *
     * @property maxNotificationsPerPublish
     * @type {Number}
     * #default 0
     */
    self.maxNotificationsPerPublish = _adjust_maxNotificationsPerPublish(
      options.maxNotificationsPerPublish);

    self._life_time_counter = 0;
    self.resetLifeTimeCounter();

    // notification message that are ready to be sent to the client
    self._pending_notifications = new Dequeue();

    self._sent_notifications = [];

    self._sequence_number_generator = new SequenceNumberGenerator();

    // initial state of the subscription
    self.state = SubscriptionState.CREATING;

    self.publishIntervalCount = 0;

    self.monitoredItems = {}; // monitored item map

    /**
     *  number of monitored Item
     *  @property monitoredItemIdCounter
     *  @type {Number}
     */
    self.monitoredItemIdCounter = 0;

    self.publishingEnabled = _adjust_publishinEnable(options.publishingEnabled);

    installSubscriptionDiagnostics(self);

    // A boolean value that is set to TRUE to mean that 
    //  either a NotificationMessage or a keep-alive Message has been
    //  sent on the Subscription. 
    // It is a flag that is used to ensure that either a NotificationMessage or a keep-alive
    // Message is sent out the first time the publishing timer expires.
    self.messageSent = false;

    self.timerId = null;
    self._start_timer();
  }

  toString() {
    const self = this;
    let str = "";
    str += `  publishingEnabled  ${self.publishingEnabled}\n`;
    str += `  maxKeepAliveCount  ${self.maxKeepAliveCount}\n`;
    str += `  publishingInterval ${self.publishingInterval}\n`;
    str += `  lifeTimeCount      ${self.lifeTimeCount}\n`;
    str += `  maxKeepAliveCount  ${self.maxKeepAliveCount}\n`;
    return str;
  }

  /**
   * @method modify
   * @param param {Object}
   * @param param.requestedPublishingInterval  {Duration}  
   *   requestedPublishingInterval =0 means fastest possible
   * @param param.requestedLifetimeCount       {Counter}   
   *   requestedLifetimeCount      ===0 means no change
   * @param param.requestedMaxKeepAliveCount   {Counter}   
   *   requestedMaxKeepAliveCount  ===0 means no change
   * @param param.maxNotificationsPerPublish   {Counter}
   * @param param.priority                     {Byte}
   *
   */
  modify(param) {
    const self = this;

    // update diagnostic counter
    self.subscriptionDiagnostics.modifyCount += 1;

    const publishingInterval_old = self.publishingInterval;

    param.requestedPublishingInterval = param.requestedPublishingInterval || 0;
    param.requestedMaxKeepAliveCount = param.requestedMaxKeepAliveCount || self.maxKeepAliveCount;
    param.requestedLifetimeCount = param.requestedLifetimeCount || self.lifeTimeCount;

    self.publishingInterval = _adjust_publishing_interval(param.requestedPublishingInterval);
    self.maxKeepAliveCount = _adjust_maxKeepAliveCount(param.requestedMaxKeepAliveCount);
    self.lifeTimeCount = _adjust_lifeTimeCount(param.requestedLifetimeCount, self.maxKeepAliveCount);

    self.maxNotificationsPerPublish = param.maxNotificationsPerPublish;
    self.priority = param.priority;

    self.resetLifeTimeAndKeepAliveCounters();

    if (publishingInterval_old !== self.publishingInterval) {
      // todo
    }
    self._stop_timer();
    self._start_timer();
  }

  _stop_timer() {
    const self = this;
    if (self.timerId) {
      debugLog("Subscription#_stop_timer subscriptionId=".bgWhite.blue, self.id);
      clearInterval(self.timerId);
      self.timerId = null;
      Subscription.registry.unregister(self);
    }
  }

  _start_timer() {
    const self = this;
    debugLog("Subscription#_start_timer  subscriptionId=".bgWhite.blue, self.id, " publishingInterval = ", self.publishingInterval);

    assert(self.timerId === null);
    // from the spec:
    // When a Subscription is created, the first Message is sent at the end of the first publishing cycle to
    // inform the Client that the Subscription is operational. A NotificationMessage is sent if there are
    // Notifications ready to be reported. If there are none, a keep-alive Message is sent instead that
    // contains a sequence number of 1, indicating that the first NotificationMessage has not yet been sent.
    // This is the only time a keep-alive Message is sent without waiting for the maximum keep-alive count
    // to be reached, as specified in (f) above.


    // make sure that a keep-alive Message will be send at the end of the first publishing cycle
    // if there are no Notifications ready.
    self._keep_alive_counter = self.maxKeepAliveCount;

    assert(self.publishingInterval >= minimumPublishingInterval);
    self.timerId = setInterval(self._tick.bind(self), self.publishingInterval);

    Subscription.registry.register(self);
  }

  // counter
  _get_next_sequence_number() {
    return this._sequence_number_generator.next();
  }

  // counter
  _get_future_sequence_number() {
    return this._sequence_number_generator.future();
  }

  setPublishingMode(publishingEnabled) {
    this.publishingEnabled = !!publishingEnabled;

    // update diagnostics

    if (this.publishingEnabled) {
      this.subscriptionDiagnostics.enableCount += 1;
    } else {
      this.subscriptionDiagnostics.disableCount += 1;
    }

    this.resetLifeTimeCounter();

    if (!publishingEnabled && this.state !== SubscriptionState.CLOSED) {
      this.state = SubscriptionState.NORMAL;
    }
    return StatusCodes.Good;
  }

  /**
   *  _publish_pending_notifications send a "notification" event:
   *
   * @method _publish_pending_notifications *
   * @private
   *
   */
  _publish_pending_notifications() {
    const self = this;
    const publishEngine = self.publishEngine;
    const subscriptionId = self.id;

    // preconditions
    assert(publishEngine.pendingPublishRequestCount > 0);
    assert(self.hasPendingNotifications);

    function _count_notification_message(notifData) {
      if (notifData instanceof DataChangeNotification) {
        self.subscriptionDiagnostics.dataChangeNotificationsCount += 1;
      } else if (notifData instanceof EventNotificationList) {
        self.subscriptionDiagnostics.eventNotificationsCount += 1;
      } else {
        // TODO
      }
    }

    // todo : get rid of this....
    self.emit("notification");

    const notificationMessage = self._popNotificationToSend().notification;

    self.emit("notificationMessage", notificationMessage);

    // update diagnostics
    self.subscriptionDiagnostics.notificationsCount += 1;

    assert(_.isArray(notificationMessage.notificationData));

    notificationMessage.notificationData.forEach(_count_notification_message);


    assert(notificationMessage.hasOwnProperty("sequenceNumber"));
    assert(notificationMessage.hasOwnProperty("notificationData"));

    const moreNotifications = (self.hasPendingNotifications);

    self.subscriptionDiagnostics.publishRequestCount += 1;

    publishEngine.send_notification_message({
      subscriptionId,
      sequenceNumber: notificationMessage.sequenceNumber,
      notificationData: notificationMessage.notificationData,
      moreNotifications
    }, false);
    self.messageSent = true;
    self.resetLifeTimeAndKeepAliveCounters();

    if (doDebug) {
      debugLog("Subscription sending a notificationMessage subscriptionId=", subscriptionId, notificationMessage.toString());
    }

    if (self.state !== SubscriptionState.CLOSED) {
      assert(notificationMessage.notificationData.length > 0, "We are not expecting a keep-alive message here");
      self.state = SubscriptionState.NORMAL;
      debugLog(`subscription ${self.id}${" set to NORMAL".bgYellow}`);
    }
  }

  _process_keepAlive() {
    const self = this;

    // xx assert(!self.publishingEnabled || (!self.hasPendingNotifications && !self.hasMonitoredItemNotifications));

    self.increaseKeepAliveCounter();

    if (self.keepAliveCounterHasExpired) {
      if (self._sendKeepAliveResponse()) {
        self.resetLifeTimeAndKeepAliveCounters();
      } else {
        debugLog("     -> subscription.state === LATE , because keepAlive Response cannot be send due to lack of PublishRequest");
        self.state = SubscriptionState.LATE;
      }
    }
  }

  process_subscription() {
    const self = this;

    assert(self.publishEngine.pendingPublishRequestCount > 0);

    if (!self.publishingEnabled) {
      // no publish to do, except keep alive
      self._process_keepAlive();
      return;
    }

    if (!self.hasPendingNotifications && self.hasMonitoredItemNotifications) {
      // collect notification from monitored items
      self._harvestMonitoredItems();
    }

    // let process them first
    if (self.hasPendingNotifications) {
      self._publish_pending_notifications();

      if (self.state === SubscriptionState.NORMAL && self.hasPendingNotifications) {
        // istanbul ignore next
        if (doDebug) {
          debugLog("    -> pendingPublishRequestCount > 0 && normal state => re-trigger tick event immediately ");
        }

        // let process an new publish request
        setImmediate(self._tick.bind(self));
      }
    } else {
      self._process_keepAlive();
    }
  }

  /**
   * @method _tick
   * @private
   */
  _tick() {
    const self = this;

    self.discardOldSentNotifications();

    // istanbul ignore next
    if (doDebug) {
      debugLog("   Subscription#_tick  processing subscriptionId=", self.id, "hasMonitoredItemNotifications = ", self.hasMonitoredItemNotifications, " publishingIntervalCount =", self.publishIntervalCount);
    }
    if (self.publishEngine._on_tick) {
      self.publishEngine._on_tick();
    }

    self.publishIntervalCount += 1;

    self.increaseLifeTimeCounter();

    if (self.lifeTimeHasExpired) {
      /* istanbul ignore next */
      if (doDebug) {
        debugLog(`Subscription ${self.id}${" has expired !!!!! => Terminating".red.bold}`);
      }
      /**
       * notify the subscription owner that the subscription has expired by exceeding its life time.
       * @event expired
       *
       */
      self.emit("expired");

      // notify new terminated status only when subscription has timeout.
      debugLog("adding StatusChangeNotification notification message for BadTimeout subscription = ", self.id);
      self._addNotificationMessage([new StatusChangeNotification({ statusCode: StatusCodes.BadTimeout })]);

      // kill timer and delete monitored items
      self.terminate();

      return;
    }

    const publishEngine = self.publishEngine;

    // istanbul ignore next
    if (doDebug) { debugLog("Subscription#_tick  self._pending_notifications= ", self._pending_notifications.length); }

    if (publishEngine.pendingPublishRequestCount === 0 && (self.hasPendingNotifications || self.hasMonitoredItemNotifications)) {
      // istanbul ignore next
      if (doDebug) {
        debugLog("subscription set to LATE  hasPendingNotifications = ", self.hasPendingNotifications, " hasMonitoredItemNotifications =", self.hasMonitoredItemNotifications);
      }
      self.state = SubscriptionState.LATE;
      return;
    }

    if (publishEngine.pendingPublishRequestCount > 0) {
      if (self.hasPendingNotifications) {
        // simply pop pending notification and send it
        self.process_subscription();
      } else if (self.hasMonitoredItemNotifications) {
        self.process_subscription();
      } else {
        self._process_keepAlive();
      }
    } else {
      self._process_keepAlive();
    }
  }

  /**
   * @method _sendKeepAliveResponse
   * @private
   */
  _sendKeepAliveResponse() {
    const self = this;
    const future_sequence_number = self._get_future_sequence_number();

    debugLog("     -> Subscription#_sendKeepAliveResponse subscriptionId", self.id);

    if (self.publishEngine.send_keep_alive_response(self.id, future_sequence_number)) {
      self.messageSent = true;

      /**
       * notify the subscription owner that a keepalive message has to be sent.
       * @event keepalive
       *
       */
      self.emit("keepalive", future_sequence_number);
      self.state = SubscriptionState.KEEPALIVE;

      return true;
    }
    return false;
  }

  /**
   * @method resetKeepAliveCounter
   * @private
   * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
   * the CreateSubscription Service( 5.13.2).
   */
  resetKeepAliveCounter() {
    const self = this;
    self._keep_alive_counter = 0;

    // istanbul ignore next
    if (doDebug) {
      debugLog("     -> subscriptionId", self.id, " Resetting keepAliveCounter = ", self._keep_alive_counter, self.maxKeepAliveCount);
    }
  }

  /**
   * @method increaseKeepAliveCounter
   * @private
   */
  increaseKeepAliveCounter() {
    const self = this;
    self._keep_alive_counter += 1;

    // istanbul ignore next
    if (doDebug) {
      debugLog("     -> subscriptionId", self.id, " Increasing keepAliveCounter = ", self._keep_alive_counter, self.maxKeepAliveCount);
    }
  }

  /**
   * Reset the Lifetime Counter Variable to the value specified for the lifetime of a Subscription in
   * the CreateSubscription Service( 5.13.2).
   * @method resetLifeTimeCounter
   * @private
   */
  resetLifeTimeCounter() {
    const self = this;
    self._life_time_counter = 0;
  }

  /**
   * @method increaseLifeTimeCounter
   * @private
   */
  increaseLifeTimeCounter() {
    const self = this;
    self._life_time_counter += 1;
  }

  /**
   *
   *  the server invokes the resetLifeTimeAndKeepAliveCounters method of the subscription
   *  when the server  has send a Publish Response, so that the subscription
   *  can reset its life time counter.
   *
   * @method resetLifeTimeAndKeepAliveCounters
   *
   */
  resetLifeTimeAndKeepAliveCounters() {
    const self = this;
    self.resetLifeTimeCounter();
    self.resetKeepAliveCounter();
  }

  /**
   * Terminates the subscription.
   * @method terminate
   *
   * Calling this method will also remove any monitored items.
   *
   */
  terminate() {
    const self = this;

    if (self.state === SubscriptionState.CLOSED) {
      // todo verify if asserting is required here
      return;
    }
    assert(self.state !== SubscriptionState.CLOSED, "terminate already called ?");

    // stop timer
    self._stop_timer();

    debugLog("terminating Subscription  ", self.id, " with ", self.monitoredItemCount, " monitored items");

    // dispose all monitoredItem
    const keys = Object.keys(self.monitoredItems);

    keys.forEach((key) => {
      const status = self.removeMonitoredItem(key);
      assert(status === StatusCodes.Good);
    });

    assert(self.monitoredItemCount === 0);


    self.state = SubscriptionState.CLOSED;

    self.publishEngine.on_close_subscription(self);

    /**
     * notify the subscription owner that the subscription has been terminated.
     * @event "terminated"
     */
    self.emit("terminated");
  }

  /**
   * @method _addNotificationMessage
   * @param notificationData {Array<DataChangeNotification|EventNotificationList|StatusChangeNotification>}
   */
  _addNotificationMessage(notificationData) {
    assert(_.isArray(notificationData));
    assert(notificationData.length === 1 || notificationData.length === 2); // as per spec part 3.

    // istanbul ignore next
    if (doDebug) {
      debugLog("Subscription#_addNotificationMessage".yellow, notificationData.toString());
    }
    const self = this;
    assert(_.isObject(notificationData[0]));

    assert_validNotificationData(notificationData[0]);
    if (notificationData.length === 2) {
      assert_validNotificationData(notificationData[1]);
    }

    const notification_message = new NotificationMessage({
      sequenceNumber: self._get_next_sequence_number(),
      publishTime: new Date(),
      notificationData
    });

    self._pending_notifications.push({
      notification: notification_message,
      start_tick: self.publishIntervalCount,
      publishTime: new Date(),
      sequenceNumber: notification_message.sequenceNumber
    });
  }

  getMessageForSequenceNumber(sequenceNumber) {
    const self = this;

    function filter_func(e) {
      return e.sequenceNumber === sequenceNumber;
    }

    const notification_message = _.find(self._sent_notifications, filter_func);

    if (!notification_message) {
      return null;
    }
    return notification_message;
  }

  /**
   * Extract the next Notification that is ready to be sent to the client.
   * @method _popNotificationToSend
   * @return {NotificationMessage}  the Notification to send._pending_notifications
   */
  _popNotificationToSend() {
    const self = this;
    assert(self._pending_notifications.length > 0);
    const notification_message = self._pending_notifications.shift();
    self._sent_notifications.push(notification_message);
    return notification_message;
  }

  /**
   * returns true if the notification has expired
   * @method notificationHasExpired
   * @param notification
   * @return {boolean}
   */
  notificationHasExpired(notification) {
    const self = this;
    assert(notification.hasOwnProperty("start_tick"));
    assert(_.isFinite(notification.start_tick + self.maxKeepAliveCount));
    return (notification.start_tick + self.maxKeepAliveCount) < self.publishIntervalCount;
  }

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
  discardOldSentNotifications() {
    const self = this;
    // Sessions maintain a retransmission queue of sent NotificationMessages. NotificationMessages
    // are retained in this queue until they are acknowledged. The Session shall maintain a
    // retransmission queue size of at least two times the number of Publish requests per Session the
    // Server supports.  Clients are required to acknowledge NotificationMessages as they are received. In the
    // case of a retransmission queue overflow, the oldest sent NotificationMessage gets deleted. If a
    // Subscription is transferred to another Session, the queued NotificationMessages for this
    // Subscription are moved from the old to the new Session.
    if (maxNotificationMessagesInQueue <= self._sent_notifications.length) {
      self._sent_notifications.splice(self._sent_notifications.length - maxNotificationMessagesInQueue);
    }
    //
    // var arr = _.filter(self._sent_notifications,function(notification){
    //   return self.notificationHasExpired(notification);
    // });
    // var results = arr.map(function(notification){
    //    return self.acknowledgeNotification(notification.sequenceNumber);
    // });
    // xx return results;
  }

  /**
   *  returns in an array the sequence numbers of the notifications that haven't been
   *  acknowledged yet.
   *
   *  @method getAvailableSequenceNumbers
   *  @return {Integer[]}
   *
   */
  getAvailableSequenceNumbers() {
    const self = this;
    const availableSequenceNumbers = getSequenceNumbers(self._sent_notifications);
    return availableSequenceNumbers;
  }

  /**
   * @method acknowledgeNotification
   * @param sequenceNumber {Number}
   * @return {StatusCode}
   */
  acknowledgeNotification(sequenceNumber) {
    const self = this;

    let foundIndex = -1;
    _.find(self._sent_notifications, (e, index) => {
      if (e.sequenceNumber === sequenceNumber) {
        foundIndex = index;
      }
    });
    if (foundIndex === -1) {
      return StatusCodes.BadSequenceNumberUnknown;
    } 
    self._sent_notifications.splice(foundIndex, 1);
    return StatusCodes.Good;
  }

  /**
   * adjust monitored item sampling interval
   *  - an samplingInterval ===0 means that we use a event-base model ( no sampling)
   *  - otherwise the sampling is adjusted
   *
   * @method adjustSamplingInterval
   * @param samplingInterval
   * @param node
   * @return {number|*}
   * @private
   */
  adjustSamplingInterval(samplingInterval, node) {
    const self = this;

    if (samplingInterval < 0) {
      // - The value -1 indicates that the default sampling interval defined by the publishing
      //   interval of the Subscription is requested.
      // - Any negative number is interpreted as -1.
      samplingInterval = self.publishingInterval;
    } else if (samplingInterval === 0) {
      // OPCUA 1.0.3 Part 4 - 5.12.1.2
      // The value 0 indicates that the Server should use the fastest practical rate.

      // The fastest supported sampling interval may be equal to 0, which indicates
      // that the data item is exception-based rather than being sampled at some period.
      // An exception-based model means that the underlying system does not require sampling and reports data changes.

      const dataValueSamplingInterval = node.readAttribute(AttributeIds.MinimumSamplingInterval);

      // TODO if attributeId === AttributeIds.Value : sampling interval required here
      if (dataValueSamplingInterval.statusCode === StatusCodes.Good) {
        // node provides a Minimum sampling interval ...
        samplingInterval = dataValueSamplingInterval.value.value;
        assert(samplingInterval >= 0 && samplingInterval <= MonitoredItem.maximumSamplingInterval);

        // note : at this stage, a samplingInterval===0 means that the data item is really exception-based
      }
    } else if (samplingInterval < MonitoredItem.minimumSamplingInterval) {
      samplingInterval = MonitoredItem.minimumSamplingInterval;
    } else if (samplingInterval > MonitoredItem.maximumSamplingInterval) {
      // If the requested samplingInterval is higher than the
      // maximum sampling interval supported by the Server, the maximum sampling
      // interval is returned.
      samplingInterval = MonitoredItem.maximumSamplingInterval;
    }

    const node_minimumSamplingInterval = (node && node.minimumSamplingInterval) ? node.minimumSamplingInterval : 0;
    samplingInterval = Math.max(samplingInterval, node_minimumSamplingInterval);

    return samplingInterval;
  }

  createMonitoredItem(addressSpace, timestampsToReturn, monitoredItemCreateRequest) {
    const self = this;
    assert(addressSpace.constructor.name === "AddressSpace");
    assert(monitoredItemCreateRequest instanceof MonitoredItemCreateRequest);


    function handle_error(statusCode) {
      return new subscription_service.MonitoredItemCreateResult({ statusCode });
    }

    const itemToMonitor = monitoredItemCreateRequest.itemToMonitor;

    const node = addressSpace.findNode(itemToMonitor.nodeId);
    if (!node) {
      return handle_error(StatusCodes.BadNodeIdUnknown);
    }


    if (itemToMonitor.attributeId === AttributeIds.Value && !(node instanceof UAVariable)) {
      // AttributeIds.Value is only valid for monitoring value of UAVariables.
      return handle_error(StatusCodes.BadAttributeIdInvalid);
    }


    if (itemToMonitor.attributeId === AttributeIds.INVALID) {
      return handle_error(StatusCodes.BadAttributeIdInvalid);
    }

    if (!itemToMonitor.indexRange.isValid()) {
      return handle_error(StatusCodes.BadIndexRangeInvalid);
    }

    // check dataEncoding applies only on Values
    if (itemToMonitor.dataEncoding.name && itemToMonitor.attributeId !== AttributeIds.Value) {
      return handle_error(StatusCodes.BadDataEncodingInvalid);
    }

    // check dataEncoding
    if (!is_valid_dataEncoding(itemToMonitor.dataEncoding)) {
      return handle_error(StatusCodes.BadDataEncodingUnsupported);
    }


    // filter
    const requestedParameters = monitoredItemCreateRequest.requestedParameters;
    const filter = requestedParameters.filter;
    const statusCodeFilter = validateFilter(filter, itemToMonitor, node);
    if (statusCodeFilter !== StatusCodes.Good) {
      return handle_error(statusCodeFilter);
    }
    // xx var monitoringMode      = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
    // xx var requestedParameters = monitoredItemCreateRequest.requestedParameters;

    const monitoredItemCreateResult = self._createMonitoredItemStep2(timestampsToReturn, monitoredItemCreateRequest, node);

    assert(monitoredItemCreateResult.statusCode === StatusCodes.Good);

    const monitoredItem = self.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);
    assert(monitoredItem);

    // TODO: fix old way to set node. !!!!
    monitoredItem.setNode(node);

    self.emit("monitoredItem", monitoredItem, itemToMonitor);

    self._createMonitoredItemStep3(monitoredItem, monitoredItemCreateRequest);

    return monitoredItemCreateResult;
  }

  /**
   *
   * @method _createMonitoredItemStep2
   * @param timestampsToReturn
   * @param {MonitoredItemCreateRequest} monitoredItemCreateRequest - the parameters describing the monitored Item to create
   * @param node {BaseNode}
   * @return {subscription_service.MonitoredItemCreateResult}
   * @private
   */
  _createMonitoredItemStep2(timestampsToReturn, monitoredItemCreateRequest, node) {
    const self = this;

    // note : most of the parameter inconsistencies shall have been handled by the caller
    // any error here will raise an assert here

    assert(monitoredItemCreateRequest instanceof MonitoredItemCreateRequest);
    const itemToMonitor = monitoredItemCreateRequest.itemToMonitor;

    // xx check if attribute Id invalid (we only support Value or EventNotifier )
    // xx assert(itemToMonitor.attributeId !== AttributeIds.INVALID);

    self.monitoredItemIdCounter += 1;


    const monitoredItemId = getNextMonitoredItemId();

    const requestedParameters = monitoredItemCreateRequest.requestedParameters;

    // adjust requestedParameters.samplingInterval
    requestedParameters.samplingInterval = self.adjustSamplingInterval(requestedParameters.samplingInterval, node);

    // reincorporate monitoredItemId and itemToMonitor into the requestedParameters
    requestedParameters.monitoredItemId = monitoredItemId;
    requestedParameters.itemToMonitor = itemToMonitor;


    const monitoredItem = new MonitoredItem(requestedParameters);
    monitoredItem.timestampsToReturn = timestampsToReturn;

    assert(monitoredItem.monitoredItemId === monitoredItemId);
    self.monitoredItems[monitoredItemId] = monitoredItem;

    const filterResult = _process_filter(node, requestedParameters.filter);


    const monitoredItemCreateResult = new subscription_service.MonitoredItemCreateResult({
      statusCode: StatusCodes.Good,
      monitoredItemId,
      revisedSamplingInterval: monitoredItem.samplingInterval,
      revisedQueueSize: monitoredItem.queueSize,
      filterResult
    });
    return monitoredItemCreateResult;
  }

  _createMonitoredItemStep3(monitoredItem, monitoredItemCreateRequest) {
    assert(monitoredItem.monitoringMode === MonitoringMode.Invalid);
    assert(_.isFunction(monitoredItem.samplingFunc));
    const monitoringMode = monitoredItemCreateRequest.monitoringMode; // Disabled, Sampling, Reporting
    monitoredItem.setMonitoringMode(monitoringMode);
  }

  /**
   * get a monitoredItem by Id.
   * @method getMonitoredItem
   * @param monitoredItemId  {Number} the id of the monitored item to get.
   * @return {MonitoredItem}
   */
  getMonitoredItem(monitoredItemId) {
    assert(_.isFinite(monitoredItemId));
    const self = this;
    return self.monitoredItems[monitoredItemId];
  }

  /**
   * getMonitoredItems is used to get information about monitored items of a subscription.Its intended
   * use is defined in Part 4. This method is the implementation of the Standard OPCUA GetMonitoredItems Method.
   * @method getMonitoredItems
   * @param  result.serverHandles {Int32[]} Array of serverHandles for all MonitoredItems of the subscription identified by subscriptionId.
   *         result.clientHandles {Int32[]} Array of clientHandles for all MonitoredItems of the subscription identified by subscriptionId.
   *         result.statusCode    {StatusCode}
   * from spec:
   * This method can be used to get the  list of monitored items in a subscription if CreateMonitoredItems failed due to
   * a network interruption and the client does not know if the creation succeeded in the server.
   *
   */
  getMonitoredItems(/* out*/ result) {
    result = result || {};
    const subscription = this;
    result.serverHandles = [];
    result.clientHandles = [];
    result.statusCode = StatusCodes.Good;

    Object.keys(subscription.monitoredItems).forEach((monitoredItemId) => {
      const monitoredItem = subscription.getMonitoredItem(monitoredItemId);

      result.clientHandles.push(monitoredItem.clientHandle);
      // TODO:  serverHandle is defined anywhere in the OPCUA Specification 1.02
      //        I am not sure what shall be reported for serverHandle...
      //        using monitoredItem.monitoredItemId instead...
      //        May be a clarification in the OPCUA Spec is required.
      result.serverHandles.push(monitoredItemId);
    });
    return result;
  }

  resendInitialValues() {
    const subscription = this;
    _.forEach(subscription.monitoredItems, (monitoredItem, monitoredItemId) => {
      monitoredItem.resendInitialValues();
    });
  }

  /**
   * remove a monitored Item from the subscription.
   * @method removeMonitoredItem
   * @param monitoredItemId  {Number} the id of the monitored item to get.
   */
  removeMonitoredItem(monitoredItemId) {
    debugLog("Removing monitoredIem ", monitoredItemId);

    assert(_.isFinite(monitoredItemId));
    const self = this;
    if (!self.monitoredItems.hasOwnProperty(monitoredItemId)) {
      return StatusCodes.BadMonitoredItemIdInvalid;
    }

    const monitoredItem = self.monitoredItems[monitoredItemId];

    monitoredItem.terminate();

    /**
     *
     * notify that a monitored item has been removed from the subscription
     * @event removeMonitoredItem
     * @param monitoredItem {MonitoredItem}
     */
    self.emit("removeMonitoredItem", monitoredItem);

    delete self.monitoredItems[monitoredItemId];

    return StatusCodes.Good;
  }

  // collect DataChangeNotification
  _collectNotificationData() {
    const self = this;

    // reset cache ...
    self._hasMonitoredItemNotifications = false;

    const all_notifications = new Dequeue();

    // visit all monitored items
    const keys = Object.keys(self.monitoredItems);
    let i;
    let key;
    const n = keys.length;
    for (i = 0; i < n; i++) {
      key = keys[i];
      const monitoredItem = self.monitoredItems[key];
      var notifications = monitoredItem.extractMonitoredItemNotifications();
      add_all_in(notifications, all_notifications);
    }

    const notificationsMessage = [];

    while (all_notifications.length > 0) {
      // split into one or multiple dataChangeNotification with no more than
      //  self.maxNotificationsPerPublish monitoredItems
      const notifications_chunk = extract_notifications_chunk(all_notifications, self.maxNotificationsPerPublish);

      // separate data for DataChangeNotification (MonitoredItemNotification) from data for EventNotificationList(EventFieldList)
      const dataChangedNotificationData = notifications_chunk.filter(filter_instanceof.bind(null, subscription_service.MonitoredItemNotification));
      const eventNotificationListData = notifications_chunk.filter(filter_instanceof.bind(null, subscription_service.EventFieldList));

      assert(notifications_chunk.length === dataChangedNotificationData.length + eventNotificationListData.length);

      var notifications = [];

      // add dataChangeNotification
      if (dataChangedNotificationData.length) {
        const dataChangeNotification = new DataChangeNotification({
          monitoredItems: dataChangedNotificationData,
          diagnosticInfos: []
        });
        notifications.push(dataChangeNotification);
      }

      // add dataChangeNotification
      if (eventNotificationListData.length) {
        const eventNotificationList = new EventNotificationList({
          events: eventNotificationListData
        });

        notifications.push(eventNotificationList);
      }

      assert(notifications.length === 1 || notifications.length === 2);
      notificationsMessage.push(notifications);
    }

    assert(notificationsMessage instanceof Array);
    return notificationsMessage;
  }

  _harvestMonitoredItems() {
    const self = this;

    // Only collect data change notification for the time being
    const notificationData = self._collectNotificationData();
    assert(notificationData instanceof Array);

    // istanbul ignore next
    if (doDebug) {
      debugLog("Subscription#_harvestMonitoredItems =>", notificationData.length);
    }
    notificationData.forEach((notificationMessage) => {
      self._addNotificationMessage(notificationMessage);
    });
    self._hasMonitoredItemNotifications = false;
  }

  notifyTransfer() {
    // OPCUA UA Spec 1.0.3 : part 3 - page 82 - 5.13.7 TransferSubscriptions:
    // If the Server transfers the Subscription to the new Session, the Server shall issue a StatusChangeNotification
    // notificationMessage with the status code Good_SubscriptionTransferred to the old Session.
    const self = this;

    console.log(" Subscription => Notifying Transfer                                  ".bgWhite.red);

    const notificationData = [new StatusChangeNotification({ statusCode: StatusCodes.GoodSubscriptionTransferred })];

    self.publishEngine.send_notification_message({
      subscriptionId: self.id,
      sequenceNumber: self._get_next_sequence_number(),
      notificationData,
      moreNotifications: false
    }, true);
  }
  /**
   * @property keepAliveCounterHasExpired
   * @private
   * @type {Boolean} true if the keep alive counter has reach its limit.
   */
  get keepAliveCounterHasExpired() {
    const self = this;
    return self._keep_alive_counter >= self.maxKeepAliveCount;
  }


  /**
   *  True if the subscription life time has expired.
   *
   * @property lifeTimeHasExpired
   * @type {boolean} - true if the subscription life time has expired.
   */
  get lifeTimeHasExpired() {
    const self = this;
    assert(self.lifeTimeCount > 0);
    return self._life_time_counter >= self.lifeTimeCount;
  }

  /**
   * number of milliseconds before this subscription times out (lifeTimeHasExpired === true);
   * @property timeToExpiration
   * @type {Number}
   */
  get timeToExpiration() {
    const self = this;
    return (self.lifeTimeCount - self._life_time_counter) * self.publishingInterval;
  }

  get timeToKeepAlive() {
    const self = this;
    return (self.maxKeepAliveCount - self._keep_alive_counter) * self.publishingInterval;
  }
  /**
   *
   * @property pendingNotificationsCount  - number of pending notifications
   * @type {Number}
   */
  get pendingNotificationsCount() {
    return this._pending_notifications.length;
  }

  /**
   * return True is there are pending notifications for this subscription. (i.e moreNotifications)
   *
   * @property hasPendingNotifications
   * @type {Boolean}
   */
  get hasPendingNotifications() {
    const self = this;
    return self.pendingNotificationsCount > 0;
  }

  /**
   * number of sent notifications
   * @property sentNotificationsCount
   * @type {Number}
   */
  get sentNotificationsCount() {
    return this._sent_notifications.length;
  }

  /**
   * number of monitored items.
   * @property monitoredItemCount
   * @type {Number}
   */
  get monitoredItemCount() {
    return Object.keys(this.monitoredItems).length;
  }

  /**
   * number of disabled monitored items.
   * @property disabledMonitoredItemCount
   * @type {Number}
   */
  get disabledMonitoredItemCount() {
    return _.reduce(
      _.values(this.monitoredItems),
      (cumul, monitoredItem) => cumul + ((monitoredItem.monitoringMode === MonitoringMode.Disabled)
        ? 1
        : 0
      ), 0);
  }

  /**
   * The number of unacknowledged messages saved in the republish queue.
   * @property unacknowledgedMessageCount
   * @type {Number}
   */
  get unacknowledgedMessageCount() {
    return 0;
  }
  /**
 * @property hasMonitoredItemNotifications true if monitored Item have uncollected Notifications
 * @type {Boolean}
 */
  get hasMonitoredItemNotifications() {
    const self = this;
    if (self._hasMonitoredItemNotifications) {
      return true;
    }
    const keys = Object.keys(self.monitoredItems);
    let i;
    let key;
    const n = keys.length;
    for (i = 0; i < n; i++) {
      key = keys[i];
      const monitoredItem = self.monitoredItems[key];
      if (monitoredItem.hasMonitoredItemNotifications) {
        self._hasMonitoredItemNotifications = true;
        return true;
      }
    }
    return false;
  }
  get subscriptionId() { 
    return this.id; 
  }
}

Subscription.registry = new ObjectRegistry();


function assert_validNotificationData(n) {
  assert(
    n instanceof DataChangeNotification ||
    n instanceof EventNotificationList ||
    n instanceof StatusChangeNotification
  );
}

const maxNotificationMessagesInQueue = 100;

function getSequenceNumbers(arr) {
  return arr.map(e => e.notification.sequenceNumber);
}


function analyseEventFilterResult(node, eventFilter) {
  assert(eventFilter instanceof subscription_service.EventFilter);

  const selectClauseResults = checkSelectClauses(node, eventFilter.selectClauses);

  const whereClauseResult = new subscription_service.ContentFilterResult();

  return new subscription_service.EventFilterResult({
    selectClauseResults,
    selectClauseDiagnosticInfos: [],
    whereClauseResult
  });
}
function analyseDataChangeFilterResult(node, dataChangeFilter) {
  assert(dataChangeFilter instanceof subscription_service.DataChangeFilter);
  // the opcua specification doesn't provide dataChangeFilterResult
  return null;
}
function analyseAggregateFilterResult(node, aggregateFilter) {
  assert(aggregateFilter instanceof subscription_service.AggregateFilter);
  return new subscription_service.AggregateFilterResult({});
}
function _process_filter(node, filter) {
  if (!filter) {
    return null;
  }

  if (filter instanceof subscription_service.EventFilter) {
    return analyseEventFilterResult(node, filter);
  } else if (filter instanceof subscription_service.DataChangeFilter) {
    return analyseDataChangeFilterResult(node, filter);
  } else if (filter instanceof subscription_service.AggregateFilter) {
    return analyseAggregateFilterResult(node, filter);
  }
  // istanbul ignore next
  throw new Error("invalid filter");
}

let g_monitoredItemId = 1;
function getNextMonitoredItemId() {
  return g_monitoredItemId++;
}

let MonitoringMode = subscription_service.MonitoringMode;

MonitoredItem.prototype.resendInitialValues = function () {
  // te first Publish response(s) after the TransferSubscriptions call shall contain the current values of all
  // Monitored Items in the Subscription where the Monitoring Mode is set to Reporting.
  // the first Publish response after the TransferSubscriptions call shall contain only the value changes since
  // the last Publish response was sent.
  // This parameter only applies to MonitoredItems used for monitoring Attribute changes.
  const self = this;
  self._stop_sampling();
  self._start_sampling(true);
};

let DataChangeNotification = subscription_service.DataChangeNotification;
let EventNotificationList = subscription_service.EventNotificationList;


/**
 * extract up to maxNotificationsPerPublish notifications
 * @param monitoredItems
 * @param maxNotificationsPerPublish
 * @return {Array}
 */
function extract_notifications_chunk(monitoredItems, maxNotificationsPerPublish) {
  let n = maxNotificationsPerPublish === 0 ?
    monitoredItems.length :
    Math.min(monitoredItems.length, maxNotificationsPerPublish);

  const chunk_monitoredItems = [];
  while (n) {
    chunk_monitoredItems.push(monitoredItems.shift());
    n--;
  }
  return chunk_monitoredItems;
}

function add_all_in(notifications, all_notifications) {
  for (let i = 0; i < notifications.length; i++) {
    const n = notifications[i];
    all_notifications.push(n);
  }
}

function filter_instanceof(Class, e) {
  return (e instanceof Class);
}


export { Subscription };
