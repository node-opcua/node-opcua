/* eslint-disable max-statements */
/* global: require,describe,it,before,beforeEach,after,afterEach */
"use strict";

const should = require("should");
const sinon = require("sinon");

const subscription_service = require("node-opcua-service-subscription");
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const SessionContext = require("node-opcua-address-space").SessionContext;
const DataValue = require("node-opcua-data-value").DataValue;
const DataType = require("node-opcua-variant").DataType;
const MonitoredItemCreateRequest = subscription_service.MonitoredItemCreateRequest;
const add_mock_monitored_item = require("./helper").add_mock_monitored_item;

const {
    Subscription,
    SubscriptionState,
    MonitoredItem,
    ServerEngine,
    ServerSidePublishEngine
} = require("..");

const { get_mini_nodeset_filename } = require("node-opcua-address-space/testHelpers");
const mini_nodeset_filename = get_mini_nodeset_filename();
const { getFakePublishEngine } = require("./helper_fake_publish_engine");

let fake_publish_engine = {
};


const fakeNotificationData = [new subscription_service.DataChangeNotification()];

const TimestampsToReturn = require("node-opcua-service-read").TimestampsToReturn;


function reconstruct_fake_publish_engine() {
    fake_publish_engine = getFakePublishEngine();
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Subscriptions", function() {

    const test = this;
    beforeEach(function() {
        test.clock = sinon.useFakeTimers();
        reconstruct_fake_publish_engine();
    });

    afterEach(function() {
        test.clock.restore();
    });

    it("T1 - a subscription will make sure that lifeTimeCount is at least 3 times maxKeepAliveCount", function() {

        {
            const subscription1 = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                lifeTimeCount: 60, // at least 3 times maxKeepAliveCount
                //
                publishEngine: fake_publish_engine
            });
            subscription1.maxKeepAliveCount.should.eql(20);
            subscription1.lifeTimeCount.should.eql(60, "lifeTimeCount shall be unchanged because it is at least 3 times maxKeepAliveCount");

            subscription1.terminate();
            subscription1.dispose();

        }
        {
            const subscription2 = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                lifeTimeCount: 1, // IS NOT at least 3 times maxKeepAliveCount
                //
                publishEngine: fake_publish_engine
            });
            subscription2.maxKeepAliveCount.should.eql(20);
            subscription2.lifeTimeCount.should.eql(60, "lifeTimeCount must be adjusted to be at least 3 times maxKeepAliveCount");
            subscription2.terminate();
            subscription2.dispose();
        }

    });

    it("T2 - when a Subscription is created, the first Message is sent at the end of the first publishing cycle to inform the Client that the Subscription is operational. - Case 1 : PublishRequest in Queue &  no notification available", function() {

        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            lifeTimeCount: 60, // at least 3 times maxKeepAliveCount
            //
            publishEngine: fake_publish_engine
        });

        // pretend we have received 10 PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 10;

        subscription.maxKeepAliveCount.should.eql(20);

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        subscription.state.should.eql(SubscriptionState.CREATING);

        test.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(1, " the initial max Keep alive ");

        subscription.state.should.eql(SubscriptionState.KEEPALIVE);
        subscription._keep_alive_counter.should.eql(0);

        test.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(1, " the initial max Keep alive ");
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);
        subscription._keep_alive_counter.should.eql(1);

        test.clock.tick(subscription.publishingInterval);
        subscription._keep_alive_counter.should.eql(2);

        test.clock.tick(subscription.publishingInterval * 22);

        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(2);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        test.clock.tick(subscription.publishingInterval * 22);
        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(3);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        subscription.terminate();
        subscription.dispose();

    });

    it("T3 - when a Subscription is created, the first Message is sent at the end of the first publishing cycle to inform the Client that the Subscription is operational. - Case 2 : NoPublishRequest in Queue &  no notification available", function() {

        const subscription = new Subscription({
            id: 1000,
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            lifeTimeCount: 60, // at least 3 times maxKeepAliveCount
            publishEngine: fake_publish_engine
        });
        subscription.maxKeepAliveCount.should.eql(20);

        // pretend we have NO PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 0;

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);


        subscription.state.should.eql(SubscriptionState.CREATING);

        test.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.LATE);


        test.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.LATE);


        // pretend we now have many PublishRequest
        fake_publish_engine.pendingPublishRequestCount = 10;

        test.clock.tick(10);
        subscription.process_subscription();

        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(1);

        test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount);
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);


        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(2);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);


        subscription.terminate();
        subscription.dispose();

    });

    it("T4 - a subscription that have a new notification ready at the end of the  publishingInterval shall send notifications and no keepalive", function() {

        const subscription = new Subscription({
            id: 1000,
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            lifeTimeCount: 60, // at least 3 times maxKeepAliveCount
            //
            publishEngine: fake_publish_engine
        });
        // pretend we have received 10 PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 10;
        subscription.maxKeepAliveCount.should.eql(20);

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        const monitoredItem = add_mock_monitored_item(subscription);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount - 1));

        notification_event_spy.callCount.should.be.greaterThan(2);
        keepalive_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        test.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount + 1));
        keepalive_event_spy.callCount.should.equal(1);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        subscription.terminate();
        subscription.dispose();

    });

    it("T5 - a subscription that have only some notification ready before max_keepalive_count expired shall send notifications and no keepalive", function() {

        fake_publish_engine.pendingPublishRequestCount.should.eql(0);

        // pretend we have received 10 PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 10;

        const subscription = new Subscription({
            publishingInterval: 1000,   // 1 second interval
            lifeTimeCount: 100000, // very long lifeTimeCount not to be bother by client not pinging us
            maxKeepAliveCount: 4,
            //
            publishEngine: fake_publish_engine
        });

        subscription.state.should.eql(SubscriptionState.CREATING);

        const monitoredItem = add_mock_monitored_item(subscription);

        /* pretend that we do not have a notification ready */
        //xx monitoredItem.simulateMonitoredItemAddingNotification();


        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        const expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        // no notification ready, during 7 x publishinInterval - (keep alve is after 4)
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.equal(1);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        test.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.equal(2);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);
        test.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.equal(2);
        keepalive_event_spy.callCount.should.equal(2);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        // a other notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        test.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.equal(3);
        keepalive_event_spy.callCount.should.equal(2);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        test.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.equal(3);
        keepalive_event_spy.callCount.should.equal(2);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        test.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.equal(3);
        keepalive_event_spy.callCount.should.equal(2);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        test.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.equal(3);
        keepalive_event_spy.callCount.should.equal(2);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        test.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.equal(3);
        keepalive_event_spy.callCount.should.equal(3);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        subscription.terminate();
        subscription.dispose();

    });

    describe("T6 - a subscription shall send its first notification as soon as the publish request is available", function() {

        let addressSpace, namespace;
        let someVariableNode;
        let engine;

        function add_mock_monitored_item2(subscription, someVariableNode) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: { nodeId: someVariableNode },
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    clientHandle: 123,
                    queueSize: 10,
                    samplingInterval: 200
                }
            });
            const createResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId);

            return monitoredItem;
        }



        before(function(done) {
            engine = new ServerEngine();
            engine.initialize({ nodeset_filename: mini_nodeset_filename }, function() {
                addressSpace = engine.addressSpace;
                namespace = addressSpace.getOwnNamespace();

                const node = namespace.addVariable({
                    componentOf: "RootFolder",
                    browseName: "SomeVariable",
                    dataType: "UInt32",
                    value: { dataType: DataType.UInt32, value: 0 }
                });
                someVariableNode = node.nodeId;
                done();
            });
        });
        after(async () => {
            await engine.shutdown();
            engine = null;
        });

        let publish_engine;

        function simulate_client_adding_publish_request(publishEngine, callback) {
            const publishRequest = new subscription_service.PublishRequest({});
            publishEngine._on_PublishRequest(publishRequest, callback);
           test.clock.tick(0);
        }

        let subscription;
        let notification_event_spy, keepalive_event_spy, expire_event_spy;

        beforeEach(function() {

            publish_engine = new ServerSidePublishEngine();
            subscription = new Subscription({
                id: 1000,
                publishingInterval: 100,
                maxKeepAliveCount: 10,
                lifeTimeCount: 30,
                publishingEnabled: true,
                publishEngine: publish_engine
            });
            publish_engine.add_subscription(subscription);

            notification_event_spy = sinon.spy();
            keepalive_event_spy = sinon.spy();
            expire_event_spy = sinon.spy();
            subscription.on("notification", notification_event_spy);
            subscription.on("keepalive", keepalive_event_spy);
            subscription.on("expired", expire_event_spy);

            subscription.on("monitoredItem", function(monitoredItem) {
                monitoredItem.samplingFunc = function() { };
            });


        });

        afterEach(function(done) {
            subscription.on("terminated", function() {
                done();
            });
            subscription.terminate();
            subscription.dispose();
            subscription = null;
            publish_engine.shutdown();
            publish_engine.dispose();
        });

        it(" - case 1 - publish Request arrives before first publishInterval is over ", async () => {
            // in this case the subscription received a first publish request before the first tick is processed

            simulate_client_adding_publish_request(subscription.publishEngine);
            subscription.state.should.eql(SubscriptionState.CREATING);

            test.clock.tick(subscription.publishingInterval);
            subscription.state.should.eql(SubscriptionState.KEEPALIVE);
            keepalive_event_spy.callCount.should.eql(1);

            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            keepalive_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.KEEPALIVE);

            test.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(1);

            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            subscription.state.should.eql(SubscriptionState.LATE);

        });

        it(" - case 2 - publish Request arrives late (after first publishInterval is over)", async () => {

            // now simulate some data change
            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            subscription.state.should.eql(SubscriptionState.LATE);
            keepalive_event_spy.callCount.should.eql(0);

            simulate_client_adding_publish_request(subscription.publishEngine);

            keepalive_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.KEEPALIVE);

            test.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(1);

  
        });

        it(" - case 3 - publish Request arrives late (after first publishInterval is over)", function() {

            const monitoredItem = add_mock_monitored_item2(subscription, someVariableNode);

            test.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
            subscription.state.should.eql(SubscriptionState.LATE);

            // now simulate some data change
            monitoredItem.recordValue(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));

            notification_event_spy.callCount.should.eql(0);
            simulate_client_adding_publish_request(subscription.publishEngine);

            subscription.state.should.eql(SubscriptionState.NORMAL); // Back to Normal
            notification_event_spy.callCount.should.eql(1);

            test.clock.tick(subscription.publishingInterval);
            notification_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.NORMAL); // Back to Normal
            keepalive_event_spy.callCount.should.eql(0);

            test.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);


        });

        it(" - case 4 - publish Request arrives late (after first publishInterval is over)", function() {

            const monitoredItem = add_mock_monitored_item2(subscription, someVariableNode);

            test.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
            subscription.state.should.eql(SubscriptionState.LATE);

            // now simulate some data change
            monitoredItem.recordValue(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));

            notification_event_spy.callCount.should.eql(0);
            simulate_client_adding_publish_request(subscription.publishEngine);

            subscription.state.should.eql(SubscriptionState.NORMAL);
            notification_event_spy.callCount.should.eql(1);

            test.clock.tick(subscription.publishingInterval);
            notification_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.NORMAL);
            keepalive_event_spy.callCount.should.eql(0);

            test.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);

        });

        it(" - case 4 (with monitoredItem - 3x value writes) - publish Request arrives late (after first publishInterval is over)", function() {

            const monitoredItem = add_mock_monitored_item2(subscription, someVariableNode);

            test.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
            subscription.state.should.eql(SubscriptionState.LATE);

            // now simulate some data change
            monitoredItem.recordValue(new DataValue({ value: { dataType: DataType.UInt32, value: 1000 } }));
            notification_event_spy.callCount.should.eql(0);

            simulate_client_adding_publish_request(subscription.publishEngine);
            notification_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.NORMAL);

            test.clock.tick(subscription.publishingInterval);
            subscription.state.should.eql(SubscriptionState.NORMAL);

            monitoredItem.recordValue(new DataValue({ value: { dataType: DataType.UInt32, value: 1001 } }));
            subscription.state.should.eql(SubscriptionState.NORMAL);

            test.clock.tick(subscription.publishingInterval);
            subscription.state.should.eql(SubscriptionState.LATE);


            simulate_client_adding_publish_request(subscription.publishEngine);
            test.clock.tick(subscription.publishingInterval);

            notification_event_spy.callCount.should.eql(2);
            subscription.hasPendingNotifications.should.eql(false);
            subscription.hasUncollectedMonitoredItemNotifications.should.eql(false);

            subscription.state.should.eql(SubscriptionState.NORMAL);

            test.clock.tick(subscription.publishingInterval);
            subscription.state.should.eql(SubscriptionState.NORMAL);

            monitoredItem.recordValue(new DataValue({ value: { dataType: DataType.UInt32, value: 1002 } }));

            subscription.state.should.eql(SubscriptionState.NORMAL);

            test.clock.tick(subscription.publishingInterval);
            simulate_client_adding_publish_request(subscription.publishEngine);

            test.clock.tick(subscription.publishingInterval);
            notification_event_spy.callCount.should.eql(3);

            subscription.state.should.eql(SubscriptionState.NORMAL);
            keepalive_event_spy.callCount.should.eql(0);

            test.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
        });

    });

    it("T7 - a subscription that hasn't been pinged by client within the lifetime interval shall terminate", function() {

        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });

        const expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        const terminate_spy = sinon.spy(subscription, "terminate");

        test.clock.tick(subscription.publishingInterval * (subscription.lifeTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        test.clock.tick(subscription.publishingInterval * 2);

        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);

        subscription.terminate();
        subscription.dispose();

    });

    it("T8 - a subscription that has been pinged by client before the lifetime expiration shall not terminate", function() {

        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });

        const expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        const terminate_spy = sinon.spy(subscription, "terminate");

        test.clock.tick(subscription.publishingInterval * (subscription.lifeTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        subscription.resetLifeTimeAndKeepAliveCounters();

        test.clock.tick(subscription.publishingInterval * 4);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        test.clock.tick(subscription.publishingInterval * (subscription.lifeTimeCount + 2));
        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);

        subscription.terminate();
        subscription.dispose();

    });

    it("T9 - a subscription that has no notification within maxKeepAliveCount shall send a keepalive signal ", function() {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        const subscription = new Subscription({
            publishingInterval: 1000,
            lifeTimeCount: 100000, // very large lifetime not to be bother by client not pinging us
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });


        const expire_event_spy = sinon.spy();
        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        const terminate_spy = sinon.spy(subscription, "terminate");

        test.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount - 5));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(1);

        test.clock.tick(subscription.publishingInterval * 10);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(2);

        test.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount + 3));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(3);

        subscription.terminate();
        subscription.dispose();

    });

    it("T10 - a subscription shall maintain a retransmission queue of pending NotificationMessages.", function() {

        const subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine,
            maxNotificationsPerPublish: 2, // 

        });

        subscription.maxNotificationsPerPublish.should.eql(2);

        const monitoredItem = add_mock_monitored_item(subscription);

        monitoredItem.simulateMonitoredItemAddingNotification();
        monitoredItem.simulateMonitoredItemAddingNotification();

        monitoredItem.simulateMonitoredItemAddingNotification();
        monitoredItem.simulateMonitoredItemAddingNotification();

        monitoredItem.simulateMonitoredItemAddingNotification();
        monitoredItem.simulateMonitoredItemAddingNotification();

        monitoredItem.simulateMonitoredItemAddingNotification();
        monitoredItem.simulateMonitoredItemAddingNotification();

        subscription.pendingNotificationsCount.should.equal(0);
        test.clock.tick(subscription.publishingInterval);
        subscription.state.should.eql(SubscriptionState.LATE);

        // pretend we have received  PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 4;
        test.clock.tick(subscription.publishingInterval);

        subscription.sentNotificationMessageCount.should.equal(1);

        subscription.pendingNotificationsCount.should.equal(7);

        subscription.terminate();
        subscription.dispose();


    });

    //OPC Unified Architecture, Part 4 74 Release 1.01
    it("T11 - a subscription shall maintain a retransmission queue of sent NotificationMessages.", function() {

        const subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });
        fake_publish_engine.pendingPublishRequestCount = 10;

        const monitoredItem = add_mock_monitored_item(subscription);

        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationMessageCount.should.equal(0);

        monitoredItem.simulateMonitoredItemAddingNotification();

        test.clock.tick(subscription.publishingInterval);
        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationMessageCount.should.equal(1);


        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);
        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationMessageCount.should.equal(2);

        subscription.terminate();
        subscription.dispose();


    });

    describe("T12 - NotificationMessages are retained in this queue until they are acknowledged or until they have been in the queue for a minimum of one keep-alive interval.", function() {

        it("T12-1 a NotificationMessage is retained in this queue until it is acknowledged", function() {

            const subscription = new Subscription({
                id: 1234,
                publishingInterval: 1000,
                lifeTimeCount: 1000,
                maxKeepAliveCount: 20,
                //
                publishEngine: fake_publish_engine
            });

            const _send_response_spy = sinon.spy(fake_publish_engine, "_send_response");
            const monitoredItem = add_mock_monitored_item(subscription);

            monitoredItem.simulateMonitoredItemAddingNotification();
            monitoredItem.simulateMonitoredItemAddingNotification();
            subscription.sentNotificationMessageCount.should.equal(0);

            // pretend that we have 10 PublishRequest waiting in the queue
            fake_publish_engine.pendingPublishRequestCount = 10;

            test.clock.tick(subscription.publishingInterval);
            subscription.sentNotificationMessageCount.should.equal(1);

            fake_publish_engine.pendingPublishRequestCount.should.eql(9);

            _send_response_spy.callCount.should.equal(1);

            monitoredItem.simulateMonitoredItemAddingNotification();

            test.clock.tick(subscription.publishingInterval);
            subscription.sentNotificationMessageCount.should.equal(2);

            const notification1 = _send_response_spy.getCall(0).args[1].notificationMessage;
            notification1.sequenceNumber.should.eql(1);

            const notification2 = _send_response_spy.getCall(1).args[1].notificationMessage;
            notification2.sequenceNumber.should.eql(2);

            subscription.acknowledgeNotification(notification2.sequenceNumber);
            subscription.sentNotificationMessageCount.should.equal(1);

            subscription.acknowledgeNotification(notification1.sequenceNumber);
            subscription.sentNotificationMessageCount.should.equal(0);

            subscription.terminate();
            subscription.dispose();

        });

        it("T12-2 A notificationMessage that hasn't been acknowledge should be accessiblef for republish", function() {

            fake_publish_engine.pendingPublishRequestCount = 10;

            const send_response_spy = sinon.spy(fake_publish_engine, "_send_response");

            //#getMessageForSequenceNumber
            const subscription = new Subscription({
                id: 1234,
                publishingInterval: 1000,
                lifeTimeCount: 1000,
                maxKeepAliveCount: 20,
                //
                publishEngine: fake_publish_engine
            });

            const monitoredItem = add_mock_monitored_item(subscription);

            should(subscription.getMessageForSequenceNumber(35)).eql(null);

            monitoredItem.simulateMonitoredItemAddingNotification();
            monitoredItem.simulateMonitoredItemAddingNotification();

            subscription.sentNotificationMessageCount.should.equal(0);

            test.clock.tick(subscription.publishingInterval);
            subscription.sentNotificationMessageCount.should.equal(1);

            const notification1 = send_response_spy.getCall(0).args[1].notificationMessage;
            notification1.sequenceNumber.should.eql(1);
            const seqNum = notification1.sequenceNumber;


            //
            const message = subscription.getMessageForSequenceNumber(seqNum);
            message.sequenceNumber.should.eql(seqNum);

            subscription.terminate();
            subscription.dispose();

        });

        it("T12-3 - 1.02 the server shall retain a maximum number of un-acknowledged NotificationMessage until they are acknowledged", function() {
            // TODO
        });

        xit("T12-4 - 1.01 a NotificationMessage is retained until it has been in the queue for a minimum of one keep-alive interval.", function() {
            // this conforms to OPC UA specifciation 1.01 and is now obsolete as behavior has been chanded in 1.02

            const subscription = new Subscription({
                id: 1234,
                publishingInterval: 1000,
                lifeTimeCount: 1000,
                maxKeepAliveCount: 20,
                //
                publishEngine: fake_publish_engine
            });
            // create a notification at t=0
            subscription.addNotificationMessage(fakeNotificationData);
            subscription._popNotificationToSend();
            subscription.sentNotificationMessageCount.should.equal(1);

            test.clock.tick(1000 * 5);
            // create a notification at t=1000*5
            subscription.addNotificationMessage(fakeNotificationData);
            subscription._popNotificationToSend();
            subscription.sentNotificationMessageCount.should.equal(2);

            test.clock.tick(1000 * 20);
            // now check that at t=1000*25 , old notification has been discarded
            subscription.sentNotificationMessageCount.should.equal(1);

            test.clock.tick(1000 * 100);
            // now check that at t=1000*100 , old notification has been discarded
            subscription.sentNotificationMessageCount.should.equal(0);

            subscription.terminate();
            subscription.dispose();
        });

    });


    it("T13 - a subscription that have no monitored items shall not terminate if client has sent enough PublishRequest", function() {

        // pretend there is plenty of PublishRequest in publish engine
        fake_publish_engine.pendingPublishRequestCount = 1000;

        const subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 20,
            lifeTimeCount: 10,
            publishEngine: fake_publish_engine
        });

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        const expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        subscription.maxKeepAliveCount.should.eql(20);
        subscription.publishingInterval.should.eql(100);

        test.clock.tick(6 * subscription.publishingInterval * subscription.maxKeepAliveCount);

        subscription.publishIntervalCount.should.equal(120,
            " 3000 ms with a publishingInterval: 100 ms means publishIntervalCount = 30");


        expire_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(6);
        notification_event_spy.callCount.should.equal(0);

        test.clock.tick(6 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        expire_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(12);
        notification_event_spy.callCount.should.equal(0);

        test.clock.tick(6 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        expire_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(18);
        notification_event_spy.callCount.should.equal(0);

        subscription.terminate();
        subscription.dispose();
    });

    it("T14 - a subscription send a first message at the end of the first publishing cycle without waiting for the maximum  count to be reached", function() {
        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        /**
         * When a Subscription is created, the first Message is sent at the end of the first publishing cycle to
         * inform the Client that the Subscription is operational. A Notification Message is sent if there are
         * Notifications ready to be reported. If there are none, a keep-alive Message is sent instead that
         * contains a sequence number of 1, indicating that the first Notification Message has not yet been
         * sent. This is the only time a keep-alive Message is sent without waiting for the maximum keep-alive
         * count to be reached, as specified in (f) above.
         *
         */
        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });
        const monitoredItem = add_mock_monitored_item(subscription);

        // pretend that we already have notification messages
        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        const expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        test.clock.tick(200);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(0);

        test.clock.tick(1000);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(1);

        test.clock.tick(1000);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(1);

        test.clock.tick(30000);
        keepalive_event_spy.callCount.should.equal(1);
        notification_event_spy.callCount.should.eql(1);

        subscription.terminate();
        subscription.dispose();

    });

    it("T15 - the first Notification Message sent on a Subscription has a sequence number of 1.", function() {
        const subscription = new Subscription({
            publishEngine: fake_publish_engine
        });
        subscription._get_future_sequence_number().should.equal(1);
        subscription._get_next_sequence_number().should.equal(1);
        subscription._get_next_sequence_number().should.equal(2);
        subscription._get_next_sequence_number().should.equal(3);
        subscription._get_future_sequence_number().should.equal(4);

        subscription.terminate();
        subscription.dispose();
    });

    it("T16 - should return BadMonitorItemInvalid when trying to remove a monitored item that doesn't exist", function() {

        const subscription = new Subscription({
            publishEngine: fake_publish_engine
        });
        subscription.removeMonitoredItem(26).should.eql(StatusCodes.BadMonitoredItemIdInvalid);

        subscription.terminate();
        subscription.dispose();

    });

    xit("closing a Subscription causes its MonitoredItems to be deleted. ", function() {

    });


});

describe("Subscription#setPublishingMode", function() {

    const test = this;
    beforeEach(function() {
        test.clock = sinon.useFakeTimers();
        reconstruct_fake_publish_engine();
    });

    afterEach(function() {
        test.clock.restore();
    });
    it("W1 - a subscription created with publishingEnabled=true shall emit notification", function(done) {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        const subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishingEnabled: true,              //  PUBLISHING IS ENABLED !!!
            publishEngine: fake_publish_engine
        });

        const monitoredItem = add_mock_monitored_item(subscription);

        // pretend that we already have notification messages
        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        const expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        test.clock.tick(subscription.publishingInterval * 4);

        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(1); // all notif shall be compressed into one message


        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.be.greaterThan(4);

        subscription.terminate();
        subscription.dispose();

        done();
    });

    it("W2 - a subscription created with publishingEnabled=false shall not emit notification (but keepalive)", function(done) {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        const subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,

            publishingEnabled: false,              //  PUBLISHING IS DISABLED !!!

            publishEngine: fake_publish_engine

        });
        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        const expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        const monitoredItem = add_mock_monitored_item(subscription);


        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        test.clock.tick(subscription.publishingInterval);


        test.clock.tick(4 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(5);
        notification_event_spy.callCount.should.eql(0);

        subscription.terminate();
        subscription.dispose();
        done();
    });

    it("W3 - a publishing subscription can be disabled and re-enabled", function(done) {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        const subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishingEnabled: true,              //  PUBLISHING IS ENABLED !!!
            publishEngine: fake_publish_engine
        });

        const monitoredItem = add_mock_monitored_item(subscription);

        // the monitoredItem provides a new notification every 50ms
        function push_some_notification() {
            monitoredItem.simulateMonitoredItemAddingNotification();
        }
        const t = setInterval(push_some_notification, 50);

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        const expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        test.clock.tick(subscription.publishingInterval * 22);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.be.greaterThan(20);

        // now disable
        subscription.setPublishingMode(false);
        test.clock.tick(4 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(4);
        notification_event_spy.callCount.should.be.greaterThan(20);


        subscription.setPublishingMode(true);
        test.clock.tick(4 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(4);
        notification_event_spy.callCount.should.be.greaterThan(40);

        clearInterval(t);

        subscription.terminate();
        subscription.dispose();
        done();


    });

    it("W4 - a disabled subscription shall continue to send keep-alive notifications", function(done) {

        // What the specs say:
        // Publishing by a Subscription may be enabled or disabled by the Client when created, or
        // subsequently using the SetPublishingMode Service. Disabling causes the Subscription to
        // cease sending NotificationMessages to the Client. However, the Subscription continues
        // to execute cyclically and continues to send keep-alive Messages to the Client.


        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        const subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishingEnabled: false,              //  PUBLISHING IS DISABLED !!!
            publishEngine: fake_publish_engine
        });

        const monitoredItem = add_mock_monitored_item(subscription);

        // the monitoredItem provides a new notification every 50ms
        function push_some_notification() {
            monitoredItem.simulateMonitoredItemAddingNotification();
        }
        const t = setInterval(push_some_notification, 50);

        const notification_event_spy = sinon.spy();
        const keepalive_event_spy = sinon.spy();
        const expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        test.clock.tick(4 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(4); // 2000 = 4*5*100
        notification_event_spy.callCount.should.be.equal(0);


        subscription.setPublishingMode(true);

        test.clock.tick(4 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(4);
        notification_event_spy.callCount.should.be.greaterThan(19);
        const nb = notification_event_spy.callCount;

        subscription.setPublishingMode(false);
        test.clock.tick(4 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(8);
        notification_event_spy.callCount.should.be.equal(nb);

        clearInterval(t);

        subscription.terminate();
        subscription.dispose();
        done();

    })
});

describe("Subscription#adjustSamplingInterval", function() {

    beforeEach(function() {
        //xx        test.clock = sinon.useFakeTimers();
        reconstruct_fake_publish_engine();
    });

    it("should have a minimum sampling interval, with a strictly positive value ( which is the fastest possible rate)", function() {
        MonitoredItem.minimumSamplingInterval.should.be.greaterThan(4);
    });

    it("should have a default sampling interval, greater than minimumSamplingInterval ", function() {
        MonitoredItem.defaultSamplingInterval.should.be.greaterThan(MonitoredItem.minimumSamplingInterval);
    });

    it("should have a maximum sampling interval, greater than defaultSamplingInterval ", function() {
        MonitoredItem.maximumSamplingInterval.should.be.greaterThan(MonitoredItem.defaultSamplingInterval);
    });

    it("should adjust sampling interval to subscription publish interval when requested sampling interval === -1", function() {
        const subscription = new Subscription({ publishingInterval: 1234, publishEngine: fake_publish_engine });


        subscription.adjustSamplingInterval(-1).should.eql(subscription.publishingInterval);

        subscription.terminate();
        subscription.dispose();
    });

    const fake_node = {
        readAttribute: function(context, attributeId) {
            context.should.be.instanceOf(SessionContext);
            attributeId.should.eql(AttributeIds.MinimumSamplingInterval);
            return new DataValue({ value: { dataType: DataType.Double, value: 0.0 } });
        }
    };

    it("should adjust sampling interval to subscription publish interval when requested sampling interval is a negative value !== -1", function() {
        const subscription = new Subscription({ publishingInterval: 1234, publishEngine: fake_publish_engine });
        subscription.adjustSamplingInterval(-2, fake_node).should.eql(subscription.publishingInterval);
        subscription.adjustSamplingInterval(-0.02, fake_node).should.eql(subscription.publishingInterval);

        subscription.terminate();
        subscription.dispose();
    });

    it("should leave sampling interval to 0 when requested sampling interval === 0 ( 0 means Event Based mode)", function() {
        const subscription = new Subscription({ publishingInterval: 1234, publishEngine: fake_publish_engine });
        subscription.adjustSamplingInterval(0, fake_node).should.eql(0);
        subscription.terminate();
        subscription.dispose();
    });

    it("should adjust sampling interval to minimum when requested sampling interval === 1", function() {
        const subscription = new Subscription({ publishingInterval: 1234, publishEngine: fake_publish_engine });
        subscription.adjustSamplingInterval(1, fake_node).should.eql(MonitoredItem.minimumSamplingInterval);
        subscription.terminate();
        subscription.dispose();
    });

    it("should adjust sampling interval to maximum when requested sampling interval is too high", function() {
        const subscription = new Subscription({ publishingInterval: 1234, publishEngine: fake_publish_engine });
        subscription.adjustSamplingInterval(1E10, fake_node).should.eql(MonitoredItem.maximumSamplingInterval);
        subscription.terminate();
        subscription.dispose();
    });

    it("should return an unmodified sampling interval when requested sampling is in valid range", function() {
        const subscription = new Subscription({ publishingInterval: 1234, publishEngine: fake_publish_engine });
        const someValidSamplingInterval = (MonitoredItem.maximumSamplingInterval + MonitoredItem.minimumSamplingInterval) / 2.0;
        subscription.adjustSamplingInterval(someValidSamplingInterval, fake_node).should.eql(someValidSamplingInterval);
        subscription.terminate();
        subscription.dispose();
    });

    it("should adjust sampling interval the minimumSamplingInterval when requested sampling is too low", function() {
        const subscription = new Subscription({ publishingInterval: 1234, publishEngine: fake_publish_engine });
        const someVeryLowSamplingInterval = 1;
        subscription.adjustSamplingInterval(someVeryLowSamplingInterval, fake_node).should.eql(MonitoredItem.minimumSamplingInterval);
        subscription.terminate();
        subscription.dispose();
    });

});

