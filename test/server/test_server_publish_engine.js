/**
 *
 *  OPCUA protocol defines a long-pooling mechanism for sending server-triggered events back to the client.
 *  Therefore the Publish service behalves slightly differently from other OPCUA services:
 *    - the client will send Publish requests to the server without expecting an immediate answer from the server.
 *    - The server will block the request until some subscriptions have some available data, or a time out
 *
 *
 *    - the Publish Request message is also used by the client to acknowledge processing of notification messages.
 *
 *    n this mode, the client can sent
 *  A good algorithm for a client is to send more publish request than live subscription.
 *
 *
 *   - Publish Request are not tied to a particular subscription, the Server will use the oldest pending
 *     client  Publish request to send some notification regarding the notifying subscription.
 *
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
var ServerSidePublishEngine = require("lib/server/server_publish_engine").ServerSidePublishEngine;
var Subscription = require("lib/server/subscription").Subscription;
var subscription_service = require("lib/services/subscription_service");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var NotificationMessage = subscription_service.NotificationMessage;
var should =require("should");

describe("Testing the server publish engine", function () {

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
            maxLifeTimeCount: 1000,
            maxKeepAliveCount: 20
        });

        publish_server.add_subscription(subscription);

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

        publish_server.shutdown();
    });


    it("a server should feed the availableSequenceNumbers in PublishResponse with sequence numbers that have not been acknowledged by the client", function () {

        var publish_server = new ServerSidePublishEngine();
        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            maxLifeTimeCount: 1000,
            maxKeepAliveCount: 20
        });

        publish_server.add_subscription(subscription);
        var send_response_for_request_spy = sinon.spy(publish_server,"send_response_for_request");

        // client sends a PublishRequest to the server
        var fake_request1 = new subscription_service.PublishRequest({ subscriptionAcknowledgements: [] });
        publish_server._on_PublishRequest(fake_request1);
        send_response_for_request_spy.callCount.should.equal(0);

        // server send a notification to the client
        subscription.addNotificationMessage([{}]);

        // server should send a response for the first publish request with the above notification
        // in this response, there should be no availableSequenceNumbers yet
        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(0).args[1].subscriptionId.should.eql(1234);
        send_response_for_request_spy.getCall(0).args[1].availableSequenceNumbers.should.eql([]);

        // client sends a PublishRequest to the server ( with no acknowledgement)
        var fake_request2 = new subscription_service.PublishRequest({ subscriptionAcknowledgements: [] });
        publish_server._on_PublishRequest(fake_request2);


        // server has now some notification ready and send them to the client
        subscription.addNotificationMessage([{}]);

        // server should send an response for the second publish request with a notification
        send_response_for_request_spy.callCount.should.equal(2);
        send_response_for_request_spy.getCall(1).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(1).args[1].subscriptionId.should.eql(1234);
        send_response_for_request_spy.getCall(1).args[1].availableSequenceNumbers.should.eql([1]);


        // send_response_for_request_spy.

        publish_server.shutdown();
    });

    it("a server should return BadNoSubscription as a response for a publish Request if there is no subscription available for this session. ",function(){

        // create a server - server has no subscription
        var publish_server = new ServerSidePublishEngine();

        var send_response_for_request_spy = sinon.spy(publish_server,"send_response_for_request");

        // client sends a PublishRequest to the server
        var fake_request1 = new subscription_service.PublishRequest({
            subscriptionAcknowledgements: []
        });
        publish_server._on_PublishRequest(fake_request1);

        this.clock.tick(2000);

        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);

    });
    it("should allow to find a subscription by id",function(){
        var publish_server = new ServerSidePublishEngine();
        publish_server.subscriptionCount.should.equal(0);

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            maxLifeTimeCount: 1000,
            maxKeepAliveCount: 20
        });
        publish_server.add_subscription(subscription);
        publish_server.subscriptionCount.should.equal(1);
        publish_server.getSubscriptionById(1234).should.equal(subscription);

        publish_server.shutdown();
        publish_server.subscriptionCount.should.equal(0);

    });

    it("should remove a subscription",function(){
        var publish_server = new ServerSidePublishEngine();
        publish_server.subscriptionCount.should.equal(0);

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            maxLifeTimeCount: 1000,
            maxKeepAliveCount: 20
        });
        publish_server.add_subscription(subscription);
        publish_server.subscriptionCount.should.equal(1);

        publish_server.remove_subscription(subscription);
        publish_server.subscriptionCount.should.equal(0);

        publish_server.shutdown();
        publish_server.subscriptionCount.should.equal(0);

    });

    it("when the client send too many publish requests that the server can queue, the server returns a Service result of BadTooManyPublishRequests",function(){

        var publish_server = new ServerSidePublishEngine({
            maxPublishRequestInQueue: 5
        });
        var send_response_for_request_spy = sinon.spy(publish_server,"send_response_for_request");
        publish_server.add_subscription(new Subscription({id: 1}));

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

    });

    it("the server shall process the client acknowledge sequence number",function(){

        var publish_server = new ServerSidePublishEngine();
        var send_response_for_request_spy = sinon.spy(publish_server,"send_response_for_request");

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            maxLifeTimeCount: 1000,
            maxKeepAliveCount: 20
        });
        publish_server.add_subscription(subscription);

        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        // server send a notification to the client
        subscription.addNotificationMessage([{}]);
        subscription.getAvailableSequenceNumbers().should.eql([1]);

        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(0).args[1].results.should.eql([]);


        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        subscription.addNotificationMessage([{}]);
        subscription.getAvailableSequenceNumbers().should.eql([1,2]);

        send_response_for_request_spy.callCount.should.equal(2);
        send_response_for_request_spy.getCall(1).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(1).args[1].results.should.eql([]);


        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        subscription.addNotificationMessage([{}]);
        subscription.getAvailableSequenceNumbers().should.eql([1,2,3]);

        send_response_for_request_spy.callCount.should.equal(3);
        send_response_for_request_spy.getCall(2).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(2).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(2).args[1].results.should.eql([]);

        publish_server._on_PublishRequest(new subscription_service.PublishRequest({
            subscriptionAcknowledgements: [
                { subscriptionId: 1234 , sequenceNumber:2 }
            ]}
        ));
        subscription.getAvailableSequenceNumbers().should.eql([1,3]);

        subscription.addNotificationMessage([{}]);
        send_response_for_request_spy.callCount.should.equal(4);
        send_response_for_request_spy.getCall(3).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(3).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(3).args[1].results.should.eql([StatusCodes.Good]);



        publish_server._on_PublishRequest(new subscription_service.PublishRequest({
                subscriptionAcknowledgements: [
                    { subscriptionId: 1234 , sequenceNumber:1 },
                    { subscriptionId: 1234 , sequenceNumber:3 }
                ]}
        ));
        subscription.getAvailableSequenceNumbers().should.eql([4]);

        subscription.addNotificationMessage([{}]);
        send_response_for_request_spy.callCount.should.equal(5);
        send_response_for_request_spy.getCall(4).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(4).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(4).args[1].results.should.eql([StatusCodes.Good,StatusCodes.Good]);

    });

    it("the server shall return BadSequenceNumberInvalid if the client attempts to acknowledge a notification that is not in the queue",function(){

        var publish_server = new ServerSidePublishEngine();
        var send_response_for_request_spy = sinon.spy(publish_server,"send_response_for_request");

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            maxLifeTimeCount: 1000,
            maxKeepAliveCount: 20
        });
        publish_server.add_subscription(subscription);

        publish_server._on_PublishRequest(new subscription_service.PublishRequest({
            subscriptionAcknowledgements: [
                { subscriptionId: 1234 , sequenceNumber:36 }
            ]}
        ));
        // server send a notification to the client
        subscription.addNotificationMessage([{}]);
        subscription.getAvailableSequenceNumbers().should.eql([1]);

        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("PublishResponse");
        send_response_for_request_spy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
        send_response_for_request_spy.getCall(0).args[1].results.should.eql([StatusCodes.BadSequenceNumberUnknown]);

    });


});