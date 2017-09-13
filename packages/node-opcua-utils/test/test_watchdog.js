
"use strict";

var sinon = require("sinon");
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var should = require("should");


var WatchDog = require("../src/watchdog").WatchDog;

function MyObject() {
}
util.inherits(MyObject, EventEmitter);


MyObject.prototype.watchdogReset = function () {
    this.emit("watchdogReset");
};


//xx var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
// http://sinonjs.org/docs/#clock
describe("watch dog", function () {


    this.timeout(10000);
    var watchDog = null;
    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
        watchDog = new WatchDog();
    });

    afterEach(function () {

        watchDog.shutdown();
        this.clock.restore();

    });

    it("should maintain a subscriber count", function () {

        watchDog.subscriberCount.should.eql(0);

        var obj1 = new MyObject();
        watchDog.addSubscriber(obj1, 1000);

        watchDog.subscriberCount.should.eql(1);

        watchDog.removeSubscriber(obj1);
        watchDog.subscriberCount.should.eql(0);

    });

    it("should not have a timer running if no subscriber", function () {

        watchDog.subscriberCount.should.eql(0);
        should(watchDog._timer).equal(null);
    });

    it("should have the internal timer running after the first subscriber has registered", function () {

        should(watchDog._timer).equal(null);

        var obj1 = new MyObject();
        watchDog.addSubscriber(obj1, 1000);

        should.exist(watchDog._timer);

        watchDog.removeSubscriber(obj1);
    });

    it("should stop the internal timer running after the last subscriber has unregistered", function () {

        should(watchDog._timer).equal(null);

        var obj1 = new MyObject();
        watchDog.addSubscriber(obj1, 1000);
        watchDog.removeSubscriber(obj1);

        watchDog.addSubscriber(obj1, 1000);
        watchDog.removeSubscriber(obj1);

        should.not.exist(watchDog._timer);
    });

    it("should fail if the object subscribing to the WatchDog doesn't provide a 'watchdogReset' method", function (done) {

        should(function () {
            watchDog.addSubscriber({}, 100);
        }).throwError();
        done();
    });

    it("should install a 'keepAlive' method on  the subscribing object during addSubscriber and remove it during removeSubscriber", function (done) {

        var obj = new MyObject();
        should(_.isFunction(obj.keepAlive)).eql(false);

        watchDog.addSubscriber(obj, 100);
        should(_.isFunction(obj.keepAlive)).eql(true);

        watchDog.removeSubscriber(obj);
        should(_.isFunction(obj.keepAlive)).eql(false);

        done();

    });

    it("should call the watchdogReset method of a subscriber when timeout has expired", function (done) {

        var obj = new MyObject();
        watchDog.addSubscriber(obj, 100);

        setTimeout(function () {
            obj.keepAlive();
        }, 200);

        obj.on("watchdogReset", done);

        this.clock.tick(2000);
    });

    it("should visit subscribers on a regular basis", function (done) {

        var obj1 = new MyObject();
        var obj2 = new MyObject();

        watchDog.addSubscriber(obj1, 1000);
        watchDog.addSubscriber(obj2, 1000);

        var timer1 = setInterval(function () {
            obj1.keepAlive();
        }, 200);
        var timer2 = setInterval(function () {
            obj2.keepAlive();
        }, 200);

        // Since our objects are sending a keepAlive signal on a very regular basic,
        // we should make sure object do not received a watchdogReset call by the WatchDog
        obj1.on("watchdogReset", function () {
            done(new Error("Received unexpected watchdogReset on object1"));
        });
        obj2.on("watchdogReset", function () {
            done(new Error("Received unexpected watchdogReset on object2"));
        });

        setTimeout(function () {

            obj1._watchDogData.visitCount.should.greaterThan(8);
            obj2._watchDogData.visitCount.should.greaterThan(8);

            watchDog.removeSubscriber(obj1);
            watchDog.removeSubscriber(obj2);

            clearInterval(timer1);
            clearInterval(timer2);
        }, 10000);

        setTimeout(done, 15000);
        this.clock.tick(20000);
    });
    it("should emit an event when it finds that some subscriber has reached the timeout period without sending a keepAlive signal", function (done) {

        var obj1 = new MyObject();
        watchDog.addSubscriber(obj1, 1000);

        watchDog.on("timeout", function (subscribers) {
            subscribers.length.should.eql(1);
            done();
        });
        this.clock.tick(20000);

    });

});
