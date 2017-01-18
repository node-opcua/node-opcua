import _ from "underscore";
import util from "util";
import {EventEmitter} from "events";
import assert from "better-assert";

class WatchDog extends EventEmitter {
  constructor() {
    super()
    this._subscriber = {};
    this._counter = 0;
    this._current_time = new Date();
    this._visit_subscriber_b = this._visit_subscriber.bind(this);
    this._timer = null;
  }

  _visit_subscriber() {
    const self = this;
    self._current_time = new Date();

    const expired_subscribers = _.filter(self._subscriber, (watchDogData) => {
      watchDogData.visitCount += 1;
      return has_expired(watchDogData, self._current_time);
    });

      // xx console.log("_visit_subscriber", _.map(expired_subscribers, _.property("key")));
    if (expired_subscribers.length) {
      self.emit("timeout", expired_subscribers);
    }
    expired_subscribers.forEach((subscriber) => {
      self.removeSubscriber(subscriber.subscriber);
      subscriber.subscriber.watchdogReset();
    });
    self._current_time = new Date();
  }

  /**
   * add a subscriber to the WatchDog.
   * @method addSubscriber
   *
   * add a subscriber to the WatchDog.
   *
   * This method modifies the subscriber be adding a
   * new method to it called 'keepAlive'
   * The subscriber must also provide a "watchdogReset". watchdogReset will be called
   * if the subscriber failed to call keepAlive withing the timeout period.
   * @param subscriber
   * @param timeout
   * @return {number}
   */
  addSubscriber(subscriber, timeout) {
    const self = this;

    self._current_time = new Date();

    timeout = timeout || 1000;
    assert(_.isNumber(timeout), " invalid timeout ");
    assert(_.isFunction(subscriber.watchdogReset), " the subscriber must provide a watchdogReset method ");
    assert(!_.isFunction(subscriber.keepAlive));

    self._counter += 1;
    const key = self._counter;

    subscriber._watchDog = self;

    subscriber._watchDogData = {
      key,
      subscriber,
      timeout,
      last_seen: self._current_time,
      visitCount: 0
    };

    self._subscriber[key] = subscriber._watchDogData;

    subscriber.keepAlive = keepAliveFunc.bind(subscriber);

      // start timer when the first subscriber comes in
    if (self.subscriberCount === 1) {
      assert(self._timer === null);
      _start_timer.call(self);
    }

    return key;
  }

  removeSubscriber(subscriber) {
    if (!subscriber._watchDog) {
      return; // already removed !!!
    }
    assert(subscriber._watchDog instanceof WatchDog);
    assert(_.isNumber(subscriber._watchDogData.key));
    assert(_.isFunction(subscriber.keepAlive));
    assert(this._subscriber.hasOwnProperty(subscriber._watchDogData.key));

    delete this._subscriber[subscriber._watchDogData.key];
    delete subscriber._watchDog;
    delete subscriber._watchDogData;
    delete subscriber.keepAlive;

      // delete timer when the last subscriber comes out
      // xx console.log("xxxx WatchDog.prototype.removeSubscriber ",this.subscriberCount );
    if (this.subscriberCount === 0) {
      _stop_timer.call(this);
    }
  }

  shutdown() {
    assert(this._timer === null && Object.keys(this._subscriber).length === 0, " leaking subscriber in watchdog");
  }
}

/**
 * returns the number of subscribers using the WatchDog object.
 * @property subscriberCount
 * @type {Number}
 */
WatchDog.prototype.__defineGetter__("subscriberCount", function () {
  return Object.keys(this._subscriber).length;
});

function has_expired(watchDogData, currentTime) {
  const elapsed_time = currentTime - watchDogData.last_seen;
  return elapsed_time > watchDogData.timeout;
}

function _start_timer() {
  assert(this._timer === null, "start timer  called ?");
  this._timer = setInterval(this._visit_subscriber_b, 1000);
}
function _stop_timer() {
  assert(this._timer !== null, "_stop_timer already called ?");
  clearInterval(this._timer);
  this._timer = null;
}

function keepAliveFunc() {
  const self = this;

  assert(self._watchDog instanceof WatchDog);
  assert(_.isNumber(self._watchDogData.key));
  self._watchDogData.last_seen = new Date();
}

export {WatchDog};
