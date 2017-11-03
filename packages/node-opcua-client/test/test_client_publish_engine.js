"use strict";
var assert = require("node-opcua-assert");
var should = require("should");
var _ = require("underscore");
var sinon = require("sinon");

var subscription_service = require("node-opcua-service-subscription");

var ClientSidePublishEngine = require("../src/client_publish_engine").ClientSidePublishEngine;

var SubscriptionAcknowledgement  = require("node-opcua-service-subscription").SubscriptionAcknowledgement;
var PublishResponse = require("node-opcua-service-subscription").PublishResponse;
var Dequeue = require("dequeue");

function makeSubscription(subscriptionId,timeoutHint,callback) {
    return { subscriptionId: subscriptionId, timeoutHint:timeoutHint, onNotificationMessage: callback};
}

describe("Testing the client publish engine", function () {

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        this.clock.restore();
    });

    it("a client should send a publish request to the server for every new subscription", function () {

        var fake_session = {
            publish: function (request, callback) {
            },
            isChannelValid: function () {
                return true;
            }
        };
        var publish_spy = sinon.spy(fake_session, "publish");

        var clientPublishEngine = new ClientSidePublishEngine(fake_session);


        // start a first new subscription
        clientPublishEngine.registerSubscription(makeSubscription(1, 10000,function () {}));

        // start a second new subscription
        clientPublishEngine.registerSubscription(makeSubscription(2, 10000,function () {}));

        // now advance the time artificially by 4.5 seconds
        this.clock.tick(500 + 4 * 1000);

        // publish should have been called 10 times only ( since no Response have been received from server)
        publish_spy.callCount.should.be.equal(10);

        // args[0] shall be a Publish Request
        publish_spy.getCall(0).args[0]._schema.name.should.equal("PublishRequest");
        assert(_.isFunction(publish_spy.getCall(0).args[1]));

        publish_spy.restore();

    });

    it("a client should keep sending a new publish request to the server after receiving a notification, when a subscription is active", function () {

        var fake_session = {
            publish: function (request, callback) {
                assert(request._schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                setTimeout(function () {var fake_response = new PublishResponse({subscriptionId: 1});
                    callback(null, fake_response);
                }, 100);
            },
            isChannelValid: function () {
                return true;
            }
        };
        var spy = sinon.spy(fake_session, "publish");

        var clientPublishEngine = new ClientSidePublishEngine(fake_session);

        clientPublishEngine.timeoutHint.should.eql(10000,"expecting timeoutHint to be set to default value =10sec");

        // start a first new subscription
        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, function () {}));

        // start a second new subscription
        clientPublishEngine.registerSubscription(makeSubscription(2, 10000,  function () {}));

        // now advance the time artificially by 3 seconds ( 20*150ms)
        this.clock.tick(3000);

        // publish should have been called more than 20 times
        spy.callCount.should.be.greaterThan(20);

        // args[0] shall be a Publish Request
        spy.getCall(0).args[0]._schema.name.should.equal("PublishRequest");
        assert(_.isFunction(spy.getCall(0).args[1]));

        spy.restore();
    });


    it("a client should stop sending publish request to the server after receiving a notification, when there is no more registered subscription ", function () {


        var fake_session = {
            publish: function (request, callback) {
                assert(request._schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                setTimeout(function () {
                    var fake_response = new PublishResponse({subscriptionId: 1});
                    callback(null, fake_response);
                }, 100);
            },
            isChannelValid: function () {
                return true;
            }

        };
        var spy = sinon.spy(fake_session, "publish");

        var clientPublishEngine = new ClientSidePublishEngine(fake_session);

        // start a first new subscription
        clientPublishEngine.registerSubscription(makeSubscription(1, 10000, function () {}));

        // now advance the time artificially by 3 seconds ( 20*150ms)
        this.clock.tick(3000);

        // publish should have been called more than 20 times
        spy.callCount.should.be.greaterThan(20);
        var callcount_after_3sec = spy.callCount;

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
        var response_maker = sinon.stub();

        // let create a set of fake Publish Response that would be generated by a server
        var response1 = new subscription_service.PublishResponse({
            subscriptionId: 1,
            availableSequenceNumbers: [],
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: 36,
                publishTime: new Date(),
                notificationData: [{}]
            }

        });

        var response2 = new subscription_service.PublishResponse({
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

        var count = 0;
        var fake_session = {
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
        var spy = sinon.spy(fake_session, "publish");

        var clientPublishEngine = new ClientSidePublishEngine(fake_session);

        clientPublishEngine.registerSubscription(makeSubscription(44, 10000,function () {}));

        clientPublishEngine.registerSubscription(makeSubscription(1, 10000,function () {}));

        this.clock.tick(4500);

        spy.callCount.should.be.greaterThan(1);

        var publishRequest1 = spy.getCall(0).args[0];
        publishRequest1._schema.name.should.equal("PublishRequest");
        publishRequest1.subscriptionAcknowledgements.should.eql([]);
        this.clock.tick(50);

        var publishRequest2 = spy.getCall(1).args[0];
        publishRequest2._schema.name.should.equal("PublishRequest");
        publishRequest2.subscriptionAcknowledgements.should.eql([new SubscriptionAcknowledgement({sequenceNumber: 36, subscriptionId: 1})]);

        var publishRequest3 = spy.getCall(2).args[0];
        publishRequest3._schema.name.should.equal("PublishRequest");
        publishRequest3.subscriptionAcknowledgements.should.eql([new SubscriptionAcknowledgement({sequenceNumber: 78, subscriptionId: 44})]);

    });

    it("a client publish engine shall adapt the timeoutHint of a publish request to take into account the number of awaiting publish requests ", function () {


        var timerId;

        var publishQueue = new Dequeue();

        function start() {

            timerId = setInterval(function () {

                if (publishQueue.length === 0) {
                    return ;
                }

                var callback = publishQueue.shift();
                var fake_response = new PublishResponse({subscriptionId: 1});
                //xx console.log(" Time ", Date.now());
                callback(null, fake_response);
            }, 1500);
        }
        function stop() {
            clearInterval(timerId);
        }
        var fake_session = {
            publish: function (request, callback) {
                assert(request._schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                publishQueue.push(callback);
                //xx console.log("nbPendingPublishRequests",clientPublishEngine.nbPendingPublishRequests);
            },
            isChannelValid: function () {
                return true;
            }

        };
        var spy = sinon.spy(fake_session, "publish");

        var clientPublishEngine = new ClientSidePublishEngine(fake_session);

        start();

        // start a first new subscription
        clientPublishEngine.registerSubscription({ subscriptionId:1, timeoutHint: 20000, onNotificationMessage: function () {}});

        this.clock.tick(100); // wait a little bit as PendingRequests are send asynchronously
        clientPublishEngine.nbPendingPublishRequests.should.eql(5);

        this.clock.tick(20000);
        clientPublishEngine.unregisterSubscription(1);

        stop();

        fake_session.publish.getCall(0).args[0].requestHeader.timeoutHint.should.eql(20000 *1 );
        fake_session.publish.getCall(1).args[0].requestHeader.timeoutHint.should.eql(20000 *2 );
        fake_session.publish.getCall(2).args[0].requestHeader.timeoutHint.should.eql(20000 *3 );
        fake_session.publish.getCall(3).args[0].requestHeader.timeoutHint.should.eql(20000 *4 );
        fake_session.publish.getCall(4).args[0].requestHeader.timeoutHint.should.eql(20000 *5 );

        // from now on timeoutHint shall be stable
        fake_session.publish.getCall(5).args[0].requestHeader.timeoutHint.should.eql(20000 *5 );
        fake_session.publish.getCall(6).args[0].requestHeader.timeoutHint.should.eql(20000 *5 );
        fake_session.publish.getCall(7).args[0].requestHeader.timeoutHint.should.eql(20000 *5 );

//xx        console.log(fake_session.publish.getCall(6).args[0].requestHeader.timeoutHint);
//xx        console.log(fake_session.publish.getCall(7).args[0].requestHeader.timeoutHint);
//xx        console.log(fake_session.publish.getCall(8).args[0].requestHeader.timeoutHint);
    });

    it("#390 should not send publish request if channel is not properly opened", function (done) {
        var timerId;

        var publishQueue = new Dequeue();

        function start() {

            timerId = setInterval(function () {
                if (publishQueue.length === 0) {
                    return;
                }
                var callback = publishQueue.shift();
                var fake_response = new PublishResponse({subscriptionId: 1});
                //xx console.log(" Time ", Date.now());
                callback(null, fake_response);
            }, 1500);
        }

        function stop() {
            clearInterval(timerId);
        }

        var fake_session = {
            publishCount: 0,
            _isChannelValid: true,
            publish: function (request, callback) {
                this.publishCount++;
                assert(request._schema.name === "PublishRequest");
                // let simulate a server sending a PublishResponse for subscription:1
                // after a short delay of 150 milliseconds
                publishQueue.push(callback);
            },
            isChannelValid: function () {
                return this._isChannelValid;
            }
        };

        var spy = sinon.spy(fake_session, "publish");

        var clientPublishEngine = new ClientSidePublishEngine(fake_session);

        start();

        fake_session._isChannelValid = false;

        // start a first new subscription
        clientPublishEngine.registerSubscription({
            subscriptionId: 1,
            timeoutHint: 20000,
            onNotificationMessage: function () {
            }
        });

        clientPublishEngine.subscriptionCount.should.eql(1);

        this.clock.tick(100); // wait a little bit as PendingRequests are send asynchronously
        clientPublishEngine.nbPendingPublishRequests.should.eql(0);
        fake_session.publishCount.should.eql(0);

        this.clock.tick(20000);
        fake_session.publishCount.should.eql(0);

        fake_session._isChannelValid = true;
        this.clock.tick(1000); // wait a little bit as PendingRequests are send asynchronously
        //xx clientPublishEngine.nbPendingPublishRequests.should.eql(0);

        this.clock.tick(20000);
        fake_session.publishCount.should.eql(19);

        clientPublishEngine.unregisterSubscription(1);
        clientPublishEngine.subscriptionCount.should.eql(0);

        stop();

        done(); // new Error("implement me for #390 - "));
    });
});
