"use strict";

const EventEmitter = require("events").EventEmitter;
const util = require("util");
const should = require("should");
const sinon = require("sinon");

const WatchDog = require("..").WatchDog;

class MyObject extends EventEmitter {
    watchdogReset() {
        this.emit("watchdogReset");
    }
}

//xx var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
// http://sinonjs.org/docs/#clock
describe("watch dog", function () {
    this.timeout(10000);
    let watchDog = null;
    beforeEach(() => {
        this.clock = sinon.useFakeTimers();
        watchDog = new WatchDog();

        if (false) {
            // let's verify that process.hrtime is also affected by sinon.useFakeTimers();
            should.exist(watchDog.getCurrentSystemTick);
            const old_getCurrentSystemTick = watchDog.getCurrentSystemTick;
            watchDog.getCurrentSystemTick = () => {
                const tick = old_getCurrentSystemTick();
                console.log("XXXX", tick, process.hrtime());
                return tick;
            };
        }
    });

    afterEach(() => {
        watchDog.shutdown();
        this.clock.restore();
    });

    it("should maintain a subscriber count", () => {
        watchDog.subscriberCount.should.eql(0);

        const obj1 = new MyObject();
        watchDog.addSubscriber(obj1, 1000);

        watchDog.subscriberCount.should.eql(1);

        watchDog.removeSubscriber(obj1);
        watchDog.subscriberCount.should.eql(0);
    });

    it("should not have a timer running if no subscriber", () => {
        watchDog.subscriberCount.should.eql(0);
        should(watchDog._timer).equal(null);
    });

    it("should have the internal timer running after the first subscriber has registered", () => {
        should(watchDog._timer).equal(null);

        const obj1 = new MyObject();
        watchDog.addSubscriber(obj1, 1000);

        should.exist(watchDog._timer);

        watchDog.removeSubscriber(obj1);
    });

    it("should stop the internal timer running after the last subscriber has unregistered", () => {
        should(watchDog._timer).equal(null);

        const obj1 = new MyObject();
        watchDog.addSubscriber(obj1, 1000);
        watchDog.removeSubscriber(obj1);

        watchDog.addSubscriber(obj1, 1000);
        watchDog.removeSubscriber(obj1);

        should.not.exist(watchDog._timer);
    });

    it("should fail if the object subscribing to the WatchDog doesn't provide a 'watchdogReset' method", (done) => {
        should(() => {
            watchDog.addSubscriber({}, 100);
        }).throwError();
        done();
    });

    it("should install a 'keepAlive' method on  the subscribing object during addSubscriber and remove it during removeSubscriber", (done) => {
        const obj = new MyObject();
        should(typeof obj.keepAlive === "function").eql(false);

        watchDog.addSubscriber(obj, 100);
        should(typeof obj.keepAlive === "function").eql(true);

        watchDog.removeSubscriber(obj);
        //xx should(typeof obj.keepAlive === "function").eql(false);

        done();
    });

    it("should call the watchdogReset method of a subscriber when timeout has expired", (done) => {
        const obj = new MyObject();
        watchDog.addSubscriber(obj, 100);

        setTimeout(() => {
            obj.keepAlive();
        }, 200);

        obj.on("watchdogReset", done);

        this.clock.tick(2000);
    });

    it("should visit subscribers on a regular basis", (done) => {
        const obj1 = new MyObject();
        const obj2 = new MyObject();

        watchDog.addSubscriber(obj1, 1000);
        watchDog.addSubscriber(obj2, 1000);

        const timer1 = setInterval(() => {
            obj1.keepAlive();
        }, 200);
        const timer2 = setInterval(() => {
            obj2.keepAlive();
        }, 200);

        // Since our objects are sending a keepAlive signal on a very regular basic,
        // we should make sure object do not received a watchdogReset call by the WatchDog
        obj1.on("watchdogReset", () => {
            done(new Error("Received unexpected watchdogReset on object1"));
        });
        obj2.on("watchdogReset", () => {
            done(new Error("Received unexpected watchdogReset on object2"));
        });

        setTimeout(() => {
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
    it("should emit an event when it finds that some subscriber has reached the timeout period without sending a keepAlive signal", (done) => {
        const obj1 = new MyObject();
        watchDog.addSubscriber(obj1, 1000);

        watchDog.on("timeout", function (subscribers) {
            subscribers.length.should.eql(1);
            done();
        });
        this.clock.tick(20000);
    });
});
