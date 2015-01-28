require("requirish")._(module);

var sinon = require("sinon");
var _ = require("underscore");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var should = require("should");


var WatchDog = require("lib/misc/watchdog").WatchDog;

function MyObject() {
}
util.inherits(MyObject, EventEmitter);


MyObject.prototype.watchdogReset = function() {
    this.emit("watchdogReset");
};


// http://sinonjs.org/docs/#clock
describe("watch dog", function () {

    this.timeout(10000);
    var watchDog = null;
    before(function () {
        this.clock = sinon.useFakeTimers();
        watchDog = new WatchDog();
    });

    after(function () {

        watchDog.shutdown();
        this.clock.restore();

    });
    it("should fail if the object subscribing to the WatchDog doesn't provide a 'watchdogReset' method", function (done) {

        should(function(){
            watchDog.addSubscriber({},100);
        }).throwError();
        done();
    });

    it("the subscribing object should have a 'keepAlive' method installed by the WatchDog ", function (done) {

        var obj = new MyObject();
        should(_.isFunction(obj.keepAlive)).eql(false);

        watchDog.addSubscriber(obj,100);
        should(_.isFunction(obj.keepAlive)).eql(true);

        watchDog.removeSubscriber(obj);
        should(_.isFunction(obj.keepAlive)).eql(false);

        done();

    });

    it("should call the watchdogReset method of a subscriber when timeout has expired", function (done) {

        var obj = new MyObject();
        watchDog.addSubscriber(obj,100);

        setTimeout(function(){obj.keepAlive();},200);

        obj.on("watchdogReset",done);

        this.clock.tick(2000);
    });

    it("The WatchDog should visit subscribers on a regular basis", function (done) {

        var obj1 = new MyObject();
        var obj2 = new MyObject();

        watchDog.addSubscriber(obj1,1000);
        watchDog.addSubscriber(obj2,1000);

        var timer1 = setInterval(function(){obj1.keepAlive();},200);
        var timer2 = setInterval(function(){obj2.keepAlive();},200);

        // Since our objects are sending a keepAlive signal on a very regular basic,
        // we should make sure object do not received a watchdogReset call by the WatchDog
        obj1.on("watchdogReset",function(){ done(new Error("Received unexpected watchdogReset on object1"))});
        obj2.on("watchdogReset",function(){ done(new Error("Received unexpected watchdogReset on object2"))});

        setTimeout(function() {

            obj1._watchDogData.visitCount.should.greaterThan(8);
            obj2._watchDogData.visitCount.should.greaterThan(8);

            watchDog.removeSubscriber(obj1);
            watchDog.removeSubscriber(obj2);

            clearInterval(timer1);
            clearInterval(timer2);
        }, 10000);

        setTimeout(done,15000);
        this.clock.tick(20000);
    });





});