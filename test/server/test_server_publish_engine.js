/**
 *
 *  OPCUA protocol defines a long-pooling mechanism for sending server-triggered events back to the client.
 *  Therefore the Publish service behalves slightly differently from other OPCUA services:
 *    - the client will send Publish requeststo the server without expecting an immediate answer from the server.
 *    - The server will block the request until some subscriptions have some available data, or a time out
 *
 *
 *    - the Publish Request message is also used by the client to acknwoledge processing of notification messages.
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
 *    If no notificiation are available after the keep-alive timeout intervak, the server shall return an empty
 *    PublishResponse and therefore notifies the client about a valid connection.
 *    Similarly, the client shall send Publish Request
 *
 *
 */

var sinon = require("sinon");
var ServerSidePublishEngine = require("../../lib/server/server_publish_engine").ServerSidePublishEngine;
var Subscription = require("../../lib/server/server_publish_engine").Subscription;
var subscription_service = require("../../lib/subscription_service");
var StatusCodes = require("../../lib/opcua_status_code").StatusCodes;
var NotificationMessage = subscription_service.NotificationMessage;

describe("Testing the subscription notification publishing mechanism", function () {
    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });
    afterEach(function () {
        this.clock.restore();
    });
    it("a subscription that have a new notification ready every publishingInterval shall send notifications and no keepalive", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 10,
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            this.set_notification({});
        });

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        this.clock.tick(subscription.publishingInterval * 4);

        notification_event_spy.callCount.should.be.greaterThan(2);
        keepalive_event_spy.callCount.should.equal(0);

        subscription.terminate();

    });

    it("a subscription that have only some notification ready before max_keepalive_count expired shall send notifications and no keepalive", function () {
        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 100000, // very long liveTimeCount not to be bother by client not pinging us
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            /* pretend that we do not have a notification ready */
        });

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(subscription.publishingInterval * 7);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        // a notification finally arrived !
        subscription.set_notification({});
        this.clock.tick(subscription.publishingInterval * 4);
        notification_event_spy.callCount.should.equal(1);
        keepalive_event_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        // a notification finally arrived !
        subscription.set_notification({});
        this.clock.tick(subscription.publishingInterval * 4);
        notification_event_spy.callCount.should.equal(2);
        keepalive_event_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        subscription.terminate();

    });

    it("a subscription that hasn't been pinged by client within the live time interval shall terminate", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 10,
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            this.set_notification({});
        });

        var expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.liveTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * (subscription.liveTimeCount + 2));

        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);

        subscription.terminate();
    });

    it("a subscription that has been pinged by client before the live time expiration shall not terminate", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 10,
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            this.set_notification({});
        });

        var expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.liveTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        subscription.ping_from_client();

        this.clock.tick(subscription.publishingInterval * 4);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * (subscription.liveTimeCount + 2));
        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);
    });

    it("a subscription that has no notification within maxKeepAliveCount shall send a keepalive signal ", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            liveTimeCount: 100000, // very large live time not to be bother by client not pinging us
            maxKeepAliveCount: 20
        });
        subscription.on("perform_update", function () {
            // pretend there is no notification ready
        });

        var expire_event_spy = sinon.spy();
        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount - 5));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * 10);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(1);

        this.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount + 3));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(2);

    });

});



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
            liveTimeCount: 1000,
            maxKeepAliveCount: 20
        });

        publish_server.add_subscription(subscription);

        // client sends a PublishRequest to the server
        var fake_request1 = new subscription_service.PublishRequest({
            subscriptionAcknowledgements: []
        });
        publish_server._on_PublishRequest(fake_request1);

        var fake_request2 = new subscription_service.PublishRequest({
            subscriptionAcknowledgements: []
        });
        publish_server._on_PublishRequest(fake_request2);
        publish_server.pendingPublishRequestCount.should.equal(2);

        this.clock.tick(subscription.publishingInterval * 19);
        publish_server.pendingPublishRequestCount.should.equal(2);

        this.clock.tick(subscription.publishingInterval * 3);
        publish_server.pendingPublishRequestCount.should.equal(1);


    });


    it("a server should feed the  availableSequenceNumbers in PublishResponse with sequence numbers that have not been acknowledged by the client", function () {

        var publish_server = new ServerSidePublishEngine();
        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            liveTimeCount: 1000,
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
});