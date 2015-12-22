/**
 *
 *  OPCUA protocol defines a long-pooling mechanism for sending server-triggered events back to the client.
 *  Therefore the Publish service behalves slightly differently from other OPCUA services:
 *    - the client will send Publish requests to the server without expecting an immediate answer from the server.
 *    - The server will block the request until some subscriptions have some available data, or a time out
 *
 *
 *    - the Publish Request message is also used by the client to acknowledge processing of notification messages
 *
 *
 *    A good algorithm for a client is to send more publish request than live subscription.
 *
 *   - Publish Request are not tied to a particular subscription, the Server will use the oldest pending
 *     client Publish request to send some notification regarding the notifying subscription.
 *
 * preventing queue overflow
 * -------------------------
 *  - if the client send too many publish requests that the server can queue, the server may return a Service result
 *    of BadTooManyPublishRequests.
 *
 * Keep alive mechanism:
 * ---------------------
 *    Publish Request/Response are also use as a keep alive signal between the server and the client.
 *    Every publish request  is a live ping from the client to the server.
 *    Every publish response is a live ping from the server to the client.
 *
 *    If no notification are available after the keep-alive timeout interval, the server shall return an empty
 *    PublishResponse and therefore notifies the client about a valid connection.
 *    Similarly, the client shall send Publish Request
 *
 *
 */
require("requirish")._(module);

var sinon = require("sinon");
var should = require("should");
var _ = require("underscore");

var ServerSidePublishEngine = require("lib/server/server_publish_engine").ServerSidePublishEngine;
var Subscription = require("lib/server/subscription").Subscription;
var SubscriptionState = require("lib/server/subscription").SubscriptionState;
var subscription_service = require("lib/services/subscription_service");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var fakeNotificationData =[new subscription_service.DataChangeNotification()];

describe("Testing the server publish engine", function () {

    before(function () {
        resourceLeakDetector.start();
    });
    after(function () {
        resourceLeakDetector.stop();
    });

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        this.clock.restore();
    });

    it("a server should send keep alive notifications", function () {

        var publish_server = new ServerSidePublishEngine();

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: publish_server
        });

        publish_server.add_subscription(subscription);
        subscription.state.should.equal(SubscriptionState.NORMAL);

        // client sends a PublishRequest to the server
        var fake_request1 = new subscription_service.PublishRequest({
            subscriptionAcknowledgements: []
        });
        publish_server._on_PublishRequest(fake_request1);
        publish_server.pendingPublishRequestCount.should.equal(1);

        var fake_request2 = new subscription_service.PublishRequest({
            subscriptionAcknowledgements: []
        });
        publish_server._on_PublishRequest(fake_request2);
        publish_server.pendingPublishRequestCount.should.equal(2);

        this.clock.tick(subscription.publishingInterval * 19);
        publish_server.pendingPublishRequestCount.should.equal(1);

        this.clock.tick(subscription.publishingInterval * 5);
        publish_server.pendingPublishRequestCount.should.equal(0);

        publish_server.remove_subscription(subscription);
        subscription.terminate();
        publish_server.shutdown();
    });


    it("a server should feed the availableSequenceNumbers in PublishResponse with sequence numbers that have not been acknowledged by the client", function () {

        var publish_server = new ServerSidePublishEngine();
        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: publish_server
        });

        publish_server.add_subscription(subscription);
        var send_response_for_request_spy = sinon.spy(publish_server, "send_response_for_request");

        // client sends a PublishRequest to the server
        var fake_request1 = new subscription_service.PublishRequest({subscriptionAcknowledgements: []});
        publish_server._on_PublishRequest(fake_request1);
        send_response_for_request_spy.callCount.should.equal(0);


        // server send a notification to the client
        subscription.addNotificationMessage(fakeNotificationData);

        this.clock.tick(subscription.publishingInterval * 1.2);

        // server should send a response for the first publish request with the above notification
        // in this response, there should be  one element in the availableSequenceNumbers.
        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(0).args[1].subscriptionId.should.eql(1234);
        send_response_for_request_spy.getCall(0).args[1].availableSequenceNumbers.should.eql([1]);

        // client sends a PublishRequest to the server ( with no acknowledgement)
        var fake_request2 = new subscription_service.PublishRequest({subscriptionAcknowledgements: []});
        publish_server._on_PublishRequest(fake_request2);


        // server has now some notification ready and send them to the client
        subscription.addNotificationMessage(fakeNotificationData);
        send_response_for_request_spy.callCount.should.equal(1);

        this.clock.tick(subscription.publishingInterval);

        // server should send an response for the second publish request with a notification
        send_response_for_request_spy.callCount.should.equal(2);
        send_response_for_request_spy.getCall(1).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(1).args[1].subscriptionId.should.eql(1234);
        send_response_for_request_spy.getCall(1).args[1].availableSequenceNumbers.should.eql([1, 2]);


        // send_response_for_request_spy.
        publish_server.remove_subscription(subscription);
        subscription.terminate();
        publish_server.shutdown();
    });

    it("a server should return BadNoSubscription as a response for a publish Request if there is no subscription available for this session. ", function () {

        // create a server - server has no subscription
        var publish_server = new ServerSidePublishEngine();

        var send_response_for_request_spy = sinon.spy(publish_server, "send_response_for_request");

        // client sends a PublishRequest to the server
        var fake_request1 = new subscription_service.PublishRequest({
            subscriptionAcknowledgements: []
        });
        publish_server._on_PublishRequest(fake_request1);

        this.clock.tick(2000);

        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);

        publish_server.shutdown();
    });

    it("should be possible to find a subscription by id on a publish_server", function () {
        var publish_server = new ServerSidePublishEngine();
        publish_server.subscriptionCount.should.equal(0);

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000, // 1 second
            lifeTimeCount: 100,
            maxKeepAliveCount: 20,
            //
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);
        publish_server.subscriptionCount.should.equal(1);
        publish_server.getSubscriptionById(1234).should.equal(subscription);

        publish_server.remove_subscription(subscription);
        subscription.terminate();

        publish_server.shutdown();
        publish_server.subscriptionCount.should.equal(0);

    });

    it("should be possible to remove a subscription from a publish_server", function () {
        var publish_server = new ServerSidePublishEngine();
        publish_server.subscriptionCount.should.equal(0);

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);
        publish_server.subscriptionCount.should.equal(1);

        publish_server.remove_subscription(subscription);
        publish_server.subscriptionCount.should.equal(0);

        subscription.terminate();
        publish_server.shutdown();
        publish_server.subscriptionCount.should.equal(0);

    });

    it("when the client send too many publish requests that the server can queue, the server returns a Service result of BadTooManyPublishRequests", function () {

        var publish_server = new ServerSidePublishEngine({
            maxPublishRequestInQueue: 5
        });
        var send_response_for_request_spy = sinon.spy(publish_server, "send_response_for_request");

        var subscription = new Subscription({
            id: 1,
            //
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);

        // simulate client sending PublishRequest ,and server doing nothing
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());

        //en: the straw that broke the camel's back.
        //fr: la goutte qui fait déborder le vase.
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());

        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadTooManyPublishRequests);
        send_response_for_request_spy.getCall(0).args[1].results.should.eql([]);


        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();
    });

    it("the server shall process the client acknowledge sequence number", function () {

        var publish_server = new ServerSidePublishEngine();
        var send_response_for_request_spy = sinon.spy(publish_server, "send_response_for_request");

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);


        // --------------------------------
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());

        // server send a notification to the client
        subscription.addNotificationMessage(fakeNotificationData);

        this.clock.tick(subscription.publishingInterval);

        subscription.getAvailableSequenceNumbers().should.eql([1]);

        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(0).args[1].results.should.eql([]);


        // --------------------------------
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());

        subscription.addNotificationMessage(fakeNotificationData);

        this.clock.tick(subscription.publishingInterval);

        subscription.getAvailableSequenceNumbers().should.eql([1, 2]);

        send_response_for_request_spy.callCount.should.equal(2);
        send_response_for_request_spy.getCall(1).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(1).args[1].results.should.eql([]);


        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        subscription.addNotificationMessage(fakeNotificationData);
        this.clock.tick(subscription.publishingInterval);
        subscription.getAvailableSequenceNumbers().should.eql([1, 2, 3]);

        send_response_for_request_spy.callCount.should.equal(3);
        send_response_for_request_spy.getCall(2).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(2).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(2).args[1].results.should.eql([]);

        publish_server._on_PublishRequest(new subscription_service.PublishRequest({
                subscriptionAcknowledgements: [
                    {subscriptionId: 1234, sequenceNumber: 2}
                ]
            }
        ));
        subscription.getAvailableSequenceNumbers().should.eql([1, 3]);

        subscription.addNotificationMessage(fakeNotificationData);
        this.clock.tick(subscription.publishingInterval);
        send_response_for_request_spy.callCount.should.equal(4);
        send_response_for_request_spy.getCall(3).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(3).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(3).args[1].results.should.eql([StatusCodes.Good]);


        publish_server._on_PublishRequest(new subscription_service.PublishRequest({
                subscriptionAcknowledgements: [
                    {subscriptionId: 1234, sequenceNumber: 1},
                    {subscriptionId: 1234, sequenceNumber: 3}
                ]
            }
        ));
        subscription.getAvailableSequenceNumbers().should.eql([4]);

        subscription.addNotificationMessage(fakeNotificationData);
        this.clock.tick(subscription.publishingInterval);

        send_response_for_request_spy.callCount.should.equal(5);
        send_response_for_request_spy.getCall(4).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(4).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(4).args[1].results.should.eql([StatusCodes.Good, StatusCodes.Good]);

        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();
    });

    it("the server shall return BadSequenceNumberInvalid if the client attempts to acknowledge a notification that is not in the queue", function () {

        var publish_server = new ServerSidePublishEngine();
        var send_response_for_request_spy = sinon.spy(publish_server, "send_response_for_request");

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);

        // simulate a client sending a PublishRequest to the server
        // that acknowledge on a wrong sequenceNumber
        publish_server._on_PublishRequest(new subscription_service.PublishRequest({
                subscriptionAcknowledgements: [
                    {
                        subscriptionId: 1234,
                        sequenceNumber: 36   // <<< INVALID SEQUENCE NUMBER
                    }
                ]
            }
        ));


        // server send a notification to the client
        subscription.addNotificationMessage(fakeNotificationData);


        this.clock.tick(subscription.publishingInterval * 1.2);

        subscription.getAvailableSequenceNumbers().should.eql([1]);

        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(0).args[1].results.should.eql([StatusCodes.BadSequenceNumberUnknown]);

        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();
    });

    it("a subscription shall send a keep-alive message at the end of the first publishing interval, if there are no Notifications ready.", function () {

        var publish_server = new ServerSidePublishEngine();


        var send_keep_alive_response_spy = sinon.spy(publish_server, "send_keep_alive_response");
        var send_response_for_request_spy = sinon.spy(publish_server, "send_response_for_request");

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 4,
            maxKeepAliveCount: 20,
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);

        // make sure we have at least 5 PublishRequest in queue
        publish_server.maxPublishRequestInQueue.should.be.greaterThan(5);
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server.pendingPublishRequestCount.should.eql(5);


        subscription.maxKeepAliveCount.should.eql(20);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        subscription.publishIntervalCount.should.eql(0);
        send_keep_alive_response_spy.callCount.should.equal(0);

        // after one publishingCycle a keep Alive message shall be send
        this.clock.tick(subscription.publishingInterval);

        subscription.state.should.eql(SubscriptionState.NORMAL);
        subscription.publishIntervalCount.should.eql(1);
        send_keep_alive_response_spy.callCount.should.equal(1);
        send_response_for_request_spy.callCount.should.eql(1);

        // after maxKeepAliveCount * publishingCycle a second keep Alive message shall be send
        this.clock.tick(subscription.publishingInterval * 20);

        subscription.state.should.eql(SubscriptionState.NORMAL);
        subscription.publishIntervalCount.should.eql(21);
        send_keep_alive_response_spy.callCount.should.equal(2);
        send_response_for_request_spy.callCount.should.eql(2);

        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();
    });

    it("a Normal subscription that receives a notification shall wait for the next publish interval to send a PublishResponse ", function () {

        var publish_server = new ServerSidePublishEngine();


        var send_keep_alive_response_spy = sinon.spy(publish_server, "send_keep_alive_response");
        var send_notification_message_spy = sinon.spy(publish_server, "send_notification_message");

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 4,
            maxKeepAliveCount: 20,
            publishEngine: publish_server,
            maxNotificationsPerPublish: 0 // no limits
        });
        publish_server.add_subscription(subscription);

        // make sure we have at least 5 PublishRequest in queue
        publish_server.maxPublishRequestInQueue.should.be.greaterThan(5);
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server.pendingPublishRequestCount.should.eql(5);


        subscription.addNotificationMessage(fakeNotificationData);

        this.clock.tick(2);
        subscription.state.should.eql(SubscriptionState.NORMAL);
        subscription.publishIntervalCount.should.eql(0);

        this.clock.tick(subscription.publishingInterval);
        subscription.publishIntervalCount.should.eql(1);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        send_keep_alive_response_spy.callCount.should.eql(0);
        send_notification_message_spy.callCount.should.eql(1);

        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();
    });

    it("the subscription state shall be set to LATE, if it cannot process a notification after Publish Interval has been raised, due to a lack of PublishRequest", function () {


        var publish_server = new ServerSidePublishEngine();

        publish_server.maxPublishRequestInQueue.should.be.greaterThan(5);

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 4,
            maxKeepAliveCount: 20,
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);

        publish_server.pendingPublishRequestCount.should.eql(0, " No PublishRequest in queue");

        this.clock.tick(2);
        subscription.state.should.equal(SubscriptionState.NORMAL);

        subscription.addNotificationMessage(fakeNotificationData);
        this.clock.tick(subscription.publishingInterval * 1.2);

        subscription.state.should.equal(SubscriptionState.LATE);
        publish_server.pendingPublishRequestCount.should.eql(0, " No PublishRequest in queue");

        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();
    });


    it("a subscription should provide its time to expiration so that publish engine could sort late subscriptions by order of priority", function () {

        var publish_server = new ServerSidePublishEngine();
        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 10,
            maxKeepAliveCount: 2,
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);

        subscription.lifeTimeCount.should.eql(10);
        subscription.timeToExpiration.should.eql(1000 * 10);

        this.clock.tick(subscription.publishingInterval * 1.2);
        subscription.timeToExpiration.should.eql(1000 * 9);

        this.clock.tick(subscription.publishingInterval * 1.2);
        subscription.timeToExpiration.should.eql(1000 * 8);

        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();
    });

    it("a publish engine should be able to find out which are the most urgent late subscriptions to serve ", function () {

        var publish_server = new ServerSidePublishEngine();
        publish_server.pendingPublishRequestCount.should.eql(0, " No PublishRequest in queue");


        var subscription1 = new Subscription({
            id: 1,
            publishingInterval: 1000, lifeTimeCount: 10, maxKeepAliveCount: 2,
            publishEngine: publish_server
        });
        subscription1.publishingInterval.should.eql(1000);
        subscription1.lifeTimeCount.should.eql(10);
        subscription1.maxKeepAliveCount.should.eql(2);

        publish_server.add_subscription(subscription1);

        var subscription2 = new Subscription({
            id: 2,
            publishingInterval: 100, lifeTimeCount: 20, maxKeepAliveCount: 2,
            publishEngine: publish_server
        });
        subscription2.publishingInterval.should.eql(100);
        subscription2.lifeTimeCount.should.eql(20);
        subscription2.maxKeepAliveCount.should.eql(2);
        publish_server.add_subscription(subscription2);

        var subscription3 = new Subscription({
            id: 3,
            publishingInterval: 50, lifeTimeCount: 1000, maxKeepAliveCount: 2,
            publishEngine: publish_server
        });
        subscription3.publishingInterval.should.eql(100); // !! Note that publishingInterval has been clamped in constructor
        subscription3.lifeTimeCount.should.eql(1000);
        subscription3.maxKeepAliveCount.should.eql(2);

        publish_server.add_subscription(subscription3);

        subscription1.lifeTimeCount.should.eql(10);
        subscription2.lifeTimeCount.should.eql(20);
        subscription3.lifeTimeCount.should.eql(1000);


        subscription1.timeToExpiration.should.eql(10000);
        subscription2.timeToExpiration.should.eql(2000);
        subscription3.timeToExpiration.should.eql(100000);

        // let move in time so that subscriptions starts
        this.clock.tick(10);

        subscription1.state.should.eql(SubscriptionState.NORMAL);
        subscription2.state.should.eql(SubscriptionState.NORMAL);
        subscription3.state.should.eql(SubscriptionState.NORMAL);

        publish_server.findLateSubscriptionsSortedByAge().should.eql([]);


        // add some notification we want to process
        subscription1.addNotificationMessage(fakeNotificationData);
        subscription2.addNotificationMessage(fakeNotificationData);
        subscription3.addNotificationMessage(fakeNotificationData);


        // let move in time so that all subscriptions get late (without expiring)
        this.clock.tick(1100);
        subscription1.state.should.eql(SubscriptionState.LATE);
        subscription2.state.should.eql(SubscriptionState.LATE);
        subscription3.state.should.eql(SubscriptionState.LATE);


        publish_server.findLateSubscriptionsSortedByAge().map(_.property("id")).should.eql([2, 1, 3]);

        this.clock.tick(1100);
        subscription1.state.should.eql(SubscriptionState.LATE);
        subscription2.state.should.eql(SubscriptionState.CLOSED);
        subscription3.state.should.eql(SubscriptionState.LATE);

        publish_server.findLateSubscriptionsSortedByAge().map(_.property("id")).should.eql([1, 3]);

        subscription1.terminate();
        publish_server.remove_subscription(subscription1);

        subscription2.terminate();
        publish_server.remove_subscription(subscription2);

        subscription3.terminate();
        publish_server.remove_subscription(subscription3);

        publish_server.shutdown();
    });


    it("a LATE subscription that receives a notification shall send a PublishResponse immediately, without waiting for next publish interval", function () {

        var publish_server = new ServerSidePublishEngine();


        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 4,
            maxKeepAliveCount: 20,
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);

        publish_server.pendingPublishRequestCount.should.eql(0, " No PublishRequest in queue");

        this.clock.tick(2);
        subscription.state.should.equal(SubscriptionState.NORMAL);

        subscription.addNotificationMessage(fakeNotificationData);
        this.clock.tick(subscription.publishingInterval * 1.2);

        subscription.state.should.equal(SubscriptionState.LATE);
        publish_server.pendingPublishRequestCount.should.eql(0, " No PublishRequest in queue");

        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server.pendingPublishRequestCount.should.eql(0, "starving subscription should have consumed this Request immediately");

        subscription.state.should.equal(SubscriptionState.NORMAL);

        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();

    });

    it("LifeTimeCount, the server shall terminated the subscription if it has not received any PublishRequest after LifeTimeCount cycles", function () {

        var publish_server = new ServerSidePublishEngine();

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 4,
            maxKeepAliveCount: 20,
            publishEngine: publish_server
        });
        subscription.maxKeepAliveCount.should.eql(20);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        this.clock.tick(2);
        subscription.state.should.eql(SubscriptionState.NORMAL);
        subscription.publishIntervalCount.should.eql(0);

        publish_server.add_subscription(subscription);

        // server send a notification to the client
        subscription.addNotificationMessage(fakeNotificationData);
        subscription.pendingNotificationsCount.should.eql(1);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        // server send a notification to the client
        subscription.addNotificationMessage(fakeNotificationData);
        subscription.pendingNotificationsCount.should.eql(2);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        this.clock.tick(subscription.publishingInterval);
        subscription.publishIntervalCount.should.eql(1);
        subscription.state.should.eql(SubscriptionState.LATE);

        this.clock.tick(subscription.publishingInterval * subscription.lifeTimeCount + 20);
        subscription.publishIntervalCount.should.eql(subscription.lifeTimeCount);
        subscription.state.should.eql(SubscriptionState.CLOSED);

        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();
    });

    it("LifeTimeCount, the publish engine shall send a StatusChangeNotification to inform that a subscription has been closed because of LifeTime timeout ", function () {

        var publish_server = new ServerSidePublishEngine();

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 4,
            maxKeepAliveCount: 20,
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);

        subscription.maxKeepAliveCount.should.eql(20);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        this.clock.tick(2);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        this.clock.tick(subscription.publishingInterval * subscription.lifeTimeCount + 20);
        subscription.state.should.eql(SubscriptionState.CLOSED);

        publish_server.findFirstClosedSubscription().id.should.eql(1234);

        var send_response_for_request_spy = sinon.spy(publish_server, "send_response_for_request");

        // now send a late PublishRequest
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());

        // we expect this publish request to be immediately consumed
        publish_server.pendingPublishRequestCount.should.eql(0);

        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.firstCall.args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.firstCall.args[1].subscriptionId.should.eql(1234);
        send_response_for_request_spy.firstCall.args[1].notificationMessage.notificationData.length.should.eql(1);
        send_response_for_request_spy.firstCall.args[1].notificationMessage.notificationData[0].statusCode.should.eql(StatusCodes.BadTimeout);


        subscription.state.should.eql(SubscriptionState.CLOSED);


        //xxsubscription.terminate();
        //xxpublish_server.remove_subscription(subscription);
        publish_server.shutdown();
    });
    it("PublishRequest timeout, the publish engine shall return a publish response with serviceResult = BadTimeout when Publish requests have timed out", function () {
        var publish_server = new ServerSidePublishEngine();

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 4,
            maxKeepAliveCount: 20,
            publishEngine: publish_server
        });
        publish_server.add_subscription(subscription);

        subscription.maxKeepAliveCount.should.eql(20);
        subscription.state.should.eql(SubscriptionState.NORMAL);
        var send_response_for_request_spy = sinon.spy(publish_server, "send_response_for_request");

        publish_server._on_PublishRequest(new subscription_service.PublishRequest({requestHeader: {timeoutHint: 1200}}));
        publish_server._on_PublishRequest(new subscription_service.PublishRequest({requestHeader: {timeoutHint: 1200}}));
        publish_server._on_PublishRequest(new subscription_service.PublishRequest({requestHeader: {timeoutHint: 1200}}));
        publish_server._on_PublishRequest(new subscription_service.PublishRequest({requestHeader: {timeoutHint: 1200}}));
        publish_server._on_PublishRequest(new subscription_service.PublishRequest({requestHeader: {timeoutHint: 1200}}));
        publish_server.pendingPublishRequestCount.should.eql(5);
        this.clock.tick(20);

        this.clock.tick(1000);

        send_response_for_request_spy.callCount.should.equal(1);
        publish_server.pendingPublishRequestCount.should.eql(4);
        send_response_for_request_spy.firstCall.args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        publish_server._on_PublishRequest(new subscription_service.PublishRequest({requestHeader: {timeoutHint: 1200}}));

        this.clock.tick(1000);
        // all remaining 4 publish request must have been detected as timedout now and answered as such.
        send_response_for_request_spy.callCount.should.equal(5);
        publish_server.pendingPublishRequestCount.should.eql(1);
        send_response_for_request_spy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadTimeout);
        send_response_for_request_spy.getCall(2).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadTimeout);
        send_response_for_request_spy.getCall(3).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadTimeout);
        send_response_for_request_spy.getCall(4).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadTimeout);

        subscription.terminate();
        publish_server.remove_subscription(subscription);
        publish_server.shutdown();

    });

});

