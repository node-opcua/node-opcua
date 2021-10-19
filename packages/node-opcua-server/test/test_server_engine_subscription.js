"use strict";
const should = require("should");
const sinon = require("sinon");

const { MonitoringMode, PublishRequest } = require("node-opcua-service-subscription");
const { StatusCodes, StatusCode } = require("node-opcua-status-code");
const { TimestampsToReturn } = require("node-opcua-service-read");
const { MonitoredItemCreateRequest } = require("node-opcua-service-subscription");

const { get_mini_nodeset_filename } = require("node-opcua-address-space/testHelpers");

const { ServerEngine, SubscriptionState } = require("..");
const { with_fake_timer } = require("./helper_with_fake_timer");

const mini_nodeset_filename = get_mini_nodeset_filename();

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("ServerEngine Subscriptions service", function () {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;

    /**
     * @type {ServerEngine}
     */
    let engine;
    /**
     * @type {ServerSession}
     */
    let session;
    /**
     * @type {NodeId}
     */
    let FolderTypeId, BaseDataVariableTypeId;

    beforeEach(function (done) {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: mini_nodeset_filename }, function () {
            FolderTypeId = engine.addressSpace.findNode("FolderType").nodeId;
            BaseDataVariableTypeId = engine.addressSpace.findNode("BaseDataVariableType").nodeId;
            done();
        });
    });

    afterEach(async () => {
        session = null;
        should.exist(engine);
        await engine.shutdown();
        engine = null;
    });

    it("should return an error when trying to delete an non-existing subscription", async () => {
        session = engine.createSession();
        const statusCode = await session.deleteSubscription(-6789);
        statusCode.should.eql(StatusCodes.BadSubscriptionIdInvalid);
    });

    it("should check the subscription live cycle", async () => {
        session = engine.createSession();
        session.currentSubscriptionCount.should.equal(0);
        session.cumulatedSubscriptionCount.should.equal(0);

        const subscription = session.createSubscription({
            requestedPublishingInterval: 1000, // Duration
            requestedLifetimeCount: 10, // Counter
            requestedMaxKeepAliveCount: 10, // Counter
            maxNotificationsPerPublish: 10, // Counter
            publishingEnabled: true, // Boolean
            priority: 14 // Byte
        });
        subscription.monitoredItemCount.should.eql(0);

        session.currentSubscriptionCount.should.equal(1);
        session.cumulatedSubscriptionCount.should.equal(1);

        session.getSubscription(subscription.id).should.equal(subscription);

        const statusCode = await session.deleteSubscription(subscription.id);
        statusCode.should.eql(StatusCodes.Good);

        session.currentSubscriptionCount.should.equal(0);
        session.cumulatedSubscriptionCount.should.equal(1);

        engine.currentSubscriptionCount.should.equal(0);
        engine.cumulatedSubscriptionCount.should.equal(1);

        subscription.terminate();
        subscription.dispose();
    });

    it("XCX session should emit a new_subscription and subscription_terminated event", async () => {
        session = engine.createSession();

        session.currentSubscriptionCount.should.equal(0);
        session.cumulatedSubscriptionCount.should.equal(0);

        const spyNew = sinon.spy();
        const spyTerminated = sinon.spy();

        session.on("new_subscription", spyNew);
        session.on("subscription_terminated", spyTerminated);

        const subscription = session.createSubscription({
            requestedPublishingInterval: 1000, // Duration
            requestedLifetimeCount: 10, // Counter
            requestedMaxKeepAliveCount: 10, // Counter
            maxNotificationsPerPublish: 10, // Counter
            publishingEnabled: true, // Boolean
            priority: 14 // Byte
        });

        session.currentSubscriptionCount.should.equal(1);
        session.cumulatedSubscriptionCount.should.equal(1);

        spyNew.callCount.should.eql(1);
        spyTerminated.callCount.should.eql(0);

        const statusCode = await session.deleteSubscription(subscription.id);
        statusCode.should.be.instanceOf(StatusCode);

        spyNew.callCount.should.eql(1);
        spyTerminated.callCount.should.eql(1);

        session.removeListener("new_subscription", spyNew);
        session.removeListener("subscription_terminated", spyTerminated);

        session.currentSubscriptionCount.should.equal(0);
        session.cumulatedSubscriptionCount.should.equal(1);
    });

    it("should maintain the correct number of cumulatedSubscriptionCount at the engine level", async () => {
        session = engine.createSession();
        const subscription_parameters = {
            requestedPublishingInterval: 1000, // Duration
            requestedLifetimeCount: 10, // Counter
            requestedMaxKeepAliveCount: 10, // Counter
            maxNotificationsPerPublish: 10, // Counter
            publishingEnabled: true, // Boolean
            priority: 14 // Byte
        };

        engine.currentSubscriptionCount.should.equal(0);
        engine.cumulatedSubscriptionCount.should.equal(0);

        engine.currentSessionCount.should.equal(1);
        engine.cumulatedSessionCount.should.equal(1);

        const subscription1 = session.createSubscription(subscription_parameters);

        engine.currentSubscriptionCount.should.equal(1);
        engine.cumulatedSubscriptionCount.should.equal(1);

        const subscription2 = session.createSubscription(subscription_parameters);
        engine.currentSubscriptionCount.should.equal(2);
        engine.cumulatedSubscriptionCount.should.equal(2);

        await session.deleteSubscription(subscription2.id);
        engine.currentSubscriptionCount.should.equal(1);
        engine.cumulatedSubscriptionCount.should.equal(2);

        // Create a new session
        const session2 = engine.createSession();
        engine.currentSessionCount.should.equal(2);
        engine.cumulatedSessionCount.should.equal(2);
        engine.currentSubscriptionCount.should.equal(1);

        const subscription1_2 = session2.createSubscription(subscription_parameters);
        const subscription2_2 = session2.createSubscription(subscription_parameters);
        const subscription3_2 = session2.createSubscription(subscription_parameters);

        engine.currentSubscriptionCount.should.equal(4);
        engine.cumulatedSubscriptionCount.should.equal(5);

        // close the session, asking to delete subscriptions
        await engine.closeSession(session2.authenticationToken, /* deleteSubscriptions */ true);

        engine.currentSessionCount.should.equal(1);
        engine.cumulatedSessionCount.should.equal(2);
        engine.currentSubscriptionCount.should.equal(1);
        engine.cumulatedSubscriptionCount.should.equal(5);

        await session.deleteSubscription(subscription1.id);

        engine.currentSubscriptionCount.should.equal(0);
        engine.cumulatedSubscriptionCount.should.equal(5);
    });

    it("DDD delete a subscription with 2 outstanding PublishRequest", async () => {
        session = engine.createSession();

        // CTT : deleteSub5106004
        const subscription_parameters = {
            requestedPublishingInterval: 1000, // Duration
            requestedLifetimeCount: 10, // Counter
            requestedMaxKeepAliveCount: 10, // Counter
            maxNotificationsPerPublish: 10, // Counter
            publishingEnabled: true, // Boolean
            priority: 14 // Byte
        };

        const subscription1 = session.createSubscription(subscription_parameters);

        const publishSpy = sinon.spy();
        const o1 = { requestHeader: { requestHandle: 100 } };
        session.publishEngine._on_PublishRequest(new PublishRequest(o1), publishSpy);
        const o2 = { requestHeader: { requestHandle: 101 } };
        session.publishEngine._on_PublishRequest(new PublishRequest(o2), publishSpy);

        publishSpy.callCount.should.eql(0);

        await session.deleteSubscription(subscription1.id);
        // after subscription has been deleted, the 2 outstanding publish request shall
        // be completed
        publishSpy.callCount.should.eql(2);
        //xx console.log(publishSpy.getCall(0).args[0].toString());
        //xx console.log(publishSpy.getCall(0).args[1].toString());
        publishSpy.getCall(0).args[1].responseHeader.requestHandle.should.eql(100);
        publishSpy.getCall(1).args[1].responseHeader.requestHandle.should.eql(101);
        publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
        publishSpy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
    });

    it("ZDZ-1 create and terminate 2 subscriptions , with 4 publish requests", async () => {
        await with_fake_timer.call(test, async () => {
            session = engine.createSession({ sessionTimeout: 100000000 });

            // CTT : deleteSub5106004
            const subscription_parameters = {
                requestedPublishingInterval: 1000, // Duration
                requestedLifetimeCount: 60, // Counter
                requestedMaxKeepAliveCount: 10, // Counter
                maxNotificationsPerPublish: 10, // Counter
                publishingEnabled: true, // Boolean
                priority: 14 // Byte
            };

            const subscription1 = session.createSubscription(subscription_parameters);
            subscription1.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription1.publishingInterval);
            subscription1.state.should.eql(SubscriptionState.LATE);

            await session.deleteSubscription(subscription1.id);
            subscription1.state.should.eql(SubscriptionState.CLOSED);

            const subscription2 = session.createSubscription(subscription_parameters);
            subscription2.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription2.publishingInterval);
            subscription2.state.should.eql(SubscriptionState.LATE);

            const publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 100 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 101 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 102 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 103 } }), publishSpy);

            test.clock.tick(subscription2.publishingInterval);
            subscription2.state.should.eql(SubscriptionState.KEEPALIVE);

            await session.deleteSubscription(subscription2.id);
            subscription2.state.should.eql(SubscriptionState.CLOSED);

            publishSpy.callCount.should.eql(4);

            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].subscriptionId.should.eql(subscription2.id);
            publishSpy.getCall(0).args[1].notificationMessage.notificationData.length.should.eql(0);

            publishSpy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(2).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(3).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);

            await engine.closeSession(session.authenticationToken, true, "CloseSession");
        });
    });

    it("ZDZ-2 LifeTimeCount, the publish engine shall send a StatusChangeNotification to inform that a subscription has been closed because of lifetime timeout - with 2 subscriptions", async () => {
        await with_fake_timer.call(test, async () => {
            session = engine.createSession({
                sessionTimeout: 100000000
            });

            // CTT : deleteSub5106004
            const subscription_parameters = {
                requestedPublishingInterval: 1000, // Duration
                requestedLifetimeCount: 60, // Counter
                requestedMaxKeepAliveCount: 10, // Counter
                maxNotificationsPerPublish: 10, // Counter
                publishingEnabled: true, // Boolean
                priority: 14 // Byte
            };

            const subscription1 = session.createSubscription(subscription_parameters);
            //xx console.log("subscription1", subscription1.subscriptionId);

            subscription1.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription1.publishingInterval);
            subscription1.state.should.eql(SubscriptionState.LATE);

            // wait until subscription expires entirely
            test.clock.tick(subscription1.publishingInterval * subscription1.lifeTimeCount);
            subscription1.state.should.eql(SubscriptionState.CLOSED);

            const subscription2 = session.createSubscription(subscription_parameters);
            //xx console.log("subscription2", subscription2.subscriptionId);
            subscription2.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription2.publishingInterval);
            subscription2.state.should.eql(SubscriptionState.LATE);

            const publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 101 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 102 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 103 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 104 } }), publishSpy);

            test.clock.tick(subscription2.publishingInterval);

            await session.deleteSubscription(subscription2.id);
            test.clock.tick(subscription2.publishingInterval);

            publishSpy.callCount.should.eql(4);
            // console.log(publishSpy.getCall(0).args[1].toString());
            // console.log(publishSpy.getCall(1).args[1].toString());
            // console.log(publishSpy.getCall(2).args[1].toString());
            // console.log(publishSpy.getCall(3).args[1].toString());

            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].subscriptionId.should.eql(subscription1.id);
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].status.should.eql(StatusCodes.BadTimeout);

            publishSpy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(1).args[1].subscriptionId.should.eql(subscription2.id);
            publishSpy.getCall(1).args[1].notificationMessage.notificationData.length.should.eql(0);

            publishSpy.getCall(2).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(3).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);

            await engine.closeSession(session.authenticationToken, true, "CloseSession");
        });
    });

    it("AZQ should receive StatusChangeNotification from first subscription even if publishRequest arrives late", async () => {
        // given a subscription with monitored Item
        // given that the client doesn't send Publish Request
        // When the subscription times out and closed
        // And  When the client send a PublishRequest notification
        // Then the client shall receive the StatusChangeNotification
        await with_fake_timer.call(test, async () => {
            session = engine.createSession({ sessionTimeout: 100000000 });

            // CTT : deleteSub5106004
            const subscription_parameters = {
                requestedPublishingInterval: 1000, // Duration
                requestedLifetimeCount: 60, // Counter
                requestedMaxKeepAliveCount: 10, // Counter
                maxNotificationsPerPublish: 10, // Counter
                publishingEnabled: true, // Boolean
                priority: 14 // Byte
            };

            const subscription1 = session.createSubscription(subscription_parameters);
            subscription1.state.should.eql(SubscriptionState.CREATING);

            // wait until session expired by timeout
            test.clock.tick(subscription1.publishingInterval * subscription1.lifeTimeCount);

            const publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 101 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 102 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 103 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 104 } }), publishSpy);

            publishSpy.callCount.should.eql(4);

            publishSpy.getCall(0).args[1].subscriptionId.should.eql(subscription1.subscriptionId);
            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].notificationMessage.sequenceNumber.should.eql(1);
            publishSpy
                .getCall(0)
                .args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].status.should.eql(StatusCodes.BadTimeout);

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

            await engine.closeSession(session.authenticationToken, true, "CloseSession");
        });
    });

    it("AZW1 should receive StatusChangeNotification from first subscription even if publishRequest arrives late", async () => {
        // given a subscription with monitored Item
        // given that the client doesn't send Publish Request
        // When the subscription times out and closed
        // And  When the client send a PublishRequest notification
        // Then the client shall receive the StatusChangeNotification
        await with_fake_timer.call(test, async () => {
            session = engine.createSession({ sessionTimeout: 100000000 });

            // CTT : deleteSub5106004
            const subscription_parameters = {
                requestedPublishingInterval: 1000, // Duration
                requestedLifetimeCount: 60, // Counter
                requestedMaxKeepAliveCount: 10, // Counter
                maxNotificationsPerPublish: 10, // Counter
                publishingEnabled: true, // Boolean
                priority: 14 // Byte
            };

            const subscription1 = session.createSubscription(subscription_parameters);
            subscription1.state.should.eql(SubscriptionState.CREATING);

            // wait until session expired by timeout
            test.clock.tick(subscription1.publishingInterval * subscription1.lifeTimeCount);

            const subscription2 = session.createSubscription(subscription_parameters);
            subscription2.state.should.eql(SubscriptionState.CREATING);

            const publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 101 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 102 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 103 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 104 } }), publishSpy);

            publishSpy.callCount.should.eql(1);
            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].notificationMessage.sequenceNumber.should.eql(1);
            publishSpy
                .getCall(0)
                .args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].status.should.eql(StatusCodes.BadTimeout);

            await engine.closeSession(session.authenticationToken, true, "CloseSession");
        });
    });

    it("AZW2 should terminate a orphan subscription containing monitored items", async () => {
        // given a client session
        // given a subscription with monitored Item
        // given that the client close the session without deleting the subscription
        // When the orphan subscription times out
        // Then subscription shall be disposed

        await with_fake_timer.call(test, async () => {
            session = engine.createSession({ sessionTimeout: 100000000 });

            const subscription_parameters = {
                requestedPublishingInterval: 100, // Duration
                requestedLifetimeCount: 60, // Counter
                requestedMaxKeepAliveCount: 30, // Counter
                maxNotificationsPerPublish: 1000, // Counter
                publishingEnabled: true, // Boolean
                priority: 14 // Byte
            };

            const subscription = session.createSubscription(subscription_parameters);
            subscription.state.should.eql(SubscriptionState.CREATING);

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = function () {
                    /** */
                };
            });

            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: { nodeId: "ns=0;i=2258" },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    clientHandle: 123,
                    queueSize: 10,
                    samplingInterval: 100
                }
            });

            const createResult = subscription.createMonitoredItem(
                engine.addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            createResult.statusCode.should.eql(StatusCodes.Good);

            const deleteSubscriptions = false;
            engine.closeSession(session.authenticationToken, deleteSubscriptions, "CloseSession");

            // wait until subscription expired by timeout
            test.clock.tick(subscription.publishingInterval * subscription.lifeTimeCount);
        });
    });
});
