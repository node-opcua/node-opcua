/*global require,describe,it,before,beforeEach,after,afterEach*/
"use strict";
require("requirish")._(module);

var should = require("should");
var sinon = require("sinon");

var subscription_service = require("lib/services/subscription_service");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var Subscription = require("lib/server/subscription").Subscription;

var TimestampsToReturn = require("lib/services/read_service").TimestampsToReturn;

var MonitoredItemCreateRequest = subscription_service.MonitoredItemCreateRequest;

var DataType = require("lib/datamodel/variant").DataType;
var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;


var fake_publish_engine = {
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

var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var server_engine = require("lib/server/server_engine");
var ServerEngine = server_engine.ServerEngine;

describe("Subscriptions and MonitoredItems", function () {

    var address_space;
    var someVariableNode;
    var engine;
    before(function (done) {
        resourceLeakDetector.start();
        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {
            address_space = engine.address_space;
            var node = address_space.addVariable("RootFolder", {
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
        resourceLeakDetector.stop();
    });

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });
    afterEach(function () {
        this.clock.restore();
    });

    it("a subscription should accept monitored item", function (done) {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });


        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {nodeId: someVariableNode},
            monitoringMode: subscription_service.MonitoringMode.Reporting,

            requestedParameters: {
                queueSize: 10,
                samplingInterval: 100
            }
        });

        subscription.monitoredItemCount.should.eql(0);

        var monitoredItemCreateResult = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest);
        monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

        //xx require("lib/utils").dump(monitoredItemCreateResult);
        subscription.monitoredItemCount.should.eql(1);

        monitoredItemCreateResult.should.be.instanceOf(subscription_service.MonitoredItemCreateResult);

        monitoredItemCreateResult.monitoredItemId.should.eql(1);
        monitoredItemCreateResult.revisedSamplingInterval.should.eql(100);

        subscription.on("terminated", function () {
            // monitored Item shall be deleted at this stage
            subscription.monitoredItemCount.should.eql(0);
            done();
        });
        subscription.terminate();

    });


    it("a subscription should collect monitored item notification with collectDataChangeNotification", function (done) {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });


        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {nodeId: someVariableNode},
            monitoringMode: subscription_service.MonitoringMode.Reporting,
            requestedParameters: {
                queueSize: 10,
                samplingInterval: 100
            }
        });

        var monitoredItemCreateResult = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest);
        monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

        // at first, collectDataChangeNotification  should collect nothing
        var notifications = subscription.collectDataChangeNotification();
        should(notifications.length).equal(0);

        // now simulate some data change
        this.clock.tick(100);
        monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));

        this.clock.tick(100);
        monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));

        monitoredItem.queue.length.should.eql(2);

        // then, collectDataChangeNotification  should collect at least 2 values
        notifications = subscription.collectDataChangeNotification();
        notifications.length.should.eql(1);
        notifications[0].monitoredItems.length.should.eql(2);
        notifications[0].monitoredItems[0].clientHandle.should.eql(monitoredItem.clientHandle);

        subscription.on("terminated", function () {
            done();
        });
        subscription.terminate();

    });

    it("a subscription should collect monitored item notification at publishing interval", function (done) {


        var publishEngine = new ServerSidePublishEngine();

        function simulate_client_adding_publish_request(publishEngine, callback) {
            var publishRequest = new subscription_service.PublishRequest({});
            publishEngine._on_PublishRequest(publishRequest, callback);
        }


        var subscription = new Subscription({
            publishingInterval: 500,
            maxKeepAliveCount: 20,
            publishEngine: publishEngine,
            publishingEnabled: true
        });
        subscription.id = 1000;
        publishEngine.add_subscription(subscription);

        // let spy the notifications event handler
        var spy_notification_event = sinon.spy();
        subscription.on("notification", spy_notification_event);

        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {nodeId: someVariableNode},
            monitoringMode: subscription_service.MonitoringMode.Reporting,
            requestedParameters: {
                clientHandle: 123,
                queueSize: 10,
                samplingInterval: 100
            }
        });

        simulate_client_adding_publish_request(subscription.publishEngine);
        simulate_client_adding_publish_request(subscription.publishEngine);
        simulate_client_adding_publish_request(subscription.publishEngine);

        var monitoredItemCreateResult = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest);

        monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);
        monitoredItem.samplingInterval.should.eql(100);

        // now simulate some data change
        this.clock.tick(100);
        monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));

        this.clock.tick(100);
        monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));

        this.clock.tick(100);
        monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem.queue.length.should.eql(3);


        this.clock.tick(800);

        // monitoredItem values should have been harvested by subscription timer by now
        monitoredItem.queue.length.should.eql(0);

        //xx dump(subscription._pending_notifications);

        // now let the subscription send a PublishResponse to the client
        this.clock.tick(100);
        monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 2000}}));
        this.clock.tick(100);
        monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 2001}}));
        this.clock.tick(100);
        monitoredItem.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 2002}}));
        monitoredItem.queue.length.should.eql(3);
        this.clock.tick(800);

        // monitoredItem values should have been harvested by subscription timer by now
        monitoredItem.queue.length.should.eql(0);

        spy_notification_event.callCount.should.be.equal(2);


        subscription.on("terminated", function () {
            done();
        });
        subscription.terminate();

    });


    it("should provide a mean to access the monitored clientHandle ( using the standard OPCUA method getMonitoredItems)", function (done) {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });

        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {nodeId: someVariableNode},
            monitoringMode: subscription_service.MonitoringMode.Reporting,
            requestedParameters: {
                clientHandle: 123,
                queueSize: 10,
                samplingInterval: 100
            }
        });

        var monitoredItemCreateResult = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest);
        monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

        var result = subscription.getMonitoredItems({});
        result.statusCode.should.eql(StatusCodes.Good);
        result.serverHandles.map(parseInt).should.eql([monitoredItem.monitoredItemId]);
        result.clientHandles.map(parseInt).should.eql([monitoredItem.clientHandle]);

        subscription.terminate();
        done();
    });


    it("should return an error when filter is DataChangeFilter deadband is out of bound", function (done) {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });

        function _create_MonitoredItemCreateRequest_with_deadbandValue(value) {
            return new MonitoredItemCreateRequest({
                itemToMonitor: {nodeId: someVariableNode},
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new subscription_service.DataChangeFilter({
                        trigger: subscription_service.DataChangeTrigger.Status,
                        deadbandType: subscription_service.DeadbandType.Percent,
                        deadbandValue: value
                    })
                }
            });

        }

        var monitoredItemCreateRequest1 = _create_MonitoredItemCreateRequest_with_deadbandValue(-10);
        var monitoredItemCreateResult1 = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest1);
        monitoredItemCreateResult1.statusCode.should.eql(StatusCodes.BadDeadbandFilterInvalid);

        var monitoredItemCreateRequest2 = _create_MonitoredItemCreateRequest_with_deadbandValue(110);
        var monitoredItemCreateResult2 = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest2);
        monitoredItemCreateResult2.statusCode.should.eql(StatusCodes.BadDeadbandFilterInvalid);

        var monitoredItemCreateRequest3 = _create_MonitoredItemCreateRequest_with_deadbandValue(90);
        var monitoredItemCreateResult3 = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest3);
        monitoredItemCreateResult3.statusCode.should.eql(StatusCodes.Good);

        subscription.terminate();
        done();
    });

});

var ServerSidePublishEngine = require("lib/server/server_publish_engine").ServerSidePublishEngine;

describe("#maxNotificationsPerPublish", function () {

    var address_space;
    var someVariableNode;
    var engine;
    var publishEngine;
    before(function (done) {
        resourceLeakDetector.start();
        publishEngine = new ServerSidePublishEngine();
        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {
            address_space = engine.address_space;
            var node = address_space.addVariable("RootFolder", {
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
        if (publishEngine) {
            publishEngine.shutdown();
        }
        resourceLeakDetector.stop();
    });


    function simulate_client_adding_publish_request(callback) {
        var publishRequest = new subscription_service.PublishRequest({});
        publishEngine._on_PublishRequest(publishRequest, callback);
    }

    //function __callback(err, publishResponse) {
    //    should(err).eql(null);
    //    console.log(" subscription Id  ".yellow, publishResponse.subscriptionId);
    //    console.log(" more notification  ".yellow, publishResponse.moreNotifications);
    //
    //    var notificationData = publishResponse.notificationMessage.notificationData;
    //    //xx console.log(" PublishResponse with ",notificationData);
    //    console.log(" PublishResponse with ".yellow, notificationData[0].monitoredItems.length, " notifications");
    //
    //}

    beforeEach(function () {
        this.clock = sinon.useFakeTimers();
    });
    afterEach(function () {
        this.clock.restore();

    });
    it("should have a proper maxNotificationsPerPublish default value", function (done) {
        var subscription = new Subscription({
            publishEngine: publishEngine
        });
        subscription.id = 1;
        publishEngine.add_subscription(subscription);
        subscription.maxNotificationsPerPublish.should.eql(0);

        publishEngine.remove_subscription(subscription);
        subscription.terminate();

        done();
    });
    function numberOfnotifications(publishResponse) {
        var notificationData = publishResponse.notificationMessage.notificationData;

        return notificationData.reduce(function (accumulated, data) {
            return accumulated + data.monitoredItems.length;
        }, 0);
    }

    function createMonitoredItem(subscription, clientHandle) {
        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {nodeId: someVariableNode},
            monitoringMode: subscription_service.MonitoringMode.Reporting,
            requestedParameters: {
                clientHandle: clientHandle,
                queueSize: 10,
                samplingInterval: 100
            }
        });

        var monitoredItemCreateResult = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest);
        monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);
        should(monitoredItem).not.eql(null);
        return monitoredItem;
    }

    it("should not publish more notifications than expected", function (done) {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: publishEngine,
            maxNotificationsPerPublish: 3,
        });
        subscription.id = 2;
        publishEngine.add_subscription(subscription);

        subscription.maxNotificationsPerPublish.should.eql(3);

        //xx // let spy the notifications event handler
        //xx var spy_notification_event = sinon.spy();
        //xx subscription.on("notification", spy_notification_event);


        var monitoredItem1 = createMonitoredItem(subscription, 123);
        var monitoredItem2 = createMonitoredItem(subscription, 124);
        var monitoredItem3 = createMonitoredItem(subscription, 125);
        var monitoredItem4 = createMonitoredItem(subscription, 126);


        var spy_callback = sinon.spy();

        // simulate client sending publish request
        simulate_client_adding_publish_request(spy_callback);
        simulate_client_adding_publish_request(spy_callback);
        simulate_client_adding_publish_request(spy_callback);
        simulate_client_adding_publish_request(spy_callback);
        simulate_client_adding_publish_request(spy_callback);
        simulate_client_adding_publish_request(spy_callback);
        simulate_client_adding_publish_request(spy_callback);
        simulate_client_adding_publish_request(spy_callback);


        // now simulate some data change on monitored items
        this.clock.tick(100);
        monitoredItem1.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1000}}));
        monitoredItem2.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 2000}}));
        monitoredItem3.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 3000}}));
        monitoredItem4.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 4000}}));
        this.clock.tick(100);
        monitoredItem1.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1001}}));
        monitoredItem2.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 2001}}));
        monitoredItem3.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 3001}}));
        monitoredItem4.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 4001}}));
        this.clock.tick(100);
        monitoredItem1.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 1002}}));
        monitoredItem2.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 2002}}));
        monitoredItem3.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 3002}}));
        monitoredItem4.recordValue(new DataValue({value: {dataType: DataType.UInt32, value: 4002}}));

        monitoredItem1.queue.length.should.eql(3);
        monitoredItem2.queue.length.should.eql(3);
        monitoredItem3.queue.length.should.eql(3);
        monitoredItem4.queue.length.should.eql(3);

        this.clock.tick(800);

        // now data should have been harvested
        // monitoredItem values should have been harvested by subscription timer by now
        monitoredItem1.queue.length.should.eql(0);
        monitoredItem2.queue.length.should.eql(0);
        monitoredItem3.queue.length.should.eql(0);
        monitoredItem4.queue.length.should.eql(0);

        // verify that publishResponse has been send
        var publishResponse1 = spy_callback.getCall(0).args[1];
        numberOfnotifications(publishResponse1).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
        publishResponse1.moreNotifications.should.eql(true);

        var publishResponse2 = spy_callback.getCall(1).args[1];
        numberOfnotifications(publishResponse2).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
        publishResponse2.moreNotifications.should.eql(true);

        var publishResponse3 = spy_callback.getCall(3).args[1];
        numberOfnotifications(publishResponse3).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
        publishResponse3.moreNotifications.should.eql(false);


        publishEngine.remove_subscription(subscription);
        subscription.terminate();
        done();
    });

    //
    xit("#monitoringMode Publish / should always result in the server sending an \"initial\" data change. " +
        " after monitoringMode is set to Disabled and then Reporting,", function (done) {
        // todo

        done();
    });

});


