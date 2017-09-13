/* global: require,describe,it,before,beforeEach,after,afterEach */
"use strict";

var should = require("should");
var sinon = require("sinon");

var subscription_service = require("node-opcua-service-subscription");
var SubscriptionState = require("../src/subscription").SubscriptionState;


var StatusCodes = require("node-opcua-status-code").StatusCodes;
var Subscription = require("../src/subscription").Subscription;
var MonitoredItem = require("../src/monitored_item").MonitoredItem;
var AttributeIds = require("node-opcua-data-model").AttributeIds;

var SessionContext = require("node-opcua-address-space").SessionContext;
var fake_publish_engine = {};


var fakeNotificationData =[new subscription_service.DataChangeNotification()];

var TimestampsToReturn = require("node-opcua-service-read").TimestampsToReturn;

var server_engine = require("../src/server_engine");

function reconstruct_fake_publish_engine() {
    fake_publish_engine = {
        pendingPublishRequestCount: 0,
        send_notification_message: function () {
        },
        send_keep_alive_response: function () {
            if (this.pendingPublishRequestCount <= 0) {
                return false;
            }
            this.pendingPublishRequestCount -= 1;
            return true;
        }, on_close_subscription: function(subscription) {}

    };
}

var DataValue =  require("node-opcua-data-value").DataValue;
var DataType = require("node-opcua-variant").DataType;
var MonitoredItemCreateRequest = subscription_service.MonitoredItemCreateRequest;


var add_mock_monitored_item = require("./helper").add_mock_monitored_item;

var describeWithLeakDetector = require("node-opcua-leak-detector").describeWithLeakDetector;
describeWithLeakDetector("Subscriptions", function () {

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
        reconstruct_fake_publish_engine();
    });

    afterEach(function () {
        this.clock.restore();
    });

    it("T1 - a subscription will make sure that lifeTimeCount is at least 3 times maxKeepAliveCount", function () {

        {
            var subscription1 = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount:    20,
                lifeTimeCount:        60, // at least 3 times maxKeepAliveCount
                //
                publishEngine: fake_publish_engine
            });
            subscription1.maxKeepAliveCount.should.eql(20);
            subscription1.lifeTimeCount.should.eql(60,"lifeTimeCount shall be unchanged because it is at least 3 times maxKeepAliveCount");

            subscription1.terminate();

        }
        {
            var subscription2 = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount:    20,
                lifeTimeCount:         1, // IS NOT at least 3 times maxKeepAliveCount
                //
                publishEngine: fake_publish_engine
            });
            subscription2.maxKeepAliveCount.should.eql(20);
            subscription2.lifeTimeCount.should.eql(60,"lifeTimeCount must be adjusted to be at least 3 times maxKeepAliveCount");
            subscription2.terminate();
        }

    });

    it("T2 - when a Subscription is created, the first Message is sent at the end of the first publishing cycle to inform the Client that the Subscription is operational. - Case 1 : PublishRequest in Queue &  no notification available",function() {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount:    20,
            lifeTimeCount:        60, // at least 3 times maxKeepAliveCount
            //
            publishEngine: fake_publish_engine
        });

        // pretend we have received 10 PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 10;

        subscription.maxKeepAliveCount.should.eql(20);

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        subscription.state.should.eql(SubscriptionState.CREATING);

        this.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(1," the initial max Keep alive ");

        subscription.state.should.eql(SubscriptionState.KEEPALIVE);
        subscription._keep_alive_counter.should.eql(0);

        this.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(1," the initial max Keep alive ");
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);
        subscription._keep_alive_counter.should.eql(1);

        this.clock.tick(subscription.publishingInterval);
        subscription._keep_alive_counter.should.eql(2);

        this.clock.tick(subscription.publishingInterval * 22);

        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(2);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        this.clock.tick(subscription.publishingInterval * 22 );
        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(3);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        subscription.terminate();

    });

    it("T3 - when a Subscription is created, the first Message is sent at the end of the first publishing cycle to inform the Client that the Subscription is operational. - Case 2 : NoPublishRequest in Queue &  no notification available",function() {

        var subscription = new Subscription({
            id: 1000,
            publishingInterval: 1000,
            maxKeepAliveCount:    20,
            lifeTimeCount:        60, // at least 3 times maxKeepAliveCount
            publishEngine: fake_publish_engine
        });
        subscription.maxKeepAliveCount.should.eql(20);

        // pretend we have NO PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 0;

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);


        subscription.state.should.eql(SubscriptionState.CREATING);

        this.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.LATE);


        this.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.LATE);


        // pretend we now have many PublishRequest
        fake_publish_engine.pendingPublishRequestCount = 10;

        this.clock.tick(10);
        subscription.process_subscription();

        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(1);

        console.log("_life_time_counter = ",subscription._life_time_counter);

        this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount );
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);


        notification_event_spy.callCount.should.be.equal(0);
        keepalive_event_spy.callCount.should.equal(2);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);


        subscription.terminate();

    });

    it("T4 - a subscription that have a new notification ready at the end of the  publishingInterval shall send notifications and no keepalive", function () {

        var subscription = new Subscription({
            id: 1000,
            publishingInterval: 1000,
            maxKeepAliveCount:    20,
            lifeTimeCount:        60, // at least 3 times maxKeepAliveCount
            //
            publishEngine: fake_publish_engine
        });
        // pretend we have received 10 PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 10;
        subscription.maxKeepAliveCount.should.eql(20);

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);

        var monitoredItem  = add_mock_monitored_item(subscription);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount -1) );


        notification_event_spy.callCount.should.be.greaterThan(2);
        keepalive_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        this.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount +1) );
        keepalive_event_spy.callCount.should.equal(1);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        subscription.terminate();

    });

    it("T5 - a subscription that have only some notification ready before max_keepalive_count expired shall send notifications and no keepalive", function () {

        fake_publish_engine.pendingPublishRequestCount.should.eql(0);

        // pretend we have received 10 PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 10;

        var subscription = new Subscription({
            publishingInterval: 1000,   // 1 second interval
            lifeTimeCount: 100000, // very long lifeTimeCount not to be bother by client not pinging us
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });

        subscription.state.should.eql(SubscriptionState.CREATING);

        var monitoredItem  = add_mock_monitored_item(subscription);

        /* pretend that we do not have a notification ready */
        //xx monitoredItem.simulateMonitoredItemAddingNotification();


        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        // no notification ready, during 7 x publishinInterval
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.equal(1);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        // a other notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        this.clock.tick(subscription.publishingInterval);
        notification_event_spy.callCount.should.equal(2);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);
        subscription.state.should.eql(SubscriptionState.NORMAL);

        subscription.terminate();

    });

    describe("T6 - a subscription shall send its first notification as soon as the publish request is available", function () {

        var addressSpace;
        var someVariableNode;
        var engine;

        function add_mock_monitored_item2(subscription,someVariableNode) {
            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {nodeId: someVariableNode},
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    clientHandle:     123,
                    queueSize:         10,
                    samplingInterval: 200
                }
            });
            var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

            return monitoredItem;
        }



        before(function (done) {
            engine = new server_engine.ServerEngine();
            engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {
                addressSpace = engine.addressSpace;
                var node = addressSpace.addVariable({
                    componentOf: "RootFolder",
                    browseName: "SomeVariable",
                    dataType: "UInt32",
                    value: {dataType: DataType.UInt32, value: 0}
                });
                someVariableNode = node.nodeId;
                done();
            });
        });
        after(function () {
            engine.shutdown();
            engine = null;
        });

        var ServerSidePublishEngine = require("../src/server_publish_engine").ServerSidePublishEngine;
        var publish_engine;

        function simulate_client_adding_publish_request(publishEngine, callback) {
            var publishRequest = new subscription_service.PublishRequest({});
            publishEngine._on_PublishRequest(publishRequest, callback);
        }

        var subscription;
        var notification_event_spy, keepalive_event_spy, expire_event_spy;

        beforeEach(function () {

            publish_engine = new ServerSidePublishEngine();
            subscription = new Subscription({
                id:                 1000,
                publishingInterval: 100,
                maxKeepAliveCount:   10,
                lifeTimeCount:       30,
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

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = function(){};
            });


        });

        afterEach(function (done) {
            subscription.on("terminated", function () {
                done();
            });
            subscription.terminate();
            subscription = null;
        });

        it(" - case 1 - publish Request arrives before first publishInterval is over ", function (done) {
            // in this case the subscription received a first publish request before the first tick is processed

            simulate_client_adding_publish_request(subscription.publishEngine);
            subscription.state.should.eql(SubscriptionState.CREATING);

            this.clock.tick(subscription.publishingInterval);
            subscription.state.should.eql(SubscriptionState.KEEPALIVE);
            keepalive_event_spy.callCount.should.eql(1);

            this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            keepalive_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.KEEPALIVE);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(1);

            this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            subscription.state.should.eql(SubscriptionState.LATE);

            done();

        });

        it(" - case 2 - publish Request arrives late (after first publishInterval is over)", function (done) {

            // now simulate some data change
            this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            subscription.state.should.eql(SubscriptionState.LATE);
            keepalive_event_spy.callCount.should.eql(0);

            simulate_client_adding_publish_request(subscription.publishEngine);

            keepalive_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.KEEPALIVE);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(1);

            done();

        });

        it(" - case 3 - publish Request arrives late (after first publishInterval is over)", function (done) {


            var monitoredItem = add_mock_monitored_item2(subscription,someVariableNode);
            
            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
            subscription.state.should.eql(SubscriptionState.LATE);

            // now simulate some data change
            monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));

            notification_event_spy.callCount.should.eql(0);
            simulate_client_adding_publish_request(subscription.publishEngine);

            subscription.state.should.eql(SubscriptionState.NORMAL); // Back to Normal
            notification_event_spy.callCount.should.eql(1);

            this.clock.tick(subscription.publishingInterval);
            notification_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.NORMAL); // Back to Normal
            keepalive_event_spy.callCount.should.eql(0);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);

            done();

        });

        it(" - case 4 - publish Request arrives late (after first publishInterval is over)", function (done) {

            var monitoredItem = add_mock_monitored_item2(subscription,someVariableNode);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
            subscription.state.should.eql(SubscriptionState.LATE);
            
            // now simulate some data change
            monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));

            notification_event_spy.callCount.should.eql(0);
            simulate_client_adding_publish_request(subscription.publishEngine);

            subscription.state.should.eql(SubscriptionState.NORMAL);
            notification_event_spy.callCount.should.eql(1);

            this.clock.tick(subscription.publishingInterval);
            notification_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.NORMAL);
            keepalive_event_spy.callCount.should.eql(0);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);

            done();
        });

        it(" - case 4 (with monitoredItem - 3x value writes) - publish Request arrives late (after first publishInterval is over)", function (done) {

            var monitoredItem = add_mock_monitored_item2(subscription,someVariableNode);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
            subscription.state.should.eql(SubscriptionState.LATE);

            // now simulate some data change
            monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
            notification_event_spy.callCount.should.eql(0);

            simulate_client_adding_publish_request(subscription.publishEngine);
            notification_event_spy.callCount.should.eql(1);
            subscription.state.should.eql(SubscriptionState.NORMAL);

            this.clock.tick(subscription.publishingInterval);
            subscription.state.should.eql(SubscriptionState.NORMAL);

            monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
            subscription.state.should.eql(SubscriptionState.NORMAL);

            this.clock.tick(subscription.publishingInterval);
            subscription.state.should.eql(SubscriptionState.LATE);


            simulate_client_adding_publish_request(subscription.publishEngine);
            this.clock.tick(subscription.publishingInterval);

            notification_event_spy.callCount.should.eql(2);
            subscription.hasPendingNotifications.should.eql(false);
            subscription.hasMonitoredItemNotifications.should.eql(false);

            subscription.state.should.eql(SubscriptionState.NORMAL);

            this.clock.tick(subscription.publishingInterval);
            subscription.state.should.eql(SubscriptionState.NORMAL);

            monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));

            subscription.state.should.eql(SubscriptionState.NORMAL);

            this.clock.tick(subscription.publishingInterval);
            simulate_client_adding_publish_request(subscription.publishEngine);

            this.clock.tick(subscription.publishingInterval);
            notification_event_spy.callCount.should.eql(3);

            subscription.state.should.eql(SubscriptionState.NORMAL);
            keepalive_event_spy.callCount.should.eql(0);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
            done();
        });

    });

    it("T7 - a subscription that hasn't been pinged by client within the lifetime interval shall terminate", function () {
    
        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });

        var expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.lifeTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * 2);

        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);

        subscription.terminate();

    });

    it("T8 - a subscription that has been pinged by client before the lifetime expiration shall not terminate", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });

        var expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.lifeTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        subscription.resetLifeTimeAndKeepAliveCounters();

        this.clock.tick(subscription.publishingInterval * 4);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * (subscription.lifeTimeCount + 2));
        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);

        subscription.terminate();

    });

    it("T9 - a subscription that has no notification within maxKeepAliveCount shall send a keepalive signal ", function () {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 1000,
            lifeTimeCount: 100000, // very large lifetime not to be bother by client not pinging us
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
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
        keepalive_event_spy.callCount.should.equal(1);

        this.clock.tick(subscription.publishingInterval * 10);

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(2);

        this.clock.tick(subscription.publishingInterval * (subscription.maxKeepAliveCount + 3));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(3);

        subscription.terminate();

    });

    it("T10 - a subscription shall maintain a retransmission queue of pending NotificationMessages.", function () {

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine,
            maxNotificationsPerPublish: 2,

        });
        var monitoredItem  = add_mock_monitored_item(subscription);

        monitoredItem.simulateMonitoredItemAddingNotification();
        monitoredItem.simulateMonitoredItemAddingNotification();

        monitoredItem.simulateMonitoredItemAddingNotification();
        monitoredItem.simulateMonitoredItemAddingNotification();

        monitoredItem.simulateMonitoredItemAddingNotification();
        monitoredItem.simulateMonitoredItemAddingNotification();

        monitoredItem.simulateMonitoredItemAddingNotification();
        monitoredItem.simulateMonitoredItemAddingNotification();

        subscription.pendingNotificationsCount.should.equal(0);
        this.clock.tick(subscription.publishingInterval);
        subscription.state.should.eql(SubscriptionState.LATE);

        // pretend we have received  PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 4;
        this.clock.tick(subscription.publishingInterval);

        subscription.sentNotificationsCount.should.equal(1);
        subscription.pendingNotificationsCount.should.equal(3);

        subscription.terminate();


    });

    //OPC Unified Architecture, Part 4 74 Release 1.01
    it("T11 - a subscription shall maintain a retransmission queue of sent NotificationMessages.", function () {

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });
        fake_publish_engine.pendingPublishRequestCount = 10;

        var monitoredItem  = add_mock_monitored_item(subscription);

        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationsCount.should.equal(0);

        monitoredItem.simulateMonitoredItemAddingNotification();

        this.clock.tick(subscription.publishingInterval);
        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationsCount.should.equal(1);


        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);
        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationsCount.should.equal(2);

        subscription.terminate();


    });

    describe("T12 - NotificationMessages are retained in this queue until they are acknowledged or until they have been in the queue for a minimum of one keep-alive interval.", function () {

        it("T12-1 a NotificationMessage is retained in this queue until it is acknowledged", function () {

            var subscription = new Subscription({
                id: 1234,
                publishingInterval: 1000,
                lifeTimeCount: 1000,
                maxKeepAliveCount: 20,
                //
                publishEngine: fake_publish_engine
            });

            var send_notification_message_spy = sinon.spy();
            fake_publish_engine.send_notification_message = send_notification_message_spy;

            var monitoredItem  = add_mock_monitored_item(subscription);

            monitoredItem.simulateMonitoredItemAddingNotification();
            monitoredItem.simulateMonitoredItemAddingNotification();
            subscription.sentNotificationsCount.should.equal(0);

            fake_publish_engine.pendingPublishRequestCount = 10;

            this.clock.tick(subscription.publishingInterval);
            subscription.sentNotificationsCount.should.equal(1);

            send_notification_message_spy.callCount.should.equal(1);

            monitoredItem.simulateMonitoredItemAddingNotification();
            this.clock.tick(subscription.publishingInterval);
            subscription.sentNotificationsCount.should.equal(2);

            var notification1 = send_notification_message_spy.getCall(0).args[0];
            notification1.sequenceNumber.should.eql(1);

            var notification2 = send_notification_message_spy.getCall(1).args[0];
            notification2.sequenceNumber.should.eql(2);

            subscription.acknowledgeNotification(notification2.sequenceNumber);
            subscription.sentNotificationsCount.should.equal(1);

            subscription.acknowledgeNotification(notification1.sequenceNumber);
            subscription.sentNotificationsCount.should.equal(0);

            subscription.terminate();

        });

        it("T12-2 A notificationMessage that hasn't been acknowledge should be accessiblef for republish", function () {

            var send_notification_message_spy = sinon.spy();
            fake_publish_engine.pendingPublishRequestCount = 10;
            fake_publish_engine.send_notification_message = send_notification_message_spy;

            //#getMessageForSequenceNumber
            var subscription = new Subscription({
                id: 1234,
                publishingInterval: 1000,
                lifeTimeCount: 1000,
                maxKeepAliveCount: 20,
                //
                publishEngine: fake_publish_engine
            });

            var monitoredItem  = add_mock_monitored_item(subscription);

            should(subscription.getMessageForSequenceNumber(35)).eql(null);

            monitoredItem.simulateMonitoredItemAddingNotification();
            monitoredItem.simulateMonitoredItemAddingNotification();

            subscription.sentNotificationsCount.should.equal(0);

            this.clock.tick(subscription.publishingInterval);
            subscription.sentNotificationsCount.should.equal(1);

            var notification1 = send_notification_message_spy.getCall(0).args[0];
            notification1.sequenceNumber.should.eql(1);
            var seqNum = notification1.sequenceNumber;


            //
            var message = subscription.getMessageForSequenceNumber(seqNum);
            message.sequenceNumber.should.eql(seqNum);

            subscription.terminate();

        });

        it("T12-3 - 1.02 the server shall retain a maximum number of un-acknowledge NotificationMessage until they are acknoledged", function () {
            // TODO
        });

        xit("T12-4 - 1.01 a NotificationMessage is retained until it has been in the queue for a minimum of one keep-alive interval.", function () {
            // this conforms to OPC UA specifciation 1.01 and is now obsolete as behavior has been chanded in 1.02

            var subscription = new Subscription({
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
            subscription.sentNotificationsCount.should.equal(1);

            this.clock.tick(1000 * 5);
            // create a notification at t=1000*5
            subscription.addNotificationMessage(fakeNotificationData);
            subscription._popNotificationToSend();
            subscription.sentNotificationsCount.should.equal(2);

            this.clock.tick(1000 * 20);
            // now check that at t=1000*25 , old notification has been discarded
            subscription.sentNotificationsCount.should.equal(1);

            this.clock.tick(1000 * 100);
            // now check that at t=1000*100 , old notification has been discarded
            subscription.sentNotificationsCount.should.equal(0);

            subscription.terminate();
        });

    });


    it("T13 - a subscription that have no monitored items shall not terminate if client has sent enough PublishRequest", function () {

        // pretend there is plenty of PublishRequest in publish engine
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 20,
            lifeTimeCount: 10,
            publishEngine: fake_publish_engine
        });

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        subscription.maxKeepAliveCount.should.eql(20);
        subscription.publishingInterval.should.eql(100);

        this.clock.tick( 6 * subscription.publishingInterval * subscription.maxKeepAliveCount);

        subscription.publishIntervalCount.should.equal(120,
            " 3000 ms with a publishingInterval: 100 ms means publishIntervalCount = 30");


        expire_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(6);
        notification_event_spy.callCount.should.equal(0);

        this.clock.tick( 6 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        expire_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(12);
        notification_event_spy.callCount.should.equal(0);

        this.clock.tick( 6 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        expire_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(18);
        notification_event_spy.callCount.should.equal(0);

        subscription.terminate();
    });

    it("T14 - a subscription send a first message at the end of the first publishing cycle without waiting for the maximum  count to be reached", function () {
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
        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });
        var monitoredItem  = add_mock_monitored_item(subscription);

        // pretend that we already have notification messages
        // a notification finally arrived !
        monitoredItem.simulateMonitoredItemAddingNotification();

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(200);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(0);

        this.clock.tick(1000);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(1);

        this.clock.tick(1000);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(1);

        this.clock.tick(30000);
        keepalive_event_spy.callCount.should.equal(1);
        notification_event_spy.callCount.should.eql(1);

        subscription.terminate();

    });

    it("T15 - the first Notification Message sent on a Subscription has a sequence number of 1.", function () {
        var subscription = new Subscription({
            publishEngine: fake_publish_engine
        });
        subscription._get_future_sequence_number().should.equal(1);
        subscription._get_next_sequence_number().should.equal(1);
        subscription._get_next_sequence_number().should.equal(2);
        subscription._get_next_sequence_number().should.equal(3);
        subscription._get_future_sequence_number().should.equal(4);

        subscription.terminate();
    });

    it("T16 - should return BadMonitorItemInvalid when trying to remove a monitored item that doesn't exist", function () {

        var subscription = new Subscription({
            publishEngine: fake_publish_engine
        });
        subscription.removeMonitoredItem(26).should.eql(StatusCodes.BadMonitoredItemIdInvalid);

        subscription.terminate();

    });

    xit("closing a Subscription causes its MonitoredItems to be deleted. ", function () {

    });


});

describe("Subscription#setPublishingMode", function () {

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
        reconstruct_fake_publish_engine();
    });

    afterEach(function () {
        this.clock.restore();
    });
    it("W1 - a subscription created with publishingEnabled=true shall emit notification", function (done) {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishingEnabled: true,              //  PUBLISHING IS ENABLED !!!
            publishEngine: fake_publish_engine
        });

        var monitoredItem  = add_mock_monitored_item(subscription);

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

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(subscription.publishingInterval*4);

        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.eql(1); // all notif shall be compressed into one message


        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        notification_event_spy.callCount.should.be.greaterThan(4);

        subscription.terminate();

        done();
    });

    it("W2 - a subscription created with publishingEnabled=false shall not emit notification (but keepalive)", function (done) {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,

            publishingEnabled: false,              //  PUBLISHING IS DISABLED !!!

            publishEngine: fake_publish_engine

        });
        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        var monitoredItem  = add_mock_monitored_item(subscription);


        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);

        monitoredItem.simulateMonitoredItemAddingNotification();
        this.clock.tick(subscription.publishingInterval);


        this.clock.tick(4* subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(5);
        notification_event_spy.callCount.should.eql(0);

        subscription.terminate();
        done();
    });

    it("W3 - a publishing subscription can be disabled and re-enabled", function (done) {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishingEnabled: true,              //  PUBLISHING IS ENABLED !!!
            publishEngine: fake_publish_engine
        });

        var monitoredItem  = add_mock_monitored_item(subscription);

        // the monitoredItem provides a new notification every 50ms
        function push_some_notification() {
            monitoredItem.simulateMonitoredItemAddingNotification();
        }
        var t = setInterval(push_some_notification, 50);

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(subscription.publishingInterval * 22);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.be.greaterThan(20);

        // now disable
        subscription.setPublishingMode(false);
        this.clock.tick(4 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(4);
        notification_event_spy.callCount.should.be.greaterThan(20);


        subscription.setPublishingMode(true);
        this.clock.tick(4 * subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(4);
        notification_event_spy.callCount.should.be.greaterThan(40);

        clearInterval(t);

        subscription.terminate();
        done();


    });

    it("W4 - a disabled subscription shall continue to send keep-alive notifications",function(done){

        // What the specs say:
        // Publishing by a Subscription may be enabled or disabled by the Client when created, or
        // subsequently using the SetPublishingMode Service. Disabling causes the Subscription to
        // cease sending NotificationMessages to the Client. However, the Subscription continues
        // to execute cyclically and continues to send keep-alive Messages to the Client.


        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishingEnabled: false,              //  PUBLISHING IS DISABLED !!!
            publishEngine: fake_publish_engine
        });

        var monitoredItem  = add_mock_monitored_item(subscription);

        // the monitoredItem provides a new notification every 50ms
        function push_some_notification() {
            monitoredItem.simulateMonitoredItemAddingNotification();
        }
        var t = setInterval(push_some_notification, 50);

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(4* subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(4); // 2000 = 4*5*100
        notification_event_spy.callCount.should.be.equal(0);


        subscription.setPublishingMode(true);

        this.clock.tick(4* subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(4);
        notification_event_spy.callCount.should.be.greaterThan(19);
        var nb = notification_event_spy.callCount;

        subscription.setPublishingMode(false);
        this.clock.tick(4* subscription.publishingInterval * subscription.maxKeepAliveCount);
        keepalive_event_spy.callCount.should.equal(8);
        notification_event_spy.callCount.should.be.equal(nb);

        clearInterval(t);

        subscription.terminate();
        done();

    })
});

describe("Subscription#adjustSamplingInterval", function () {

    beforeEach(function () {
//xx        this.clock = sinon.useFakeTimers();
        reconstruct_fake_publish_engine();
    });

    it("should have a minimum sampling interval, with a strictly positive value ( which is the fastest possible rate)", function () {
        MonitoredItem.minimumSamplingInterval.should.be.greaterThan(4);
    });

    it("should have a default sampling interval, greater than minimumSamplingInterval ", function () {
        MonitoredItem.defaultSamplingInterval.should.be.greaterThan(MonitoredItem.minimumSamplingInterval);
    });

    it("should have a maximum sampling interval, greater than defaultSamplingInterval ", function () {
        MonitoredItem.maximumSamplingInterval.should.be.greaterThan(MonitoredItem.defaultSamplingInterval);
    });

    it("should adjust sampling interval to subscription publish interval when requested sampling interval === -1", function () {
        var subscription = new Subscription({publishingInterval: 1234, publishEngine: fake_publish_engine});


        subscription.adjustSamplingInterval(-1).should.eql(subscription.publishingInterval);

        subscription.terminate();
    });

    var fake_node = {
        readAttribute: function (context, attributeId) {
            context.should.be.instanceOf(SessionContext);
            attributeId.should.eql(AttributeIds.MinimumSamplingInterval);
            return  new DataValue({value: {dataType: DataType.Double, value: 0.0 }});
        }
    };

    it("should adjust sampling interval to subscription publish interval when requested sampling interval is a negative value !== -1", function () {
        var subscription = new Subscription({publishingInterval: 1234, publishEngine: fake_publish_engine});
        subscription.adjustSamplingInterval(-2,fake_node).should.eql(subscription.publishingInterval);
        subscription.adjustSamplingInterval(-0.02,fake_node).should.eql(subscription.publishingInterval);

        subscription.terminate();
    });

    it("should leave sampling interval to 0 when requested sampling interval === 0 ( 0 means Event Based mode)", function () {
        var subscription = new Subscription({publishingInterval: 1234, publishEngine: fake_publish_engine});
        subscription.adjustSamplingInterval(0,fake_node).should.eql(0);
        subscription.terminate();
    });

    it("should adjust sampling interval to minimum when requested sampling interval === 1", function () {
        var subscription = new Subscription({publishingInterval: 1234, publishEngine: fake_publish_engine});
        subscription.adjustSamplingInterval(1,fake_node).should.eql(MonitoredItem.minimumSamplingInterval);
        subscription.terminate();
    });

    it("should adjust sampling interval to maximum when requested sampling interval is too high", function () {
        var subscription = new Subscription({publishingInterval: 1234, publishEngine: fake_publish_engine});
        subscription.adjustSamplingInterval(1E10,fake_node).should.eql(MonitoredItem.maximumSamplingInterval);
        subscription.terminate();
    });

    it("should return an unmodified sampling interval when requested sampling is in valid range", function () {
        var subscription = new Subscription({publishingInterval: 1234, publishEngine: fake_publish_engine});
        var someValidSamplingInterval = (MonitoredItem.maximumSamplingInterval + MonitoredItem.minimumSamplingInterval) / 2.0;
        subscription.adjustSamplingInterval(someValidSamplingInterval,fake_node).should.eql(someValidSamplingInterval);
        subscription.terminate();
    });

    it("should adjust sampling interval the minimumSamplingInterval when requested sampling is too low", function () {
        var subscription = new Subscription({publishingInterval: 1234, publishEngine: fake_publish_engine});
        var someVeryLowSamplingInterval = 1;
        subscription.adjustSamplingInterval(someVeryLowSamplingInterval,fake_node).should.eql(MonitoredItem.minimumSamplingInterval);
        subscription.terminate();
    });

});

