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
 *    Every publish request is a live ping from the client to the server.
 *    Every publish response is a live ping from the server to the client.
 *
 *    If no notification are available after the keep-alive timeout interval, the server shall return an empty
 *    PublishResponse and therefore notifies the client about a valid connection.
 *    Similarly, the client shall send Publish Request
 *
 *
 */

var sinon = require("sinon");
var ServerSidePublishEngine = require("../../lib/server/server_publish_engine").ServerSidePublishEngine;
var Subscription = require("../../lib/server/subscription").Subscription;
var subscription_service = require("../../lib/subscription_service");
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
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

        // server send a notification to the client
        publish_server.send_notification_message(subscription.id,new NotificationMessage({}));

        // client sends a PublishRequest to the server ( with no acknowledgement)
        var fake_request2 = new subscription_service.PublishRequest({ subscriptionAcknowledgements: [] });
        publish_server._on_PublishRequest(fake_request2);

        // server send a notification to the client
        publish_server.send_notification_message(subscription.id,new NotificationMessage({}));

        // send_response_for_request_spy.

        publish_server.shutdown();
    });

    it("a server should return Bad_NoSubscription as a response for a publish Request if there is no subscription available for this session. ",function(){

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
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("ServiceFault");
        send_response_for_request_spy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Bad_NoSubscription);

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

        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());
        publish_server._on_PublishRequest(new subscription_service.PublishRequest());

        publish_server._on_PublishRequest(new subscription_service.PublishRequest());


        send_response_for_request_spy.callCount.should.equal(1);
        send_response_for_request_spy.getCall(0).args[1]._schema.name.should.equal("ServiceFault");
        send_response_for_request_spy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Bad_TooManyPublishRequests);

    });


});