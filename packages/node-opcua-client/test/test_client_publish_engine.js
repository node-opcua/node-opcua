"use strict";
const should = require("should");
const _ = require("underscore");
const sinon = require("sinon");
const Dequeue = require("dequeue");

const { assert } = require("node-opcua-assert");
const { SubscriptionAcknowledgement, PublishResponse } = require("node-opcua-service-subscription");

const { ClientSidePublishEngine } = require("..");

function makeSubscription(subscriptionId, timeoutHint, callback) {
    return { subscriptionId: subscriptionId, timeoutHint: timeoutHint, onNotificationMessage: callback };
}

function noop() {
    /** */
}

describe("Testing the client publish engine", function () {
    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        this.clock.restore();
    });

    it("a client should send a publish request to the server for every new subscription", function () {
        const fakeSession = {
            publish: function (request, callback) {
                /** */
            },
            isChannelValid: function () {
                return true;
            }
        };
        const publish_spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        // start a first new subscription
        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, noop));

        // start a second new subscription
        clientPublishEngine.registerSubscription(makeSubscription(2, 10000, noop));

        // now advance the time artificially by 4.5 seconds
        this.clock.tick(500 + 4 * 1000);

        // publish should have been called 10 times only ( since no Response have been received from server)
        publish_spy.callCount.should.be.equal(10);

        // args[0] shall be a Publish Request
        publish_spy.getCall(0).args[0].schema.name.should.equal("PublishRequest");
        assert(_.isFunction(publish_spy.getCall(0).args[1]));

        publish_spy.restore();
    });

    it("a client should keep sending a new publish request to the server after receiving a notification, when a subscription is active", function () {
        const fakeSession = {
            publish: function (request, callback) {
                assert(request.schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                setTimeout(function () {
                    const fakeResponse = new PublishResponse({ subscriptionId: 1 });
                    callback(null, fakeResponse);
                }, 100);
            },
            isChannelValid: function () {
                return true;
            }
        };
        const spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        clientPublishEngine.timeoutHint.should.eql(10000, "expecting timeoutHint to be set to default value =10sec");

        // start a first new subscription
        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, noop));

        // start a second new subscription
        clientPublishEngine.registerSubscription(makeSubscription(2, 10000, noop));

        // now advance the time artificially by 3 seconds ( 20*150ms)
        this.clock.tick(3000);

        // publish should have been called more than 20 times
        spy.callCount.should.be.greaterThan(20);

        // args[0] shall be a Publish Request
        spy.getCall(0).args[0].schema.name.should.equal("PublishRequest");
        assert(_.isFunction(spy.getCall(0).args[1]));

        spy.restore();
    });

    it("a client should stop sending publish request to the server after receiving a notification, when there is no more registered subscription ", function () {
        const fakeSession = {
            publish: function (request, callback) {
                assert(request.schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                setTimeout(function () {
                    const fakeResponse = new PublishResponse({ subscriptionId: 1 });
                    callback(null, fakeResponse);
                }, 100);
            },
            isChannelValid: function () {
                return true;
            }
        };
        const spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        // start a first new subscription
        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, noop));

        // now advance the time artificially by 3 seconds ( 20*150ms)
        this.clock.tick(3000);

        // publish should have been called more than 20 times
        spy.callCount.should.be.greaterThan(20);
        const callcount_after_3sec = spy.callCount;

        // now, un-register the subscription
        clientPublishEngine.unregisterSubscription(1);

        // now advance the time artificially again by 3 seconds ( 20*150ms)
        this.clock.tick(3000);

        // publish should be called no more
        spy.callCount.should.be.equal(callcount_after_3sec);

        spy.restore();
    });

    it("a client should acknowledge sequence numbers received in PublishResponse in next PublishRequest", function () {
        // the spec says: Clients are required to acknowledge  Notification Messages as they are received.
        const response_maker = sinon.stub();

        // let create a set of fake Publish Response that would be generated by a server
        const response1 = new PublishResponse({
            subscriptionId: 1,
            availableSequenceNumbers: [],
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: 36,
                publishTime: new Date(),
                notificationData: [{}]
            }
        });

        const response2 = new PublishResponse({
            subscriptionId: 44,
            availableSequenceNumbers: [],
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: 78,
                publishTime: new Date(),
                notificationData: [{}]
            }
        });
        response_maker.onCall(0).returns([null, response1]);
        response_maker.onCall(1).returns([null, response2]);
        response_maker.onCall(2).returns([null, response2]);
        response_maker.onCall(3).returns([null, response2]);
        response_maker.onCall(4).returns([null, response2]);

        let count = 0;
        const fakeSession = {
            publish: function (request, callback) {
                if (count < 4) {
                    callback.apply(this, response_maker());
                    count += 1;
                }
            },
            isChannelValid: function () {
                return true;
            }
        };
        const spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        clientPublishEngine.registerSubscription(makeSubscription(44, 10000, noop));

        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, noop));

        this.clock.tick(4500);

        spy.callCount.should.be.greaterThan(1);

        const publishRequest1 = spy.getCall(0).args[0];
        publishRequest1.schema.name.should.equal("PublishRequest");
        publishRequest1.subscriptionAcknowledgements.should.eql([]);
        this.clock.tick(50);

        const publishRequest2 = spy.getCall(1).args[0];
        publishRequest2.schema.name.should.equal("PublishRequest");
        publishRequest2.subscriptionAcknowledgements.should.eql([
            new SubscriptionAcknowledgement({ sequenceNumber: 36, subscriptionId: 1 })
        ]);

        const publishRequest3 = spy.getCall(2).args[0];
        publishRequest3.schema.name.should.equal("PublishRequest");
        publishRequest3.subscriptionAcknowledgements.should.eql([
            new SubscriptionAcknowledgement({ sequenceNumber: 78, subscriptionId: 44 })
        ]);
    });

    it("a client publish engine shall adapt the timeoutHint of a publish request to take into account the number of awaiting publish requests ", function () {
        let timerId;

        const publishQueue = new Dequeue();

        function start() {
            timerId = setInterval(function () {
                if (publishQueue.length === 0) {
                    return;
                }

                const callback = publishQueue.shift();
                const fakeResponse = new PublishResponse({ subscriptionId: 1 });
                //xx console.log(" Time ", Date.now());
                callback(null, fakeResponse);
            }, 1500);
        }
        function stop() {
            clearInterval(timerId);
        }
        const fakeSession = {
            publish: function (request, callback) {
                assert(request.schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                publishQueue.push(callback);
                //xx console.log("nbPendingPublishRequests",clientPublishEngine.nbPendingPublishRequests);
            },
            isChannelValid: function () {
                return true;
            }
        };
        const spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        start();

        // start a first new subscription
        clientPublishEngine.registerSubscription({ subscriptionId: 1, timeoutHint: 20000, onNotificationMessage: noop });

        this.clock.tick(100); // wait a little bit as PendingRequests are send asynchronously
        clientPublishEngine.nbPendingPublishRequests.should.eql(5);

        this.clock.tick(20000);
        clientPublishEngine.unregisterSubscription(1);

        stop();

        fakeSession.publish.getCall(0).args[0].requestHeader.timeoutHint.should.eql(20000 * 1);
        fakeSession.publish.getCall(1).args[0].requestHeader.timeoutHint.should.eql(20000 * 2);
        fakeSession.publish.getCall(2).args[0].requestHeader.timeoutHint.should.eql(20000 * 3);
        fakeSession.publish.getCall(3).args[0].requestHeader.timeoutHint.should.eql(20000 * 4);
        fakeSession.publish.getCall(4).args[0].requestHeader.timeoutHint.should.eql(20000 * 5);

        // from now on timeoutHint shall be stable
        fakeSession.publish.getCall(5).args[0].requestHeader.timeoutHint.should.eql(20000 * 5);
        fakeSession.publish.getCall(6).args[0].requestHeader.timeoutHint.should.eql(20000 * 5);
        fakeSession.publish.getCall(7).args[0].requestHeader.timeoutHint.should.eql(20000 * 5);

        //xx        console.log(fakeSession.publish.getCall(6).args[0].requestHeader.timeoutHint);
        //xx        console.log(fakeSession.publish.getCall(7).args[0].requestHeader.timeoutHint);
        //xx        console.log(fakeSession.publish.getCall(8).args[0].requestHeader.timeoutHint);
    });

    it("#390 should not send publish request if channel is not properly opened", function (done) {
        let timerId;

        const publishQueue = new Dequeue();

        function start() {
            timerId = setInterval(function () {
                if (publishQueue.length === 0) {
                    return;
                }
                const callback = publishQueue.shift();
                const fakeResponse = new PublishResponse({ subscriptionId: 1 });
                //xx console.log(" Time ", Date.now());
                callback(null, fakeResponse);
            }, 1500);
        }

        function stop() {
            clearInterval(timerId);
        }

        const fakeSession = {
            publishCount: 0,
            _isChannelValid: true,
            publish: function (request, callback) {
                this.publishCount++;
                assert(request.schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                publishQueue.push(callback);
            },
            isChannelValid: function () {
                return this._isChannelValid;
            }
        };

        const spy = sinon.spy(fakeSession, "publish");

        const clientPublishEngine = new ClientSidePublishEngine(fakeSession);

        start();

        fakeSession._isChannelValid = false;

        // start a first new subscription
        clientPublishEngine.registerSubscription({
            subscriptionId: 1,
            timeoutHint: 20000,
            onNotificationMessage: noop
        });

        clientPublishEngine.subscriptionCount.should.eql(1);

        this.clock.tick(100); // wait a little bit as PendingRequests are send asynchronously
        clientPublishEngine.nbPendingPublishRequests.should.eql(0);
        fakeSession.publishCount.should.eql(0);

        this.clock.tick(20000);
        fakeSession.publishCount.should.eql(0);

        fakeSession._isChannelValid = true;
        this.clock.tick(1000); // wait a little bit as PendingRequests are send asynchronously
        //xx clientPublishEngine.nbPendingPublishRequests.should.eql(0);

        this.clock.tick(20000);
        fakeSession.publishCount.should.eql(19);

        clientPublishEngine.unregisterSubscription(1);
        clientPublishEngine.subscriptionCount.should.eql(0);

        stop();

        done(); // new Error("implement me for #390 - "));
    });
});
