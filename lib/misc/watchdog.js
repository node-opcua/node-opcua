var _ = require("underscore");
var util = require("util");
var EventEmitter = require("events").EventEmitter;
var assert = require("assert");

function WatchDog() {
    this._subscriber = {};
    this._counter = 0;
    this._current_time = new Date();
    this._visit_subscriber_b = this._visit_subscriber.bind(this);
    this._timer = setInterval(this._visit_subscriber_b,1000);
}
util.inherits(WatchDog, EventEmitter);

function has_expired(watchDogData,currentTime) {
    var elapsed_time = currentTime - watchDogData.last_seen;
    return elapsed_time >watchDogData.timeout;
}

WatchDog.prototype._visit_subscriber = function() {

    var self = this;
    self._current_time = new Date();

    var expired_subscribers = _.filter(self._subscriber,function(watchDogData){
        watchDogData.visitCount +=1;
        return has_expired(watchDogData,self._current_time);
    });

    //xx console.log("_visit_subscriber", _.map(expired_subscribers, _.property("key")));
    if (expired_subscribers.length) {
        self.emit("")
    }
    expired_subscribers.forEach(function(subscriber){
        self.removeSubscriber(subscriber.subscriber);
        subscriber.subscriber.watchdogReset();
    });
};

function keepAliveFunc() {

    assert(this._watchDog instanceof WatchDog);
    assert(_.isNumber(this._watchDogData.key));
    this._watchDogData.last_seen = this._watchDog._current_time;
}

WatchDog.prototype.addSubscriber = function (subscriber, timeout) {

    assert(_.isFunction(subscriber.watchdogReset));
    assert(!_.isFunction(subscriber.keepAlive));

    this._counter +=1;
    var key = this._counter;

    subscriber._watchDog     = this;

    subscriber._watchDogData =  {
        key: key,
        subscriber: subscriber,
        timeout: timeout ,
        last_seen: new Date(),
        visitCount: 0
    };

    this._subscriber[key] = subscriber._watchDogData;

    subscriber.keepAlive = keepAliveFunc.bind(subscriber);

    return key;

};

WatchDog.prototype.removeSubscriber = function(subscriber) {

    assert(subscriber._watchDog instanceof WatchDog);
    assert(_.isNumber(subscriber._watchDogData.key));
    assert(_.isFunction(subscriber.keepAlive));
    assert(this._subscriber.hasOwnProperty(subscriber._watchDogData.key));

    delete this._subscriber[subscriber._watchDogData.key];
    delete subscriber._watchDog;
    delete subscriber._watchDogData;
    delete subscriber.keepAlive;

};


WatchDog.prototype.shutdown = function() {
    assert( this._timer != null, "shutdown already called ?");
    assert(Object.keys(this._subscriber).length === 0," leaking subscriber in watchdog");
    clearTimeout(this._timer );
    this._timer = null;
};

exports.WatchDog = WatchDog;