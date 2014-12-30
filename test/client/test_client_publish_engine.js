require("requirish")._(module);

var subscription_service = require("lib/services/subscription_service");
var s = require("lib/datamodel/structures");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var assert = require("better-assert");
var should = require("should");
var _ = require("underscore");
var NotificationMessage = subscription_service.NotificationMessage;
var sinon = require("sinon");

var ClientSidePublishEngine = require("lib/client/client_publish_engine").ClientSidePublishEngine



describe("Testing the client publish engine", function () {

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });

    afterEach(function () {
        this.clock.restore();
    });

    it("a client should send a publish request to the server for every new subscription", function () {

        var fake_session = { publish: function (request, callback) {} };
        var spy = sinon.spy(fake_session, "publish");

        var publish_client = new ClientSidePublishEngine(fake_session);

        // start a first new subscription
        publish_client.registerSubscriptionCallback(1,function(){});

        // start a second new subscription
        publish_client.registerSubscriptionCallback(2,function(){});

        // now advance the time artificially by 4.5 seconds
        this.clock.tick(500 + 4 * 1000);

        // publish should have been called twice only ( since no Response have been received from server)
        spy.callCount.should.be.equal(2);

        // args[0] shall be a Publish Request
        spy.getCall(0).args[0]._schema.name.should.equal("PublishRequest");
        assert(_.isFunction(spy.getCall(0).args[1]));

        spy.restore();

    });

    it("a client should keep sending a new publish request to the server after receiving a notification, when a subscription is active", function () {

        var PublishResponse = require("lib/services/subscription_service").PublishResponse;
        var fake_session = { publish: function (request, callback) {
            assert(request._schema.name === "PublishRequest");
            // let simulate a server sending a PublishResponse for subscription:1
            // after a short delay of 150 milliseconds
            setTimeout(function() {
                var fake_response = new PublishResponse({subscriptionId: 1});
                callback(null,fake_response);
            },100);
        }};
        var spy = sinon.spy(fake_session, "publish");

        var publish_client = new ClientSidePublishEngine(fake_session);

        // start a first new subscription
        publish_client.registerSubscriptionCallback(1,function(){});

        // start a second new subscription
        publish_client.registerSubscriptionCallback(2,function(){});

        // now advance the time artificially by 3 seconds ( 20*150ms)
        this.clock.tick(3000);

        // publish should have been called more than 20 times
        spy.callCount.should.be.greaterThan(20);

        // args[0] shall be a Publish Request
        spy.getCall(0).args[0]._schema.name.should.equal("PublishRequest");
        assert(_.isFunction(spy.getCall(0).args[1]));

        spy.restore();

    });
    it("a client should stop sending publish request to the server after receiving a notification, when subscription has been unregistered", function () {
        var PublishResponse = require("lib/services/subscription_service").PublishResponse;
        var fake_session = { publish: function (request, callback) {
            assert(request._schema.name === "PublishRequest");
            // let simulate a server sending a PublishResponse for subscription:1
            // after a short delay of 150 milliseconds
            setTimeout(function() {
                var fake_response = new PublishResponse({subscriptionId: 1});
                callback(null,fake_response);
            },100);
        }};
        var spy = sinon.spy(fake_session, "publish");

        var publish_client = new ClientSidePublishEngine(fake_session);

        // start a first new subscription
        publish_client.registerSubscriptionCallback(1,function(){});

        // now advance the time artificially by 3 seconds ( 20*150ms)
        this.clock.tick(3000);

        // publish should have been called more than 20 times
        spy.callCount.should.be.greaterThan(20);
        var callcount_after_3sec= spy.callCount;

        // now, unregister subscription
        publish_client.unregisterSubscriptionCallback(1);

        // now advance the time artificially again by 3 seconds ( 20*150ms)
        this.clock.tick(3000);

        // publish should be called no more
        spy.callCount.should.be.equal(callcount_after_3sec);

        spy.restore();

    });

    it("a client should acknowledge sequence numbers received in PublishResponse in next PublishRequest",function(){

        // the spec says: Clients are required to acknowledge  Notification Messages as they are received.
        var response_maker = sinon.stub();

        // let create a set of fake Publish Response that would be generated by a server
        var response1 = new subscription_service.PublishResponse({
            subscriptionId: 1,
            availableSequenceNumbers : [],
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: 36,
                publishTime: new Date(),
                notificationData: [{}]
            }

        });

        var response2 = new subscription_service.PublishResponse({
            subscriptionId: 44,
            availableSequenceNumbers : [],
            moreNotifications: false,
            notificationMessage: {
                sequenceNumber: 78,
                publishTime: new Date(),
                notificationData: [{}]
            }
        });
        response_maker.onCall(0).returns([null,response1]);
        response_maker.onCall(1).returns([null,response2]);
        response_maker.onCall(2).returns([null,response2]);
        response_maker.onCall(3).returns([null,response2]);
        response_maker.onCall(4).returns([null,response2]);

        var count = 0;
        var fake_session = {
            publish: function (request, callback) {
                if (count <4) {
                    callback.apply(this,response_maker());
                    count+=1;
                }
            }
        };
        var spy = sinon.spy(fake_session, "publish");

        var publish_client = new ClientSidePublishEngine(fake_session);
        publish_client.registerSubscriptionCallback(44,function(){});
        publish_client.registerSubscriptionCallback(1, function(){});

        publish_client.keepalive_interval = 1000; // 1 second

        this.clock.tick(4500);

        spy.callCount.should.be.greaterThan(1);

        var publishRequest1 = spy.getCall(0).args[0];
        publishRequest1._schema.name.should.equal("PublishRequest");
        publishRequest1.subscriptionAcknowledgements.should.eql([]);
        this.clock.tick(50);

        var publishRequest2 = spy.getCall(1).args[0];
        publishRequest2._schema.name.should.equal("PublishRequest");
        publishRequest2.subscriptionAcknowledgements.should.eql([{ sequenceNumber: 36, subscriptionId:1 }]);

        var publishRequest3 = spy.getCall(2).args[0];
        publishRequest3._schema.name.should.equal("PublishRequest");
        publishRequest3.subscriptionAcknowledgements.should.eql([{ sequenceNumber: 78, subscriptionId:44 }]);

    });

});