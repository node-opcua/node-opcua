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
var AttributeIds = require("lib/datamodel/attributeIds").AttributeIds;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;

var encode_decode = require("lib/misc/encode_decode");

var now = (new Date()).getTime();

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


var DataValue = require("lib/datamodel/datavalue").DataValue;
var DataType = require("lib/datamodel/variant").DataType;

var dataSourceFrozen = false
function freeze_data_source() {
    dataSourceFrozen = true;
}
function unfreeze_data_source() {
    dataSourceFrozen = false;
}

function install_spying_samplingFunc() {
    unfreeze_data_source();
    var sample_value = 0;
    var spy_samplingEventCall = sinon.spy(function (oldValue, callback) {
        if (!dataSourceFrozen) {
            sample_value++;
        }
        var dataValue = new DataValue({value: {dataType: DataType.UInt32, value: sample_value}});
        callback(null, dataValue);
    });
    return spy_samplingEventCall;
}


var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var server_engine = require("lib/server/server_engine");
var ServerEngine = server_engine.ServerEngine;
var address_space_for_conformance_testing = require("lib/simulation/address_space_for_conformance_testing");
var build_address_space_for_conformance_testing = address_space_for_conformance_testing.build_address_space_for_conformance_testing;

describe("Subscriptions and MonitoredItems", function () {

    this.timeout(Math.max(300000,this._timeout));

    var address_space;
    var someVariableNode;

    var engine;
    before(function (done) {
        resourceLeakDetector.start();
        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {
            address_space = engine.address_space;

            // build_address_space_for_conformance_testing(engine, {mass_variables: false});

            var node = address_space.addVariable("RootFolder", {
                browseName: "SomeVariable",
                dataType: "UInt32",
                value: {dataType: DataType.UInt32, value: 0}
            });

            someVariableNode = node.nodeId;


            function addVar(typeName, value) {
                address_space.addVariable("RootFolder", {
                    nodeId: "ns=100;s=Static_" + typeName,
                    browseName: "Static_" + typeName,
                    dataType: typeName,
                    value: {dataType: DataType[typeName], value: value}
                });

            }

            addVar("LocalizedText", {text: "Hello"});
            addVar("ByteString", new Buffer("AZERTY"));
            addVar("SByte", 0);
            addVar("Int16", 0);
            addVar("Int32", 0);
            addVar("Int64", 0);
            addVar("Byte", 0);
            addVar("UInt16", 0);
            addVar("UInt32", 0);
            addVar("UInt64", 0);
//xx            addVar("Duration"     , 0);
            addVar("Float", 0);
            addVar("Double", 0);


            done();
        });
    });
    after(function () {
        engine.shutdown();
        engine = null;
        resourceLeakDetector.stop();
    });

    beforeEach(function () {
        this.clock = sinon.useFakeTimers(now);
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
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
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

        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
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
        monitoredItemCreateResult.revisedSamplingInterval.should.eql(100);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

        // at first, collectDataChangeNotification  should has 1 notification with current dataItem value
        var notifications = subscription.collectDataChangeNotification();
        should(notifications.length).equal(1);

        // now simulate some data change
        this.clock.tick(500);

        monitoredItem.queue.length.should.eql(5);

        // then, collectDataChangeNotification  should collect at least 2 values
        notifications = subscription.collectDataChangeNotification();
        notifications.length.should.eql(1);
        notifications[0].monitoredItems.length.should.eql(5);
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
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
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


        // initial value shall  allready be in the queue
        monitoredItem.queue.length.should.eql(1);
        // now simulate some data change
        this.clock.tick(3 * 100);
        monitoredItem.queue.length.should.eql(4);

        freeze_data_source();

        this.clock.tick(800);

        // monitoredItem values should have been harvested by subscription timer by now
        monitoredItem.queue.length.should.eql(0);

        //xx dump(subscription._pending_notifications);

        unfreeze_data_source();

        // now let the subscription send a PublishResponse to the client
        this.clock.tick(3 * 100);
        monitoredItem.queue.length.should.eql(3);

        freeze_data_source();
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
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
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
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });


        function _create_MonitoredItemCreateRequest_with_deadbandValue(value) {
            return new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: someVariableNode,
                    attributeId: AttributeIds.Value
                },
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

    it("should return BadFilterNotAllowed if a DataChangeFilter is specified on a non-Value Attribute monitored item", function () {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_attributeId(attributeId, statusCode) {
            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: someVariableNode,
                    attributeId: attributeId
                },
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new subscription_service.DataChangeFilter({
                        trigger: subscription_service.DataChangeTrigger.Status,
                        deadbandType: subscription_service.DeadbandType.Percent,
                        deadbandValue: 10
                    })
                }
            });
            var monitoredItemCreateResult = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_attributeId(AttributeIds.BrowseName).should.eql(StatusCodes.BadFilterNotAllowed);
        test_with_attributeId(AttributeIds.AccessLevel).should.eql(StatusCodes.BadFilterNotAllowed);
        test_with_attributeId(AttributeIds.ArrayDimensions).should.eql(StatusCodes.BadFilterNotAllowed);
        test_with_attributeId(AttributeIds.DataType).should.eql(StatusCodes.BadFilterNotAllowed);
        test_with_attributeId(AttributeIds.DisplayName).should.eql(StatusCodes.BadFilterNotAllowed);
        test_with_attributeId(AttributeIds.EventNotifier).should.eql(StatusCodes.BadFilterNotAllowed);
        test_with_attributeId(AttributeIds.Historizing).should.eql(StatusCodes.BadFilterNotAllowed);

        test_with_attributeId(AttributeIds.Value).should.eql(StatusCodes.Good);
        subscription.terminate();

    });

    it("should return BadFilterNotAllowed if DeadBandFilter is specified on non-Numeric value monitored item", function () {


        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_nodeId(nodeId, statusCode) {
            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new subscription_service.DataChangeFilter({
                        trigger: subscription_service.DataChangeTrigger.Status,
                        deadbandType: subscription_service.DeadbandType.Percent,
                        deadbandValue: 10
                    })
                }
            });
            var monitoredItemCreateResult = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_ByteString").should.eql(StatusCodes.BadFilterNotAllowed);
        test_with_nodeId("ns=100;s=Static_LocalizedText").should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();

    });

    describe("DeadBandFilter !!!", function () {

        var subscription = null;

        var test = this;

        before(function () {

            test = this;

            subscription = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                publishEngine: fake_publish_engine
            });
            subscription.id = 1000;
            //xx publishEngine.add_subscription(subscription);

            // let spy the notifications event handler
            var spy_notification_event = sinon.spy();
            subscription.on("notification", spy_notification_event);

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = function () {
                };//install_spying_samplingFunc();

                monitoredItem.node = address_space.findObject(monitoredItem.itemToMonitor.nodeId);
            });

        });
        after(function (done) {
            subscription.terminate();
            subscription = null;
            done();
        });

        var integerDeadband = 2;
        var integerWritesFail = [8, 7, 10];
        var integerWritesPass = [3, 6, 13];

        var floatDeadband = 2.2;
        var floatWritesFail = [2.3, 4.4, 1.6];
        var floatWritesPass = [6.4, 4.1, 8.4];

        var integer64Deadband = 2;
        var integer64WritesFail = [ [0,8], [0,7], [0,10]];
        var integer64WritesPass = [ [0,3], [0,6], [0,13]];

        /*
         Specify a filter using a deadband absolute.
         - Set the deadband value to 2.
         - Write numerous values to the item that will cause event notifications to be sent, and for some items to be filtered.
         - call Publish() to verify the deadband is correctly filtering values.
         */
        function test_deadband(dataType, deadband, writesPass, writesFail) {

            var nodeId = "ns=100;s=Static_" + dataType;
            var node = engine.address_space.findObject(nodeId);
            should(!!node).not.eql(false);
            node.minimumSamplingInterval.should.be.belowOrEqual(100);

            function simulate_nodevalue_change(currentValue) {

                var v = new Variant({dataType: DataType[dataType], value: currentValue});

                test.clock.tick(1000);

                node.setValueFromSource(v);
                node.readValue().value.value.should.eql(currentValue,"value must have been recorded");
            }

            var notifs;

            var currentValue = writesFail[0];
            simulate_nodevalue_change(currentValue);

            // create monitor item
            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 0,
                    filter: new subscription_service.DataChangeFilter({
                        trigger: subscription_service.DataChangeTrigger.StatusValue,
                        deadbandType: subscription_service.DeadbandType.Absolute,
                        deadbandValue: deadband
                    })
                }
            });


            var monitoredItemCreateResult = subscription.createMonitoredItem(
                address_space, TimestampsToReturn.Both, monitoredItemCreateRequest);
            monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);
            var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);
            monitoredItem.node = node;
            monitoredItem.queueSize.should.eql(10);
            monitoredItem.queue.length.should.eql(1);



            function simulate_publish_request_and_check_one(expectedValue) {
                test.clock.tick(100);

                // process publish
                notifs = monitoredItem.extractMonitoredItemNotifications();

                monitoredItem.queue.length.should.eql(0);

                if (expectedValue === undefined) {

                    notifs.length.should.eql(0, "should have no pending notification");

                } else {

                    notifs.length.should.eql(1," should have one pending notification");

                    var expectedValue = encode_decode["coerce"+ dataType](expectedValue);


                    // verify that value matches expected value
                    notifs[0].value.value.value.should.eql(expectedValue);

                }
            }

            simulate_publish_request_and_check_one(writesFail[0]);

            // write second value to node
            currentValue = writesFail[1];
            simulate_nodevalue_change(currentValue);
            simulate_publish_request_and_check_one(undefined);


            // write third value to node
            currentValue = writesFail[2];
            simulate_nodevalue_change(currentValue);
            simulate_publish_request_and_check_one(undefined);

            // ---------------------------------------------------------------------------------------------------------
            currentValue = writesPass[0];
            simulate_nodevalue_change(currentValue);
            simulate_publish_request_and_check_one(currentValue);

            currentValue = writesPass[1];
            simulate_nodevalue_change(currentValue);
            simulate_publish_request_and_check_one(currentValue);

            currentValue = writesPass[2];
            simulate_nodevalue_change(currentValue);
            simulate_publish_request_and_check_one(currentValue);

        }


        ["SByte", "Int16" ,"Int32" , "Byte", "UInt16","UInt32"].forEach(function (dataType) {

            it("testing with " + dataType, function () {
                test_deadband(dataType, integerDeadband, integerWritesPass, integerWritesFail);
            });

        });
        ["Float","Double"].forEach(function (dataType) {

            it("testing with " + dataType, function () {
                test_deadband(dataType, floatDeadband, floatWritesPass, floatWritesFail);
            });

        });

        ["Int64", "UInt64"].forEach(function (dataType) {

            it("testing with " + dataType, function () {
                test_deadband(dataType, integer64Deadband, integer64WritesPass, integer64WritesFail);
            });

        });

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
        this.clock = sinon.useFakeTimers(now);
    });
    afterEach(function () {
        this.clock.restore();

    });
    it("should have a proper maxNotificationsPerPublish default value", function (done) {
        var subscription = new Subscription({
            publishEngine: publishEngine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
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
            maxNotificationsPerPublish: 4
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        subscription.id = 2;
        publishEngine.add_subscription(subscription);

        subscription.maxNotificationsPerPublish.should.eql(4);

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

        this.clock.tick(100);

        this.clock.tick(100);

        freeze_data_source();

        monitoredItem1.queue.length.should.eql(4);
        monitoredItem2.queue.length.should.eql(4);
        monitoredItem3.queue.length.should.eql(4);
        monitoredItem4.queue.length.should.eql(4);

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


    describe("Subscription.subscriptionDiagnostics",function() {


        var subscription;
        beforeEach(function(){
            fake_publish_engine.pendingPublishRequestCount = 1000;

            subscription = new Subscription({
                priority: 10,
                publishingInterval: 100,
                maxNotificationsPerPublish: 123,
                maxKeepAliveCount: 5,
                lifeTimeCount: 17,
                publishingEnabled: true,              //  PUBLISHING IS ENABLED !!!
                publishEngine: fake_publish_engine
            });

            subscription.sessionId = 100;

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = install_spying_samplingFunc();
            });

        });
        function add_monitored_item() {
            var nodeId = "i=2258";
            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {nodeId: nodeId },
                monitoringMode: subscription_service.MonitoringMode.Reporting,

                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100
                }
            });
            var monitoredItemCreateResult = subscription.createMonitoredItem(address_space, TimestampsToReturn.Both, monitoredItemCreateRequest);
            monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);
            var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

            return monitoredItem;
        }

        afterEach(function() {

            subscription.terminate();
            subscription = null;
        });

        var MonitoringMode = subscription_service.MonitoringMode;


        it("should update Subscription.subscriptionDiagnostics.sessionId",function() {
            subscription.subscriptionDiagnostics.sessionId.should.eql(subscription.sessionId);
        });

        it("should update Subscription.subscriptionDiagnostics.subscriptionId",function() {
            subscription.subscriptionDiagnostics.subscriptionId.should.eql(subscription.id);
        });

        it("should update Subscription.subscriptionDiagnostics.priority",function() {
            subscription.priority.should.eql(10);
            subscription.subscriptionDiagnostics.priority.should.eql(subscription.priority);
        });
        it("should update Subscription.subscriptionDiagnostics.publishingInterval",function() {
            subscription.publishingInterval.should.eql(100);
            subscription.subscriptionDiagnostics.publishingInterval.should.eql(subscription.publishingInterval);
        });
        it("should update Subscription.subscriptionDiagnostics.maxLifetimeCount",function() {
            subscription.lifeTimeCount.should.eql(17);
            subscription.subscriptionDiagnostics.maxLifetimeCount.should.eql(subscription.lifeTimeCount);
        });
        it("should update Subscription.subscriptionDiagnostics.maxKeepAliveCount",function() {
            subscription.maxKeepAliveCount.should.eql(5);
            subscription.subscriptionDiagnostics.maxKeepAliveCount.should.eql(subscription.maxKeepAliveCount);
        });
        it("should update Subscription.subscriptionDiagnostics.maxNotificationsPerPublish",function() {
            subscription.maxNotificationsPerPublish.should.eql(123);
            subscription.subscriptionDiagnostics.maxNotificationsPerPublish.should.eql(subscription.maxNotificationsPerPublish);
        });

        it("should update Subscription.subscriptionDiagnostics.publishingEnabled",function() {
            subscription.publishingEnabled.should.eql(true);
            subscription.subscriptionDiagnostics.publishingEnabled.should.eql(subscription.publishingEnabled);
        });

        it("should update Subscription.subscriptionDiagnostics.nextSequenceNumber",function() {
            subscription._get_future_sequence_number().should.eql(1);
            subscription.subscriptionDiagnostics.nextSequenceNumber.should.eql(subscription._get_future_sequence_number());
        });

        it("should update Subscription.subscriptionDiagnostics.disabledMonitoredItemCount",function() {

            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(0);
            subscription.monitoredItemCount.should.eql(0);

            var m1  = add_monitored_item();
            var m2  = add_monitored_item();
            var m3  = add_monitored_item();

            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(3);
            subscription.subscriptionDiagnostics.disabledMonitoredItemCount.should.eql(0);

            m1.setMonitoringMode(MonitoringMode.Disabled);
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(3);
            subscription.subscriptionDiagnostics.disabledMonitoredItemCount.should.eql(1);

            m2.setMonitoringMode(MonitoringMode.Disabled);
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(3);
            subscription.subscriptionDiagnostics.disabledMonitoredItemCount.should.eql(2);

        });
        it("should update Subscription.subscriptionDiagnostics.monitoredItemCount",function() {



            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(0);
            subscription.monitoredItemCount.should.eql(0);

            add_monitored_item();
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(1);
            subscription.monitoredItemCount.should.eql(1);

            add_monitored_item();
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(2);
            subscription.monitoredItemCount.should.eql(2);


        });

    })
});



