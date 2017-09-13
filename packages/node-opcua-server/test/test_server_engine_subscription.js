"use strict";
var should = require("should");
var sinon = require("sinon");

var server_engine = require("../src/server_engine");
var subscription_service = require("node-opcua-service-subscription");
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var SubscriptionState = require("../src/subscription").SubscriptionState;
var PublishRequest = subscription_service.PublishRequest;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("ServerEngine Subscriptions service", function () {


    var engine, session, FolderTypeId, BaseDataVariableTypeId;

    beforeEach(function (done) {


        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {
            FolderTypeId = engine.addressSpace.findNode("FolderType").nodeId;
            BaseDataVariableTypeId = engine.addressSpace.findNode("BaseDataVariableType").nodeId;
            done();
        });
    });

    afterEach(function () {
        session = null;
        should.exist(engine);
        engine.shutdown();
        engine = null;
    });

    it("should return an error when trying to delete an non-existing subscription", function () {
        session = engine.createSession();
        session.deleteSubscription(-6789).should.eql(StatusCodes.BadSubscriptionIdInvalid);
    });

    it("should check the subscription live cycle", function () {

        session = engine.createSession();
        session.currentSubscriptionCount.should.equal(0);
        session.cumulatedSubscriptionCount.should.equal(0);

        var subscription = session.createSubscription({
            requestedPublishingInterval: 1000,  // Duration
            requestedLifetimeCount: 10,         // Counter
            requestedMaxKeepAliveCount: 10,     // Counter
            maxNotificationsPerPublish: 10,     // Counter
            publishingEnabled: true,            // Boolean
            priority: 14                        // Byte
        });
        subscription.monitoredItemCount.should.eql(0);

        session.currentSubscriptionCount.should.equal(1);
        session.cumulatedSubscriptionCount.should.equal(1);

        session.getSubscription(subscription.id).should.equal(subscription);

        var statusCode = session.deleteSubscription(subscription.id);
        statusCode.should.eql(StatusCodes.Good);

        session.currentSubscriptionCount.should.equal(0);
        session.cumulatedSubscriptionCount.should.equal(1);

        engine.currentSubscriptionCount.should.equal(0);
        engine.cumulatedSubscriptionCount.should.equal(1);

        subscription.terminate();
    });

    it("session should emit a new_subscription and subscription_terminated event", function () {

        var sinon= require("sinon");
        session = engine.createSession();
        session.currentSubscriptionCount.should.equal(0);
        session.cumulatedSubscriptionCount.should.equal(0);

        var spyNew = sinon.spy();
        var spyTerminated = sinon.spy();

        session.on("new_subscription",spyNew);
        session.on("subscription_terminated",spyTerminated);


        var subscription = session.createSubscription({
            requestedPublishingInterval: 1000,  // Duration
            requestedLifetimeCount: 10,         // Counter
            requestedMaxKeepAliveCount: 10,     // Counter
            maxNotificationsPerPublish: 10,     // Counter
            publishingEnabled: true,            // Boolean
            priority: 14                        // Byte
        });

        spyNew.callCount.should.eql(1);
        spyTerminated.callCount.should.eql(0);

        var statusCode = session.deleteSubscription(subscription.id);

        spyNew.callCount.should.eql(1);
        spyTerminated.callCount.should.eql(1);

        session.removeListener("new_subscription",spyNew);
        session.removeListener("subscription_terminated",spyTerminated);
    });

    it("should maintain the correct number of cumulatedSubscriptionCount at the engine level", function () {

        session = engine.createSession();
        var subscription_parameters = {
            requestedPublishingInterval: 1000,  // Duration
            requestedLifetimeCount: 10,         // Counter
            requestedMaxKeepAliveCount: 10,     // Counter
            maxNotificationsPerPublish: 10,     // Counter
            publishingEnabled: true,            // Boolean
            priority: 14                        // Byte
        };

        engine.currentSubscriptionCount.should.equal(0);
        engine.cumulatedSubscriptionCount.should.equal(0);

        engine.currentSessionCount.should.equal(1);
        engine.cumulatedSessionCount.should.equal(1);

        var subscription1 = session.createSubscription(subscription_parameters);

        engine.currentSubscriptionCount.should.equal(1);
        engine.cumulatedSubscriptionCount.should.equal(1);

        var subscription2 = session.createSubscription(subscription_parameters);
        engine.currentSubscriptionCount.should.equal(2);
        engine.cumulatedSubscriptionCount.should.equal(2);

        session.deleteSubscription(subscription2.id);
        engine.currentSubscriptionCount.should.equal(1);
        engine.cumulatedSubscriptionCount.should.equal(2);


        // Create a new session
        var session2 = engine.createSession();
        engine.currentSessionCount.should.equal(2);
        engine.cumulatedSessionCount.should.equal(2);
        engine.currentSubscriptionCount.should.equal(1);

        var subscription1_2 = session2.createSubscription(subscription_parameters);
        var subscription2_2 = session2.createSubscription(subscription_parameters);
        var subscription3_2 = session2.createSubscription(subscription_parameters);

        engine.currentSubscriptionCount.should.equal(4);
        engine.cumulatedSubscriptionCount.should.equal(5);

        // close the session, asking to delete subscriptions
        engine.closeSession(session2.authenticationToken, /* deleteSubscription */true);

        engine.currentSessionCount.should.equal(1);
        engine.cumulatedSessionCount.should.equal(2);
        engine.currentSubscriptionCount.should.equal(1);
        engine.cumulatedSubscriptionCount.should.equal(5);


        session.deleteSubscription(subscription1.id);

        engine.currentSubscriptionCount.should.equal(0);
        engine.cumulatedSubscriptionCount.should.equal(5);


    });

    it("DDD delete a subscription with 2 outstanding PublishRequest",function() {

        session = engine.createSession();

        // CTT : deleteSub5106004
        var subscription_parameters = {
            requestedPublishingInterval: 1000,  // Duration
            requestedLifetimeCount:      10,    // Counter
            requestedMaxKeepAliveCount:  10,    // Counter
            maxNotificationsPerPublish:  10,    // Counter
            publishingEnabled: true,            // Boolean
            priority: 14                        // Byte
        };

        var subscription1 = session.createSubscription(subscription_parameters);

        var publishSpy = sinon.spy();
        var o1 = {requestHeader:{ requestHandle: 100}};
        session.publishEngine._on_PublishRequest(new PublishRequest(o1),publishSpy );
        var o2 = {requestHeader:{ requestHandle: 101}};
        session.publishEngine._on_PublishRequest(new PublishRequest(o2),publishSpy );


        publishSpy.callCount.should.eql(0);

        session.deleteSubscription(subscription1.id);
        // after subscription has been deleted, the 2 outstanding publish request shall
        // be completed
        publishSpy.callCount.should.eql(2);
        console.log(publishSpy.getCall(0).args[0].toString());
        console.log(publishSpy.getCall(0).args[1].toString());
        publishSpy.getCall(0).args[1].responseHeader.requestHandle.should.eql(100);
        publishSpy.getCall(1).args[1].responseHeader.requestHandle.should.eql(101);
        publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
        publishSpy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);

    });


    function with_fake_timer(workerFunc) {

        var test = this;
        test.clock = sinon.useFakeTimers();
        var the_err;
        try{
            workerFunc.call(this);
        }
        catch(err) {
            the_err = err;
        }
        test.clock.restore();
        if (the_err) {
            throw the_err;
        }
    }

    it("ZDZ create and terminate 2 subscriptions , with 4 publish requests", function () {

        with_fake_timer.call(this,function() {

            session = engine.createSession({sessionTimeout: 100000000 });

            var test = this;

            var SubscriptionState = require("../src/subscription").SubscriptionState;

            // CTT : deleteSub5106004
            var subscription_parameters = {
                requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount:      60,    // Counter
                requestedMaxKeepAliveCount:  10,    // Counter
                maxNotificationsPerPublish:  10,    // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            };

            var subscription1 = session.createSubscription(subscription_parameters);
            subscription1.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription1.publishingInterval);
            subscription1.state.should.eql(SubscriptionState.LATE);

            session.deleteSubscription(subscription1.id);
            subscription1.state.should.eql(SubscriptionState.CLOSED);

            var subscription2 = session.createSubscription(subscription_parameters);
            subscription2.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription2.publishingInterval);
            subscription2.state.should.eql(SubscriptionState.LATE);


            var publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 100}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 101}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 102}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 103}}),publishSpy );

            test.clock.tick(subscription2.publishingInterval);
            subscription2.state.should.eql(SubscriptionState.KEEPALIVE);

            session.deleteSubscription(subscription2.id);
            subscription2.state.should.eql(SubscriptionState.CLOSED);

            publishSpy.callCount.should.eql(4);

            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].subscriptionId.should.eql(subscription2.id);
            publishSpy.getCall(0).args[1].notificationMessage.notificationData.length.should.eql(0);

            publishSpy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(2).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(3).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);

            engine.closeSession(session.authenticationToken,true,"CloseSession");

        });


    });

    it("ZDZ LifeTimeCount, the publish engine shall send a StatusChangeNotification to inform that a subscription has been closed because of LifeTime timeout - with 2 subscriptions", function () {

        with_fake_timer.call(this,function() {
            var test = this;

            session = engine.createSession({sessionTimeout: 100000000 });

            // CTT : deleteSub5106004
            var subscription_parameters = {
                requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount:      60,    // Counter
                requestedMaxKeepAliveCount:  10,    // Counter
                maxNotificationsPerPublish:  10,    // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            };

            var subscription1 = session.createSubscription(subscription_parameters);
            subscription1.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription1.publishingInterval);
            subscription1.state.should.eql(SubscriptionState.LATE);

            test.clock.tick(subscription1.publishingInterval * subscription1.lifeTimeCount);
            subscription1.state.should.eql(SubscriptionState.CLOSED);

            var subscription2 = session.createSubscription(subscription_parameters);
            subscription2.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription2.publishingInterval);
            subscription2.state.should.eql(SubscriptionState.LATE);


            var publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 101}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 102}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 103}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 104}}),publishSpy );

            session.deleteSubscription(subscription2.id);
            test.clock.tick(subscription2.publishingInterval);

            publishSpy.callCount.should.eql(4);
            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].subscriptionId.should.eql(subscription2.id);
            publishSpy.getCall(0).args[1].notificationMessage.notificationData.length.should.eql(0);

            //xx console.log(publishSpy.getCall(1).args[1].toString());
            publishSpy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(1).args[1].notificationMessage.notificationData[0].statusCode.should.eql(StatusCodes.BadTimeout);

            publishSpy.getCall(2).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(3).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);

            engine.closeSession(session.authenticationToken,true,"CloseSession");

        });

    });

    it("AZQ should receive StatusChangeNotification from first subscription even if publishRequest arrives late",function(done){

        // given a subscription with monitored Item
        // given that the client doesn't send Publish Request
        // When the subscription times out and closed
        // And  When the client send a PublishRequest notification
        // Then the client shall receive the StatusChangeNotification
        with_fake_timer.call(this,function() {
            var test = this;

            session = engine.createSession({sessionTimeout: 100000000});

            // CTT : deleteSub5106004
            var subscription_parameters = {
                requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount:        60,    // Counter
                requestedMaxKeepAliveCount:    10,    // Counter
                maxNotificationsPerPublish:    10,    // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            };

            var subscription1 = session.createSubscription(subscription_parameters);
            subscription1.state.should.eql(SubscriptionState.CREATING);

            // wait until session expired by timeout
            test.clock.tick(subscription1.publishingInterval * subscription1.lifeTimeCount);

            var publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 101}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 102}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 103}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 104}}),publishSpy );


            publishSpy.callCount.should.eql(4);

            publishSpy.getCall(0).args[1].subscriptionId.should.eql(subscription1.subscriptionId);
            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].notificationMessage.sequenceNumber.should.eql(1);
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].statusCode.should.eql(StatusCodes.BadTimeout);

            publishSpy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(1).args[1].subscriptionId.should.eql(0xffffffff);
            publishSpy.getCall(1).args[1].notificationMessage.sequenceNumber.should.eql(0);
            publishSpy.getCall(1).args[1].notificationMessage.notificationData.length.should.eql(0);

            publishSpy.getCall(2).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(2).args[1].subscriptionId.should.eql(0xffffffff);
            publishSpy.getCall(2).args[1].notificationMessage.sequenceNumber.should.eql(0);
            publishSpy.getCall(2).args[1].notificationMessage.notificationData.length.should.eql(0);

            publishSpy.getCall(3).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(3).args[1].subscriptionId.should.eql(0xffffffff);
            publishSpy.getCall(3).args[1].notificationMessage.sequenceNumber.should.eql(0);
            publishSpy.getCall(3).args[1].notificationMessage.notificationData.length.should.eql(0);

            engine.closeSession(session.authenticationToken,true,"CloseSession");
            done();
        });
    });

    it("AZW should receive StatusChangeNotification from first subscription even if publishRequest arrives late",function(done){

        // given a subscription with monitored Item
        // given that the client doesn't send Publish Request
        // When the subscription times out and closed
        // And  When the client send a PublishRequest notification
        // Then the client shall receive the StatusChangeNotification
        with_fake_timer.call(this,function() {
            var test = this;

            session = engine.createSession({sessionTimeout: 100000000});

            // CTT : deleteSub5106004
            var subscription_parameters = {
                requestedPublishingInterval: 1000,  // Duration
                requestedLifetimeCount:        60,    // Counter
                requestedMaxKeepAliveCount:    10,    // Counter
                maxNotificationsPerPublish:    10,    // Counter
                publishingEnabled: true,            // Boolean
                priority: 14                        // Byte
            };

            var subscription1 = session.createSubscription(subscription_parameters);
            subscription1.state.should.eql(SubscriptionState.CREATING);

            // wait until session expired by timeout
            test.clock.tick(subscription1.publishingInterval * subscription1.lifeTimeCount);


            var subscription2 = session.createSubscription(subscription_parameters);
            subscription2.state.should.eql(SubscriptionState.CREATING);

            var publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 101}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 102}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 103}}),publishSpy );
            session.publishEngine._on_PublishRequest(new PublishRequest({requestHeader:{ requestHandle: 104}}),publishSpy );

            publishSpy.callCount.should.eql(1);
            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].notificationMessage.sequenceNumber.should.eql(1);
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].statusCode.should.eql(StatusCodes.BadTimeout);

            engine.closeSession(session.authenticationToken,true,"CloseSession");
            done();
        });
    });
});
