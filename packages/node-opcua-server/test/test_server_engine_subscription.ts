"use strict";
import should from "should";
import sinon from "sinon";

import { NodeId } from "node-opcua-nodeid";
import { MonitoringMode, PublishRequest } from "node-opcua-service-subscription";
import { StatusCodes, StatusCode } from "node-opcua-status-code";
import { TimestampsToReturn } from "node-opcua-service-read";
import { MonitoredItemCreateRequest } from "node-opcua-service-subscription";
import { ServiceFault, PublishResponse } from "node-opcua-types";

import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";

import { ServerEngine, ServerSession, SubscriptionState } from "../source";
import { with_fake_timer } from "./helper_with_fake_timer";

const mini_nodeset_filename = get_mini_nodeset_filename();

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("ServerEngine Subscriptions service", function (this: any) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;

    /**
     * @type {ServerEngine}
     */
    let engine: ServerEngine;
    /**
     * @type {ServerSession}
     */
    let session: ServerSession;
    /**
     * @type {NodeId}
     */
    let FolderTypeId: NodeId;
    let BaseDataVariableTypeId: NodeId;

    beforeEach(function (done) {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: mini_nodeset_filename }, function () {
            FolderTypeId = engine.addressSpace!.findNode("FolderType")!.nodeId;
            BaseDataVariableTypeId = engine.addressSpace!.findNode("BaseDataVariableType")!.nodeId;
            done();
        });
    });

    afterEach(async () => {
        should.exist(engine);
        await engine.shutdown();
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

        session.getSubscription(subscription.id)!.should.equal(subscription);

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
        await engine.closeSession(session2.authenticationToken, /* deleteSubscriptions */ true, "CloseSession");

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
            subscription1.messageSent.should.eql(false);

            await session.deleteSubscription(subscription1.id);
            subscription1.state.should.eql(SubscriptionState.CLOSED);

            const subscription2 = session.createSubscription(subscription_parameters);
            subscription2.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription2.publishingInterval * subscription2.maxKeepAliveCount);
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

    it("ZDZ-2 LifetimeCount, the publish engine shall send a StatusChangeNotification to inform that a subscription has been closed because of lifetime timeout - with 2 subscriptions", async () => {
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
            subscription1.publishingInterval.should.eql(1000);
            subscription1.maxKeepAliveCount.should.eql(10);
            subscription1.lifeTimeCount.should.eql(60);

            subscription1.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription1.publishingInterval);
            subscription1.state.should.eql(SubscriptionState.LATE);

            test.clock.tick(subscription1.publishingInterval * subscription1.maxKeepAliveCount);
            subscription1.state.should.eql(SubscriptionState.LATE);

            // wait until subscription expires entirely
            test.clock.tick(subscription1.publishingInterval * subscription1.maxKeepAliveCount);
            subscription1.state.should.eql(SubscriptionState.LATE);

            test.clock.tick(subscription1.publishingInterval * subscription1.lifeTimeCount);
            subscription1.state.should.eql(SubscriptionState.CLOSED);

            const subscription2 = session.createSubscription(subscription_parameters);
            //xx console.log("subscription2", subscription2.subscriptionId);
            subscription2.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription2.publishingInterval * subscription2.maxKeepAliveCount);
            subscription2.state.should.eql(SubscriptionState.LATE);

            const publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 101 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 102 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 103 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 104 } }), publishSpy);

            test.clock.tick(subscription2.publishingInterval); //  * subscription2.maxKeepAliveCount);

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

            // wait until session expired by being late
            test.clock.tick(subscription1.publishingInterval * subscription1.maxKeepAliveCount);
            test.clock.tick(subscription1.publishingInterval * subscription1.lifeTimeCount);

            subscription1.state.should.eql(SubscriptionState.CLOSED);
            subscription1.messageSent.should.eql(false);

            const publishSpy = sinon.spy();
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 101 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 102 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 103 } }), publishSpy);
            session.publishEngine._on_PublishRequest(new PublishRequest({ requestHeader: { requestHandle: 104 } }), publishSpy);

            test.clock.tick(subscription1.publishingInterval * 2);

            publishSpy.getCall(0).args[1].subscriptionId.should.eql(subscription1.subscriptionId);
            publishSpy.getCall(0).args[1].responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishSpy.getCall(0).args[1].notificationMessage.sequenceNumber.should.eql(1);
            publishSpy
                .getCall(0)
                .args[1].notificationMessage.notificationData[0].constructor.name.should.eql("StatusChangeNotification");
            publishSpy.getCall(0).args[1].notificationMessage.notificationData[0].status.should.eql(StatusCodes.BadTimeout);

            publishSpy.callCount.should.eql(4);

            publishSpy.getCall(1).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(1).args[1].should.be.instanceOf(ServiceFault);
            // publishSpy.getCall(1).args[1].subscriptionId.should.eql(0xffffffff);
            // publishSpy.getCall(1).args[1].notificationMessage.sequenceNumber.should.eql(0);
            // publishSpy.getCall(1).args[1].notificationMessage.notificationData.length.should.eql(0);

            publishSpy.getCall(2).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(2).args[1].should.be.instanceOf(ServiceFault);
            // publishSpy.getCall(2).args[1].subscriptionId.should.eql(0xffffffff);
            // publishSpy.getCall(2).args[1].notificationMessage.sequenceNumber.should.eql(0);
            // publishSpy.getCall(2).args[1].notificationMessage.notificationData.length.should.eql(0);

            publishSpy.getCall(3).args[1].responseHeader.serviceResult.should.eql(StatusCodes.BadNoSubscription);
            publishSpy.getCall(3).args[1].should.be.instanceOf(ServiceFault);
            // publishSpy.getCall(3).args[1].subscriptionId.should.eql(0xffffffff);
            // publishSpy.getCall(3).args[1].notificationMessage.sequenceNumber.should.eql(0);
            // publishSpy.getCall(3).args[1].notificationMessage.notificationData.length.should.eql(0);

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

            // wait until session expired by being late
            test.clock.tick(subscription1.publishingInterval * subscription1.maxKeepAliveCount);

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

            const createResult = await subscription.createMonitoredItem(
                engine.addressSpace!,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            createResult.statusCode.should.eql(StatusCodes.Good);

            const deleteSubscriptions = false;
            engine.closeSession(session.authenticationToken, deleteSubscriptions, "CloseSession");

            // wait until session expired by being late
            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount);
            // wait until subscription expired by timeout
            test.clock.tick(subscription.publishingInterval * subscription.lifeTimeCount);
        });
    });

    it("AZW3 empty subscription should send their first keep alive after one publishing Interval and then after maxKeepAliveCount*publishing Interval ", async () => {
        const publishSpy = sinon.spy();
        let requestHandle = 100;
        const sendPublishRequest = async () => {
            if (!session.publishEngine) throw new Error("expecting session.publishEngine to be defined");

            session.publishEngine._on_PublishRequest(
                new PublishRequest({
                    requestHeader: {
                        requestHandle,
                        timestamp: new Date()
                    }
                }),
                publishSpy
            );
            requestHandle++;
        };

        await with_fake_timer.call(test, async () => {
            if (!engine) throw new Error("expecting engine to be defined");

            session = engine.createSession({ sessionTimeout: 100000000 });
            if (!session) throw new Error("expecting session to be defined");

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
            const creationDate = new Date();

            await sendPublishRequest();
            test.clock.tick(subscription1.publishingInterval);
            publishSpy.callCount.should.eql(1);

            await sendPublishRequest();
            test.clock.tick(subscription1.publishingInterval * 11);
            publishSpy.callCount.should.eql(2);

            await engine.closeSession(session.authenticationToken, true, "CloseSession");

            // -------------------------- First PublishResponse -- should be a keep alive
            const publishResponse1 = publishSpy.getCall(0).args[1] as PublishResponse;
            // console.log(publishResponse1.toString());
            publishResponse1.subscriptionId.should.eql(subscription1.subscriptionId);
            publishResponse1.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishResponse1.notificationMessage.sequenceNumber.should.eql(1);
            publishResponse1.notificationMessage.notificationData!.length.should.eql(0);
            publishResponse1.responseHeader.requestHandle.should.eql(100);

            // -------------------------- Second PublishResponse -- should be a keep alive
            const publishResponse2 = publishSpy.getCall(1).args[1] as PublishResponse;
            // console.log(publishResponse2.toString());
            publishResponse2.subscriptionId.should.eql(subscription1.subscriptionId);
            publishResponse2.responseHeader.serviceResult.should.eql(StatusCodes.Good);
            publishResponse2.notificationMessage.sequenceNumber.should.eql(1);
            publishResponse2.notificationMessage.notificationData!.length.should.eql(0);
            publishResponse2.responseHeader.requestHandle.should.eql(101);

            // verify that the first keep alive message was sent after  1 time publishing interval milliseconds
            const resultDate1 = publishResponse1.responseHeader.timestamp!;
            const delayBetweenCreateAndFirstKeepAlive = resultDate1.getTime() - creationDate.getTime();
            console.log("delayBetweenCreateAndFirstKeepAlive", delayBetweenCreateAndFirstKeepAlive);
            delayBetweenCreateAndFirstKeepAlive.should.be.approximately(0, 100);

            // verify that the delay between the first and second keep alive is approximately 10 x publishingInterval
            const resultDate2 = publishResponse2.responseHeader.timestamp!;
            const delayBetweenFirstAndSecondKeepAlive = resultDate2.getTime() - resultDate1.getTime();
            console.log("delayBetweenFirstAndSecondKeepAlive", delayBetweenFirstAndSecondKeepAlive);
            delayBetweenFirstAndSecondKeepAlive.should.be.approximately(1000 * 10, 100);
        });
    });

    it("AZW4 processing PublishRequest when subscription is LATE", async () => {
        const publishSpy = sinon.spy();

        const subscription_parameters = {
            requestedPublishingInterval: 1000, // Duration
            requestedLifetimeCount: 60, // Counter
            requestedMaxKeepAliveCount: 10, // Counter
            maxNotificationsPerPublish: 10, // Counter
            publishingEnabled: true, // Boolean
            priority: 14 // Byte
        };

        const dateKeepAlive: Date[] = [];
        const datePublishRequest: Date[] = [];
        const waitTime =
            (subscription_parameters.requestedPublishingInterval * subscription_parameters.requestedMaxKeepAliveCount) / 2;

        const publishByMaxKeep =
            subscription_parameters.requestedPublishingInterval * subscription_parameters.requestedMaxKeepAliveCount;
        await with_fake_timer.call(test, async () => {
            if (!engine) throw new Error("expecting engine to be defined");
            session = engine.createSession({ sessionTimeout: 100000000 });
            const subscription1 = session.createSubscription(subscription_parameters);


            subscription1.state.should.eql(SubscriptionState.CREATING);

            subscription1.on("keepalive", (count) => {
                dateKeepAlive.push(new Date());
            });

            const sendPublishRequest = async () => {
                if (!session.publishEngine) throw new Error("expecting session.publishEngine to be defined");

                const timestamp = new Date();
                datePublishRequest.push(timestamp);
                session.publishEngine._on_PublishRequest(
                    new PublishRequest({
                        requestHeader: {
                            requestHandle: 101,
                            timestamp
                        }
                    }),
                    publishSpy
                );
                test.clock.tick(0);
            };

            // wait until session expired by being late
            test.clock.tick(waitTime);

            subscription1.state.should.eql(SubscriptionState.LATE, "expecting subscription to be LATE");

            await sendPublishRequest();
            publishSpy.callCount.should.eql(1);
            subscription1.state.should.eql(SubscriptionState.KEEPALIVE);

            // send a second publish request, no wait
            await sendPublishRequest();
            test.clock.tick(subscription1.publishingInterval * subscription1.maxKeepAliveCount);
            await engine.closeSession(session.authenticationToken, true, "CloseSession");
        }); // given a subscription with monitored Item
        // given that the client doesn't send Publish Request
        // When the subscription times out and closed
        // And  When the client send a PublishRequest notification
        // Then the client shall receive the StatusChangeNotification

        publishSpy.callCount.should.eql(2);

        //
        //

        // -------------------------- First PublishResponse
        const publishResponse1 = publishSpy.getCall(0).args[1]; /* as PublishResponse */
        // console.log(publishResponse1.toString());

        // ... should be a keep alive
        publishResponse1.responseHeader.serviceResult.should.eql(StatusCodes.Good);
        publishResponse1.notificationMessage.sequenceNumber.should.eql(1);
        publishResponse1.notificationMessage.notificationData.length.should.eql(0);

        const duration1 = dateKeepAlive[0].getTime() - datePublishRequest[0].getTime();
        should(duration1).be.approximately(0, 100);

        // Test 5.10.1 Test 30 from CTT is 021.js in v3.1
        // is not conformant to my understanding
        // we should have the event at  publishingInterval*maxKeepAliveCount not publishingInterval*maxKeepAliveCount/2.°
        const duration2 = dateKeepAlive[1].getTime() - datePublishRequest[1].getTime();
        should(duration2).be.within(0, 500 + publishByMaxKeep + 100);
    });
});
