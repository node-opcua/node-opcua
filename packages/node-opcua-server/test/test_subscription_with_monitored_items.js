/*global require,describe,it,before,beforeEach,after,afterEach*/
"use strict";


var should = require("should");
var sinon = require("sinon");

var subscription_service = require("node-opcua-service-subscription");
var StatusCodes = require("node-opcua-status-code").StatusCodes;

var Subscription = require("../src/subscription").Subscription;
var SubscriptionState = require("../src/subscription").SubscriptionState;
var ServerSidePublishEngine = require("../src/server_publish_engine").ServerSidePublishEngine;

var TimestampsToReturn = require("node-opcua-service-read").TimestampsToReturn;

var MonitoredItemCreateRequest = subscription_service.MonitoredItemCreateRequest;
var makeBrowsePath = require("node-opcua-service-translate-browse-path").makeBrowsePath;

var DataType = require("node-opcua-variant").DataType;
var DataValue =  require("node-opcua-data-value").DataValue;
var Variant = require("node-opcua-variant").Variant;
var VariantArrayType = require("node-opcua-variant").VariantArrayType;

var AttributeIds = require("node-opcua-data-model").AttributeIds;

var NodeId = require("node-opcua-nodeid").NodeId;
var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;


var encode_decode = require("node-opcua-basic-types");

var SessionContext = require("node-opcua-address-space").SessionContext;
var context = SessionContext.defaultContext;


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
    },
    on_close_subscription: function(/*subscription*/) {

    }
};

var dataSourceFrozen = false;
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
        //xx console.log(" OOOOO ----- OOOOOOO");
        var dataValue = new DataValue({value: {dataType: DataType.UInt32, value: sample_value}});
        callback(null, dataValue);
    });
    return spy_samplingEventCall;
}

var server_engine = require("../src/server_engine");

var add_eventGeneratorObject = require("node-opcua-address-space/test_helpers/add_event_generator_object").add_eventGeneratorObject;


function simulate_client_adding_publish_request(publishEngine,callback) {
    callback = callback || function(){};
    var publishRequest = new subscription_service.PublishRequest({});
    publishEngine._on_PublishRequest(publishRequest, callback);
}

var describeWithLeakDetector = require("node-opcua-leak-detector").describeWithLeakDetector;
describeWithLeakDetector("Subscriptions and MonitoredItems", function () {

    this.timeout(Math.max(300000,this._timeout));

    var addressSpace;
    var someVariableNode;
    var analogItemNode;
    var accessLevel_CurrentRead_NotUserNode;

    var engine;
    var test = this;

    before(function (done) {
        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.nodeset_filename}, function () {
            addressSpace = engine.addressSpace;

            // build_address_space_for_conformance_testing(engine, {mass_variables: false});

            var node = addressSpace.addVariable({
                organizedBy:"RootFolder",
                browseName: "SomeVariable",
                dataType: "UInt32",
                value: {dataType: DataType.UInt32, value: 0}
            });

            someVariableNode = node.nodeId;


            function addVar(typeName, value) {
                addressSpace.addVariable({
                    organizedBy:"RootFolder",
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


            var name = "AccessLevel_CurrentRead_NotUser";
            var makeNodeId = require("node-opcua-nodeid").makeNodeId;
            var namespaceIndex = 100;

            accessLevel_CurrentRead_NotUserNode = addressSpace.addVariable({
                organizedBy:"RootFolder",
                browseName: name,
                description: {locale: "en", text: name},
                nodeId: makeNodeId(name, namespaceIndex),
                dataType: "Int32",
                valueRank: -1,

                accessLevel: "CurrentRead",

                userAccessLevel: "",

                value: new Variant({
                    dataType: DataType.Int32,
                    arrayType: VariantArrayType.Scalar,
                    value: 36
                })
            });

            var standardUnits = require("node-opcua-data-access").standardUnits;

            function addAnalogItem(dataType) {

                var name ="AnalogItem"+dataType;
                var nodeId = makeNodeId(name, namespaceIndex);

                addressSpace.addAnalogDataItem({

                    organizedBy: "RootFolder",
                    nodeId: nodeId,
                    browseName: name,
                    definition: "(tempA -25) + tempB",
                    valuePrecision: 0.5,
                    engineeringUnitsRange: {low: 1, high: 50},
                    instrumentRange: {low: 1, high: 50},
                    engineeringUnits: standardUnits.degree_celsius,
                    dataType: dataType,
                    value: new Variant({
                        arrayType: VariantArrayType.Scalar,
                        dataType: DataType[dataType],
                        value: 0.0
                    })
                });
                return nodeId;

            }
            analogItemNode = addAnalogItem("Double");
            done();
        });
    });
    after(function () {
        engine.shutdown();
        engine = null;
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

        var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
        monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

        subscription.monitoredItemCount.should.eql(1);

        monitoredItemCreateResult.should.be.instanceOf(subscription_service.MonitoredItemCreateResult);

        monitoredItemCreateResult.revisedSamplingInterval.should.eql(100);

        subscription.on("terminated", function () {
            // monitored Item shall be deleted at this stage
            subscription.monitoredItemCount.should.eql(0);
            done();
        });
        subscription.terminate();

    });

    it("a subscription should fire the event removeMonitoredItem", function (done) {

        var subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        subscription.on("removeMonitoredItem", done.bind(null, null));

        var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {nodeId: someVariableNode},
            monitoringMode: subscription_service.MonitoringMode.Reporting,

            requestedParameters: {
                queueSize: 10,
                samplingInterval: 100
            }
        });

        subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
        subscription.terminate();

    });

    it("a subscription should collect monitored item notification with _collectNotificationData", function (done) {

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

        var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
        monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);
        monitoredItemCreateResult.revisedSamplingInterval.should.eql(100);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

        // data collection is done asynchronously => let give some time for this to happen
        this.clock.tick(5);

        // at first, _collectNotificationData  should has 1 notification with current dataItem value
        var notifications = subscription._collectNotificationData();
        should(notifications.length).equal(1);

        // now simulate some data change
        this.clock.tick(500);

        monitoredItem.queue.length.should.eql(5);

        // then, _collectNotificationData  should collect at least 2 values
        notifications = subscription._collectNotificationData();
        notifications.length.should.eql(1);

        notifications = notifications[0];
        notifications.length.should.eql(1);

        notifications[0].monitoredItems.length.should.eql(5);
        notifications[0].monitoredItems[0].clientHandle.should.eql(monitoredItem.clientHandle);

        subscription.on("terminated", function () {
            done();
        });
        subscription.terminate();

    });

    it("a subscription should collect monitored item notification at publishing interval", function (done) {

        unfreeze_data_source();

        var publishEngine = new ServerSidePublishEngine();



        var subscription = new Subscription({
            publishingInterval: 500,
            maxKeepAliveCount: 20,
            publishEngine: publishEngine,
            publishingEnabled: true,
            id: 1000
        });
        publishEngine.add_subscription(subscription);

        simulate_client_adding_publish_request(subscription.publishEngine);

        this.clock.tick(subscription.publishingInterval);
        subscription.state.should.eql(SubscriptionState.KEEPALIVE);

        // Monitored item will report a new value every tick => 100 ms
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });


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

        // add enough PublishRequest
        simulate_client_adding_publish_request(subscription.publishEngine);
        simulate_client_adding_publish_request(subscription.publishEngine);
        simulate_client_adding_publish_request(subscription.publishEngine);
        simulate_client_adding_publish_request(subscription.publishEngine);

        var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);

        monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);
        monitoredItem.samplingInterval.should.eql(100);

        // data collection is done asynchronously => let give some time for this to happen
        this.clock.tick(5);

        // initial value shall already be in the queue
        monitoredItem.queue.length.should.eql(1);

        this.clock.tick(29);
        // now simulate some data change
        this.clock.tick(100);
        monitoredItem.queue.length.should.eql(2);

        this.clock.tick(100);
        monitoredItem.queue.length.should.eql(3);

        this.clock.tick(100);
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

        var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
        monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

        var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

        var result = subscription.getMonitoredItems({});
        result.statusCode.should.eql(StatusCodes.Good);
        result.serverHandles.map(parseInt).should.eql([monitoredItem.monitoredItemId]);
        result.clientHandles.map(parseInt).should.eql([monitoredItem.clientHandle]);

        subscription.terminate();
        done();
    });


    function on_subscription(actionFunc,done) {

        // see Err-03.js
        var subscription = new Subscription({
            id: 42,
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        try {
            actionFunc(subscription);
        }
        catch(err) {
            return done(err);
        }
        finally {
            subscription.terminate();
        }
        done();
    }
    it("should return BadFilterNotAllowed if filter is DataChangeFilter PercentDeadBand and variable has no EURange",function(done){

        var not_a_analogItemNode = someVariableNode;
        on_subscription(function(subscription){
            var monitoredItemCreateRequest1 = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: not_a_analogItemNode,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new subscription_service.DataChangeFilter({
                        trigger: subscription_service.DataChangeTrigger.Status,
                        deadbandType: subscription_service.DeadbandType.Percent,
                        deadbandValue: 10.0 /* 10% */
                    })
                }
            });

            var monitoredItemCreateResult1 = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest1);
            monitoredItemCreateResult1.statusCode.should.eql(StatusCodes.BadFilterNotAllowed);
        },done);
    });

    it("should return an error when filter is DataChangeFilter deadband is out of bound", function (done) {

        function _create_MonitoredItemCreateRequest_with_deadbandValue(value) {
            return new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: analogItemNode,
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
        on_subscription(function(subscription) {

            var monitoredItemCreateRequest1 = _create_MonitoredItemCreateRequest_with_deadbandValue(-10);
            var monitoredItemCreateResult1 = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest1);
            monitoredItemCreateResult1.statusCode.should.eql(StatusCodes.BadDeadbandFilterInvalid);

            var monitoredItemCreateRequest2 = _create_MonitoredItemCreateRequest_with_deadbandValue(110);
            var monitoredItemCreateResult2 = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest2);
            monitoredItemCreateResult2.statusCode.should.eql(StatusCodes.BadDeadbandFilterInvalid);

            var monitoredItemCreateRequest3 = _create_MonitoredItemCreateRequest_with_deadbandValue(90);
            var monitoredItemCreateResult3 = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest3);
            monitoredItemCreateResult3.statusCode.should.eql(StatusCodes.Good);

        },done);

    });

    it("should return BadFilterNotAllowed if a DataChangeFilter is specified on a non-Value Attribute monitored item", function (done) {

        on_subscription(function(subscription) {

            function test_with_attributeId(attributeId, statusCode) {
                var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                    itemToMonitor: {
                        nodeId: analogItemNode,
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
                var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
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

        },done);

    });

    xit("With 3 subscriptions with monitored items", function () {

        test.clock = sinon.useFakeTimers(now);

        var publishEngine = new ServerSidePublishEngine({});

        var _clientHandle=1;

        function my_samplingFunc(oldData,callback) {
            var self = this;
            //xx console.log(self.toString());
            var dataValue = addressSpace.findNode(self.node.nodeId).readAttribute(13);
            callback(null,dataValue);
        }
        function add_monitoredItem(subscription) {

            var nodeId = 'ns=100;s=Static_Float';
            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    clientHandle: _clientHandle++,
                    queueSize: 10,
                    samplingInterval: 200
                }
            });

            var n  = addressSpace.findNode('ns=100;s=Static_Float');
            //xx console.log(n.toString());

            subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            // data collection is done asynchronously => let give some time for this to happen
            test.clock.tick(1);
        }

        function perform_publish_transaction_and_check_subscriptionId(subscription) {

            var pubFunc= sinon.spy();

            simulate_client_adding_publish_request(publishEngine,pubFunc);

            test.clock.tick(subscription.publishingInterval);

            pubFunc.callCount.should.eql(1);

            //xx console.log(pubFunc.getCall(0).args[1].toString());

            pubFunc.getCall(0).args[1].subscriptionId.should.eql(subscription.id);

        }

        // maintree\Monitored Item Services\Monitor Items 100\Test Cases\002.js - createMonitoredItems100x3subscriptions
        //
        // Subscription1
        //
        //    liveTimeCount 10
        //    maxKeepAlive   3
        //
        //                    KA             KA
        //    250  500  750  1000 1250 1500 1750 2000 2250 2500 2750 3000 3250 3500 3750 4000 4250 4500 4750 5000
        // +---o----o----o----o----o----o----o----o----o----o----o----o----o----o----o----o----o----o----o----o
        //
        // Subscription2
        //    250                 1250                2250 2500 2750 3000 3250 3500 3750 4000 4250 4500 4750 5000
        // +---o-------------------o-------------------o-------------------o-------------------o--------------o
        //
        // we use a subscription with a small publishingInterval interval here
        var subscription1 = new Subscription({
            publishingInterval: 250,
            maxKeepAliveCount:   10,
            id: 10000,
            publishEngine: publishEngine
        });
        publishEngine.add_subscription(subscription1);
        subscription1.state.should.eql(SubscriptionState.CREATING);

        test.clock.tick(subscription1.publishingInterval);
        subscription1.state.should.eql(SubscriptionState.LATE);

        subscription1.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = my_samplingFunc;
        });

        add_monitoredItem(subscription1);

        perform_publish_transaction_and_check_subscriptionId(subscription1);
        subscription1.state.should.eql(SubscriptionState.NORMAL);

        //---------------------------------------------------- Subscription 2 - 1000 ms
        var subscription2 = new Subscription({
            id: 20000,
            publishingInterval: 1000,
            maxKeepAliveCount:    20,
            publishEngine: publishEngine
        });
        publishEngine.add_subscription(subscription2);

        subscription2.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = my_samplingFunc;
        });

        add_monitoredItem(subscription2);

        perform_publish_transaction_and_check_subscriptionId(subscription2);
        subscription1.state.should.eql(SubscriptionState.NORMAL);

        //---------------------------------------------------- Subscription 3 - 5000 ms
        var subscription3 = new Subscription({
            id: 30000,
            publishingInterval: 5000,
            maxKeepAliveCount: 20,
            publishEngine: publishEngine
        });
        publishEngine.add_subscription(subscription3);

        subscription3.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = my_samplingFunc;
        });

        add_monitoredItem(subscription3);

        //xx console.log(pubFunc.getCall(0).args[0].toString());
        //xx console.log(pubFunc.getCall(0).args[1].toString());
        perform_publish_transaction_and_check_subscriptionId(subscription3);

        subscription1.terminate();
        subscription2.terminate();
        subscription3.terminate();

        publishEngine.shutdown();
        test.clock.restore();

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
            var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_ByteString").should.eql(StatusCodes.BadFilterNotAllowed);
        test_with_nodeId("ns=100;s=Static_LocalizedText").should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();

    });

    describe("Access",function() {


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

                monitoredItem.samplingFunc = sinon.spy(function (oldValue, callback) {
                    assert(monitoredItem.node);
                    var dataValue = monitoredItem.node.readAttribute(monitoredItem.attributeId);
                    console.log(" dataValue ",dataValue.toString());
                    callback(null, dataValue);
                });

                monitoredItem.node.should.eql(addressSpace.findNode(monitoredItem.itemToMonitor.nodeId));
            });

        });
        after(function (done) {
            subscription.terminate();
            subscription = null;
            done();
        });

        it("pp CreateMonitoredItems on an item to which the user does not have read-access; should succeed but Publish should return the error ", function () {

            // specs:
            // When a user adds a monitored item that the user is denied read access to, the add operation for
            // the item shall succeed and the bad status Bad_NotReadable or Bad_UserAccessDenied shall be
            // returned in the Publish response. This is the same behaviour for the case where the access rig hts
            // are changed after the call to CreateMonitoredItems. If the access rights change to read rights, the
            // Server shall start sending data for the MonitoredItem. The same procedure shall be applied for an
            // IndexRange that does not deliver data for the current value but could deliver data in the future.

            console.log("    ", accessLevel_CurrentRead_NotUserNode.toString());
            console.log("   accessLevel_CurrentRead_NotUserNode.isUserReadable(context)  ", accessLevel_CurrentRead_NotUserNode.isUserReadable(context));
            accessLevel_CurrentRead_NotUserNode.isReadable(context).should.eql(true);
            accessLevel_CurrentRead_NotUserNode.isUserReadable(context).should.eql(false);

            var nodeId = accessLevel_CurrentRead_NotUserNode.nodeId;
            nodeId.should.be.instanceOf(NodeId);

            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: subscription_service.MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 0
                }
            });


            var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);

            monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

            var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

            monitoredItem.queueSize.should.eql(10);
            //xx monitoredItem.queue.length.should.eql(1);

            function simulate_publish_request_expected_statusCode(expectedStatusCode) {

                test.clock.tick(100);

                // process publish
                var notifs = monitoredItem.extractMonitoredItemNotifications();

                monitoredItem.queue.length.should.eql(0);

                if (expectedStatusCode === undefined) {

                    notifs.length.should.eql(0, "should have no pending notification");

                } else {

                    notifs.length.should.eql(1," should have one pending notification");
                    notifs[0].value.statusCode.should.eql(expectedStatusCode);

                    //xx console.log(notifs[0].value.toString());
                }
            }

            simulate_publish_request_expected_statusCode(StatusCodes.BadUserAccessDenied);

        });

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

                monitoredItem.node.nodeId.should.eql(monitoredItem.itemToMonitor.nodeId);
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
            var node = engine.addressSpace.findNode(nodeId);
            should(!!node).not.eql(false);
            node.minimumSamplingInterval.should.be.belowOrEqual(100);

            function simulate_nodevalue_change(currentValue) {

                var v = new Variant({dataType: DataType[dataType], arrayType: VariantArrayType.Scalar, value: currentValue});

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
                addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);

            // data collection is done asynchronously => let give some time for this to happen
            test.clock.tick(5);

            monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);
            var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

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

                    expectedValue = encode_decode["coerce"+ dataType](expectedValue);


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


        it("ZZ0 testing with String and DeadBandFilter",function(done) {

            var nodeId = "ns=100;s=Static_LocalizedText";

            var filter =  new subscription_service.DataChangeFilter({
                trigger: subscription_service.DataChangeTrigger.StatusValue,
                deadbandType: subscription_service.DeadbandType.Absolute,
                deadbandValue: 10.0
            });

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
                    filter: null
                }
            });


            var monitoredItemCreateResult = subscription.createMonitoredItem(
                addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);


            // data collection is done asynchronously => let give some time for this to happen
            test.clock.tick(5);

            monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);
            var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);

            // now modify monitoredItem setting a filter
            var res = monitoredItem.modify(null,new subscription_service.MonitoringParameters({
                samplingInterval: 0,
                discardOldest: true,
                queueSize: 1,
                filter: filter
            }));

            /* MonitoredItemModifyResult*/
            res.statusCode.should.eql(StatusCodes.BadFilterNotAllowed);


            done();
        });
    });


    describe("MonitoredItem should set SemanticChanged bit on statusCode when appropriate",function() {


        function changeEURange(analogItem, done) {
            var dataValueOrg = analogItem.readAttribute(AttributeIds.Value);

            var dataValue = {
                value: {
                    dataType: DataType.ExtensionObject,
                    value: new Range({
                        low: dataValueOrg.value.value.low + 1,
                        high: dataValueOrg.value.value.high + 1
                    })
                }
            };

            var writeValue = new WriteValue({
                attributeId: AttributeIds.Value,
                value: dataValue
            });
            analogItem.euRange.writeAttribute(writeValue, done);

        }
    });

});




describe("monitoredItem advanced", function () {

    var addressSpace;
    var someVariableNode;
    var engine;
    var publishEngine;
    before(function (done) {
        engine = new server_engine.ServerEngine();

        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {

            addressSpace = engine.addressSpace;

            var node = addressSpace.addVariable({
                organizedBy:"RootFolder",
                browseName: "SomeVariable",
                dataType: "UInt32",
                value: {dataType: DataType.UInt32, value: 0}
            });
            someVariableNode = node.nodeId;

            add_eventGeneratorObject(engine.addressSpace,"ObjectsFolder");

            var browsePath = makeBrowsePath("RootFolder","/Objects/EventGeneratorObject");

            var opts = {addressSpace: engine.addressSpace};
            //xx console.log("eventGeneratingObject",browsePath.toString(opts));
            //xx console.log("eventGeneratingObject",eventGeneratingObject.toString(opts));

            done();
        });
    });
    after(function () {
        engine.shutdown();
        engine = null;
    });



    beforeEach(function () {
        this.clock = sinon.useFakeTimers(now);
        publishEngine = new ServerSidePublishEngine();
    });

    afterEach(function () {
        //xx publishEngine._feed_closed_subscription();
        this.clock.tick(1000);
        this.clock.restore();
        if (publishEngine) {
            publishEngine.shutdown();
            publishEngine = null;
        }
    });

    describe("#maxNotificationsPerPublish", function () {
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

            var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            monitoredItemCreateResult.statusCode.should.eql(StatusCodes.Good);

            var monitoredItem = subscription.getMonitoredItem(monitoredItemCreateResult.monitoredItemId);
            should.exist(monitoredItem);
            return monitoredItem;
        }

        it("QA should not publish more notifications than expected", function (done) {

            var spy_callback = sinon.spy();

            var subscription = new Subscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                publishEngine: publishEngine,
                maxNotificationsPerPublish: 4,  // <<<< WE WANT NO MORE THAN 4 Notification per publish
                id: 2
            });
            subscription.maxNotificationsPerPublish.should.eql(4);

            publishEngine.add_subscription(subscription);

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = install_spying_samplingFunc();
            });

            this.clock.tick(subscription.publishingInterval);
            simulate_client_adding_publish_request(publishEngine,spy_callback);
            simulate_client_adding_publish_request(publishEngine,spy_callback);
            simulate_client_adding_publish_request(publishEngine,spy_callback);
            simulate_client_adding_publish_request(publishEngine,spy_callback);

            subscription.state.should.eql(SubscriptionState.KEEPALIVE);

            //xx // let spy the notifications event handler
            //xx var spy_notification_event = sinon.spy();
            //xx subscription.on("notification", spy_notification_event);


            var monitoredItem1 = createMonitoredItem(subscription, 123);
            var monitoredItem2 = createMonitoredItem(subscription, 124);
            var monitoredItem3 = createMonitoredItem(subscription, 125);
            var monitoredItem4 = createMonitoredItem(subscription, 126);


            // simulate client sending publish request
            simulate_client_adding_publish_request(publishEngine,spy_callback);
            simulate_client_adding_publish_request(publishEngine,spy_callback);
            simulate_client_adding_publish_request(publishEngine,spy_callback);
            simulate_client_adding_publish_request(publishEngine,spy_callback);
            simulate_client_adding_publish_request(publishEngine,spy_callback);

            // now simulate some data change on monitored items
            this.clock.tick(100);
            this.clock.tick(100);
            this.clock.tick(100);
            this.clock.tick(100);
            this.clock.tick(100);

            freeze_data_source();

            monitoredItem1.queue.length.should.eql(5);
            monitoredItem2.queue.length.should.eql(5);
            monitoredItem3.queue.length.should.eql(5);
            monitoredItem4.queue.length.should.eql(5);

            this.clock.tick(800);

            // now data should have been harvested
            // monitoredItem values should have been harvested by subscription timer by now
            monitoredItem1.queue.length.should.eql(0);
            monitoredItem2.queue.length.should.eql(0);
            monitoredItem3.queue.length.should.eql(0);
            monitoredItem4.queue.length.should.eql(0);


            // verify that publishResponse has been send
            var publishResponse0 = spy_callback.getCall(0).args[1];
            numberOfnotifications(publishResponse0).should.eql(0); // KeepAlive


            var publishResponse1 = spy_callback.getCall(1).args[1];
            numberOfnotifications(publishResponse1).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
            publishResponse1.moreNotifications.should.eql(true);


            spy_callback.callCount.should.eql(6);

            var publishResponse2 = spy_callback.getCall(2).args[1];
            numberOfnotifications(publishResponse2).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
            publishResponse2.moreNotifications.should.eql(true);

            var publishResponse3 = spy_callback.getCall(4).args[1];
            numberOfnotifications(publishResponse3).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
            publishResponse3.moreNotifications.should.eql(true);

            var publishResponse4 = spy_callback.getCall(5).args[1];
            numberOfnotifications(publishResponse4).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
            publishResponse4.moreNotifications.should.eql(false);


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

    describe("Subscription.subscriptionDiagnostics",function() {


        var subscription;
        beforeEach(function(){
            fake_publish_engine.pendingPublishRequestCount = 1000;

            subscription = new Subscription({
                priority: 10,
                publishingInterval: 100,
                maxNotificationsPerPublish: 123,
                maxKeepAliveCount:     21,
                lifeTimeCount:         67,
                publishingEnabled: true,              //  PUBLISHING IS ENABLED !!!
                publishEngine: fake_publish_engine,
                sessionId: coerceNodeId("i=5;s=tmp")
            });

            subscription.sessionId = 100;

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = install_spying_samplingFunc();
            });

        });
        function add_monitored_item() {

            var nodeId = "i=2258"; // CurrentTime
            var monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {nodeId: nodeId },
                monitoringMode: subscription_service.MonitoringMode.Reporting,

                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 1200
                }
            });
            var monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
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
            subscription.subscriptionDiagnostics.sessionId.should.eql(subscription.getSessionId());
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
            subscription.lifeTimeCount.should.be.above(subscription.maxKeepAliveCount*3-1);
            subscription.subscriptionDiagnostics.maxLifetimeCount.should.eql(subscription.lifeTimeCount);
        });

        it("should update Subscription.subscriptionDiagnostics.maxKeepAliveCount",function() {
            subscription.maxKeepAliveCount.should.eql(21);
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

        it("should update Subscription.subscriptionDiagnostics.dataChangeNotificationsCount",function() {

            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(0);
            subscription.subscriptionDiagnostics.dataChangeNotificationsCount.should.eql(0);

            var evtNotificationCounter = 0;
            subscription.on("notificationMessage",function(/*notificationMessage*/) {
                evtNotificationCounter+=1;
            });

            subscription.publishingInterval.should.eql(100);

            var m = add_monitored_item();
            m.samplingInterval.should.eql(1200,"monitored item sampling interval should be 1 seconds");
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(1);


            // simulate notification
            // now simulate some data change in 5 seconds 
            this.clock.tick(1200*5);

            evtNotificationCounter.should.eql(5);
            
            subscription.subscriptionDiagnostics.notificationsCount.should.eql(evtNotificationCounter);
            subscription.subscriptionDiagnostics.dataChangeNotificationsCount.should.eql(evtNotificationCounter);
            
        });
        

        xit("should update Subscription.subscriptionDiagnostics.eventNotificationsCount",function() {
            // todo
        });
    });


});



