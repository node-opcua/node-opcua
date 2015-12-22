/* global: require,describe,it,before,beforeEach,after,afterEach */
"use strict";
require("requirish")._(module);
var should = require("should");
var sinon = require("sinon");

var subscription_service = require("lib/services/subscription_service");

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var Subscription = require("lib/server/subscription").Subscription;
var MonitoredItem = require("lib/server/monitored_item").MonitoredItem;
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;

var fake_publish_engine = {};

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var fakeNotificationData =[new subscription_service.DataChangeNotification()];

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
        }
    };
}

var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;

function install_spying_samplingFunc() {
    var sample_value=0;
    var spy_samplingEventCall = sinon.spy(function(oldValue,callback){
        sample_value++;
        var dataValue = new DataValue({value: {dataType: DataType.UInt32, value: sample_value}});
        callback(null,dataValue);
    });
    return spy_samplingEventCall;
}

describe("Subscriptions", function () {

    before(function () {
        resourceLeakDetector.start();
    });
    after(function () {
        resourceLeakDetector.stop();
    });
    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
        reconstruct_fake_publish_engine();
    });

    afterEach(function () {
        this.clock.restore();
    });

    it("a subscription will make sure that lifeTimeCount is at least 3 times  maxKeepAliveCount", function () {

        {
            var subscription1 = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                lifeTimeCount: 60, // at least 3 times maxKeepAliveCount
                //
                publishEngine: fake_publish_engine
            });
            subscription1.maxKeepAliveCount.should.eql(20);
            subscription1.lifeTimeCount.should.eql(60);

            subscription1.terminate();

        }
        {
            var subscription2 = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                lifeTimeCount: 1, // at least 3 times maxKeepAliveCount
                //
                publishEngine: fake_publish_engine
            });
            subscription2.maxKeepAliveCount.should.eql(20);
            subscription2.lifeTimeCount.should.eql(60);
            subscription2.terminate();
        }

    });

    it("a subscription that have a new notification ready every publishingInterval shall send notifications and no keepalive", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            lifeTimeCount: 60, // at least 3 times maxKeepAliveCount
            //
            publishEngine: fake_publish_engine
        });

        // pretend we have received 10 PublishRequest from client
        fake_publish_engine.pendingPublishRequestCount = 10;

        subscription.maxKeepAliveCount.should.eql(20);

        subscription.on("perform_update", function () {
            //  pretend there is always something to notify
            this.addNotificationMessage([new subscription_service.DataChangeNotification()]);
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

        subscription.on("perform_update", function () {
            /* pretend that we do not have a notification ready */
        });

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        //subscription.on("notification", function(){
        //    subscription.popNotificationToSend();
        //});
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        // no notification ready, during 7 seconds
        this.clock.tick(subscription.publishingInterval * 7);

        notification_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);

        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);
        subscription.hasPendingNotifications.should.eql(true);

        this.clock.tick(subscription.publishingInterval * 4);

        notification_event_spy.callCount.should.equal(1);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);

        // a other notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);

        this.clock.tick(subscription.publishingInterval * 4);
        notification_event_spy.callCount.should.equal(2);
        keepalive_event_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(0);

        subscription.terminate();

    });

    describe("a subscription shall send its first notification as soon as the publish request is available", function () {
        var server_engine = require("lib/server/server_engine");
        var DataType = require("lib/datamodel/variant").DataType;

        var addressSpace;
        var someVariableNode;
        var engine;
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

        var ServerSidePublishEngine = require("lib/server/server_publish_engine").ServerSidePublishEngine;
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
                publishingInterval: 100,
                maxKeepAliveCount: 10,
                lifeTimeCount: 30,
                publishingEnabled: true,
                publishEngine: publish_engine
            });
            subscription.id = 1000;
            publish_engine.add_subscription(subscription);

            notification_event_spy = sinon.spy();
            keepalive_event_spy = sinon.spy();
            expire_event_spy = sinon.spy();
            subscription.on("notification", notification_event_spy);
            subscription.on("keepalive", keepalive_event_spy);
            subscription.on("expired", expire_event_spy);

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = install_spying_samplingFunc();
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

            this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            keepalive_event_spy.callCount.should.eql(1);
            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(1);
            done();

        });
        it(" - case 2  - publish Request arrives late (after first publishInterval is over)", function (done) {
            // now simulate some data change
            this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);

            keepalive_event_spy.callCount.should.eql(0);
            simulate_client_adding_publish_request(subscription.publishEngine);
            keepalive_event_spy.callCount.should.eql(1);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(1);

            done();

        });
        it(" - case 3  - publish Request arrives late (after first publishInterval is over)", function (done) {

            this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            keepalive_event_spy.callCount.should.eql(0);
            subscription.state.key.should.eql("LATE");

            // now simulate some data change
            //xx monitoredItem.recordValue({value: {dataType: DataType.UInt32, value: 1000}});
            subscription.addNotificationMessage(fakeNotificationData);

            notification_event_spy.callCount.should.eql(0);
            simulate_client_adding_publish_request(subscription.publishEngine);
            notification_event_spy.callCount.should.eql(1);

            this.clock.tick(subscription.publishingInterval);
            subscription.state.key.should.eql("LATE");

            keepalive_event_spy.callCount.should.eql(0);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);

            done();

        });
        it(" - case 3(with monitoredItem) - publish Request arrives late (after first publishInterval is over)", function (done) {

            var TimestampsToReturn = require("lib/services/read_service").TimestampsToReturn;
            var MonitoredItemCreateRequest = subscription_service.MonitoredItemCreateRequest;
            var DataType = require("lib/datamodel/variant").DataType;
            var DataValue = require("lib/datamodel/datavalue").DataValue;
            var Variant = require("lib/datamodel/variant").Variant;

            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {nodeId: someVariableNode},
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    clientHandle: 123,
                    queueSize: 10,
                    samplingInterval: 100
                }
            });
            var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);

            var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);


            this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            keepalive_event_spy.callCount.should.eql(0);
            subscription.state.key.should.eql("LATE");

            // now simulate some data change
            monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));

            notification_event_spy.callCount.should.eql(0);
            simulate_client_adding_publish_request(subscription.publishEngine);
            notification_event_spy.callCount.should.eql(1);
            subscription.state.key.should.eql("NORMAL");

            this.clock.tick(subscription.publishingInterval);
            subscription.state.key.should.eql("LATE");

            keepalive_event_spy.callCount.should.eql(0);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
            done();
        });

        it(" - case 3(with monitoredItem - 3x value writes) - publish Request arrives late (after first publishInterval is over)", function (done) {

            var TimestampsToReturn = require("lib/services/read_service").TimestampsToReturn;
            var MonitoredItemCreateRequest = subscription_service.MonitoredItemCreateRequest;
            var DataType = require("lib/datamodel/variant").DataType;
            var DataValue = require("lib/datamodel/datavalue").DataValue;
            var Variant = require("lib/datamodel/variant").Variant;

            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {nodeId: someVariableNode},
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    clientHandle: 123,
                    queueSize: 10,
                    samplingInterval: 100
                }
            });
            var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

            this.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount / 2);
            keepalive_event_spy.callCount.should.eql(0);
            subscription.state.key.should.eql("LATE");

            // now simulate some data change
            monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
            notification_event_spy.callCount.should.eql(0);
            simulate_client_adding_publish_request(subscription.publishEngine);
            notification_event_spy.callCount.should.eql(1);
            subscription.state.key.should.eql("NORMAL");

            this.clock.tick(subscription.publishingInterval);
            subscription.state.key.should.eql("LATE");

            monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
            subscription.state.key.should.eql("LATE");

            simulate_client_adding_publish_request(subscription.publishEngine);
            notification_event_spy.callCount.should.eql(2);

            this.clock.tick(subscription.publishingInterval);
            monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
            subscription.state.key.should.eql("LATE");
            simulate_client_adding_publish_request(subscription.publishEngine);
            notification_event_spy.callCount.should.eql(3);


            subscription.state.key.should.eql("NORMAL");
            keepalive_event_spy.callCount.should.eql(0);

            this.clock.tick(subscription.publishingInterval);
            keepalive_event_spy.callCount.should.eql(0);
            done();
        });


    });


    it("a subscription that hasn't been pinged by client within the lifetime interval shall terminate", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });
        subscription.on("perform_update", function () {
            this.addNotificationMessage(fakeNotificationData);
        });

        var expire_event_spy = sinon.spy();
        subscription.on("expired", expire_event_spy);
        var terminate_spy = sinon.spy(subscription, "terminate");

        this.clock.tick(subscription.publishingInterval * (subscription.lifeTimeCount - 2));

        terminate_spy.callCount.should.equal(0);
        expire_event_spy.callCount.should.equal(0);

        this.clock.tick(subscription.publishingInterval * (subscription.lifeTimeCount + 2));

        terminate_spy.callCount.should.equal(1);
        expire_event_spy.callCount.should.equal(1);

        subscription.terminate();

    });

    it("a subscription that has been pinged by client before the lifetime expiration shall not terminate", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });
        subscription.on("perform_update", function () {
            this.addNotificationMessage(fakeNotificationData);
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

    it("a subscription that has no notification within maxKeepAliveCount shall send a keepalive signal ", function () {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 1000,
            lifeTimeCount: 100000, // very large lifetime not to be bother by client not pinging us
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
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

    it("a subscription shall maintain a retransmission queue of pending NotificationMessages.", function () {

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });

        subscription.pendingNotificationsCount.should.equal(0);
        subscription.addNotificationMessage(fakeNotificationData);
        subscription.pendingNotificationsCount.should.equal(1);

        subscription.terminate();


    });

    //OPC Unified Architecture, Part 4 74 Release 1.01
    it("a subscription shall maintain a retransmission queue of sent NotificationMessages.", function () {

        var subscription = new Subscription({
            id: 1234,
            publishingInterval: 1000,
            lifeTimeCount: 1000,
            maxKeepAliveCount: 20,
            //
            publishEngine: fake_publish_engine
        });

        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationsCount.should.equal(0);

        subscription.addNotificationMessage(fakeNotificationData);
        subscription.pendingNotificationsCount.should.equal(1);
        subscription.sentNotificationsCount.should.equal(0);

        subscription.popNotificationToSend();
        subscription.pendingNotificationsCount.should.equal(0);
        subscription.sentNotificationsCount.should.equal(1);

        subscription.terminate();


    });
    describe("NotificationMessages are retained in this queue until they are acknowledged or until they have been in the queue for a minimum of one keep-alive interval.", function () {

        it("a NotificationMessage is retained in this queue until it is acknowledged", function () {

            var subscription = new Subscription({
                id: 1234,
                publishingInterval: 1000,
                lifeTimeCount: 1000,
                maxKeepAliveCount: 20,
                //
                publishEngine: fake_publish_engine
            });

            subscription.addNotificationMessage(fakeNotificationData);
            subscription.addNotificationMessage(fakeNotificationData);
            subscription.pendingNotificationsCount.should.equal(2);
            subscription.sentNotificationsCount.should.equal(0);

            var notification1 = subscription.popNotificationToSend();
            subscription.pendingNotificationsCount.should.equal(1);
            subscription.sentNotificationsCount.should.equal(1);

            var notification2 = subscription.popNotificationToSend();
            subscription.pendingNotificationsCount.should.equal(0);
            subscription.sentNotificationsCount.should.equal(2);

            subscription.acknowledgeNotification(notification2.sequenceNumber);
            subscription.pendingNotificationsCount.should.equal(0);
            subscription.sentNotificationsCount.should.equal(1);

            subscription.acknowledgeNotification(notification1.sequenceNumber);
            subscription.pendingNotificationsCount.should.equal(0);
            subscription.sentNotificationsCount.should.equal(0);

            subscription.terminate();

        });

        it("A notificationMessage that hasn't been acknowledge should be accessiblef for republish", function () {
            //#getMessageForSequenceNumber
            var subscription = new Subscription({
                id: 1234,
                publishingInterval: 1000,
                lifeTimeCount: 1000,
                maxKeepAliveCount: 20,
                //
                publishEngine: fake_publish_engine
            });

            should(subscription.getMessageForSequenceNumber(35)).eql(null);


            subscription.addNotificationMessage(fakeNotificationData);
            subscription.addNotificationMessage(fakeNotificationData);
            subscription.pendingNotificationsCount.should.equal(2);
            subscription.sentNotificationsCount.should.equal(0);

            var notification1 = subscription.popNotificationToSend();

            var seqNum = notification1.sequenceNumber;
            subscription.pendingNotificationsCount.should.equal(1);
            subscription.sentNotificationsCount.should.equal(1);


            //
            var notification2 = subscription.getMessageForSequenceNumber(seqNum);
            notification2.sequenceNumber.should.eql(seqNum);
            notification2.should.eql(notification1);

            subscription.terminate();

        });


        it("1.02 the server shall retain a maximum number of un-acknowledge NotificationMessage until they are acknoledged", function () {
            // TODO
        });

        xit("1.01 a NotificationMessage is retained until it has been in the queue for a minimum of one keep-alive interval.", function () {
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
            subscription.popNotificationToSend();
            subscription.sentNotificationsCount.should.equal(1);

            this.clock.tick(1000 * 5);
            // create a notification at t=1000*5
            subscription.addNotificationMessage(fakeNotificationData);
            subscription.popNotificationToSend();
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


    it("a subscription that have no monitored items shall not terminate if client has sent enough PublishRequest", function () {

        // pretend there is plenty of PublishRequest in publish engine
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishEngine: fake_publish_engine
        });

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(3000);

        subscription.publishIntervalCount.should.equal(30,
            " 3000 ms with a publishingInterval: 100 ms means publishIntervalCount = 30");


        expire_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(6);
        notification_event_spy.callCount.should.equal(0);

        this.clock.tick(3000);
        expire_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(12);
        notification_event_spy.callCount.should.equal(0);

        this.clock.tick(3000);
        expire_event_spy.callCount.should.equal(0);
        keepalive_event_spy.callCount.should.equal(18);
        notification_event_spy.callCount.should.equal(0);

        subscription.terminate();
    });

    it("a subscription send a first message at the end of the first publishing cycle without waiting for the maximum  count to be reached", function () {
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

        // pretend that we already have notification messages
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);

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

    it("the first Notification Message sent on a Subscription has a sequence number of 1.", function () {
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

    it("should return BadMonitorItemInvalid when trying to remove a monitored item that doesn't exist", function () {

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

    before(function () {
        resourceLeakDetector.start();
    });
    after(function () {
        resourceLeakDetector.stop();
    });

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
        reconstruct_fake_publish_engine();
    });

    afterEach(function () {
        this.clock.restore();
    });
    it("a subscription created with publishingEnabled=true shall emit notification", function (done) {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishingEnabled: true,              //  PUBLISHING IS ENABLED !!!
            publishEngine: fake_publish_engine
        });


        // pretend that we already have notification messages
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(400);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.be.greaterThan(4);

        subscription.terminate();

        done();
    });

    it("a subscription created with publishingEnabled=false shall not emit notification (but keepalive)", function (done) {

        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishingEnabled: false,              //  PUBLISHING IS DISABLED !!!
            publishEngine: fake_publish_engine

        });


        // pretend that we already have notification messages
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);
        // a notification finally arrived !
        subscription.addNotificationMessage(fakeNotificationData);

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(2000);
        keepalive_event_spy.callCount.should.equal(4);
        notification_event_spy.callCount.should.eql(0);

        subscription.terminate();
        done();
    });

    it("a publishing subscription can be disabled and re-enabled", function (done) {
        // pretend the client has sent many pending PublishRequests
        fake_publish_engine.pendingPublishRequestCount = 1000;

        var subscription = new Subscription({
            publishingInterval: 100,
            maxKeepAliveCount: 5,
            lifeTimeCount: 10,
            publishingEnabled: true,              //  PUBLISHING IS ENABLED !!!
            publishEngine: fake_publish_engine
        });

        // pretend that we already have notification messages
        function push_some_notification() {
            subscription.addNotificationMessage(fakeNotificationData);
        }

        var t = setInterval(push_some_notification, 50);

        var notification_event_spy = sinon.spy();
        var keepalive_event_spy = sinon.spy();
        var expire_event_spy = sinon.spy();

        subscription.on("notification", notification_event_spy);
        subscription.on("keepalive", keepalive_event_spy);
        subscription.on("expired", expire_event_spy);

        this.clock.tick(2000);
        keepalive_event_spy.callCount.should.equal(0);
        notification_event_spy.callCount.should.be.greaterThan(20);


        // now disable
        subscription.setPublishingMode(false);
        this.clock.tick(2000);
        keepalive_event_spy.callCount.should.equal(4);
        notification_event_spy.callCount.should.be.greaterThan(20);

        subscription.setPublishingMode(true);
        this.clock.tick(2000);
        keepalive_event_spy.callCount.should.equal(4);
        notification_event_spy.callCount.should.be.greaterThan(40);

        clearInterval(t);

        subscription.terminate();
        done();


    });

});

describe("Subscription#adjustSamplingInterval", function () {

    before(function () {
        resourceLeakDetector.start();
    });
    after(function () {
        resourceLeakDetector.stop();
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
        readAttribute: function(attributeId) {

            attributeId.should.eql(AttributeIds.MinimumSamplingInterval);
            return  new DataValue({value: {dataType: DataType.UInt32, value: 0 }});
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

