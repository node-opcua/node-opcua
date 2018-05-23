/*global require,describe,it,before,beforeEach,after,afterEach*/
"use strict";


const should = require("should");
const sinon = require("sinon");

const subscription_service = require("node-opcua-service-subscription");
const StatusCodes = require("node-opcua-status-code").StatusCodes;

const Subscription = require("../src/server_subscription").Subscription;

const TimestampsToReturn = require("node-opcua-service-read").TimestampsToReturn;

const MonitoredItemCreateRequest = subscription_service.MonitoredItemCreateRequest;

const DataType = require("node-opcua-variant").DataType;
const DataValue = require("node-opcua-data-value").DataValue;
const Variant = require("node-opcua-variant").Variant;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;

const AttributeIds = require("node-opcua-data-model").AttributeIds;

const NodeId = require("node-opcua-nodeid").NodeId;

const MonitoredItem = require("../src/monitored_item").MonitoredItem;

const SessionContext = require("node-opcua-address-space").SessionContext;
const context = SessionContext.defaultContext;

const now = (new Date()).getTime();

const fake_publish_engine = {
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
    on_close_subscription: function (/*subscription*/) {

    },
    cancelPendingPublishRequestBeforeChannelChange: function() {

    }

};

let dataSourceFrozen = false;

function freeze_data_source() {
    dataSourceFrozen = true;
}

function unfreeze_data_source() {
    dataSourceFrozen = false;
}

function install_spying_samplingFunc() {
    unfreeze_data_source();
    let sample_value = 0;
    const spy_samplingEventCall = sinon.spy(function (oldValue, callback) {
        if (!dataSourceFrozen) {
            sample_value++;
        }
        //xx console.log(" OOOOO ----- OOOOOOO");
        const dataValue = new DataValue({value: {dataType: DataType.UInt32, value: sample_value}});
        callback(null, dataValue);
    });
    return spy_samplingEventCall;
}

const server_engine = require("../src/server_engine");
describe("Subscriptions and MonitoredItems", function () {

    this.timeout(Math.max(300000, this._timeout));

    let addressSpace;

    let engine;
    const test = this;

    before(function (done) {
        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.nodeset_filename}, function () {
            addressSpace = engine.addressSpace;



            function addVar(typeName, value) {
                addressSpace.addVariable({
                    organizedBy: "RootFolder",
                    nodeId: "ns=100;s=Static_" + typeName,
                    browseName: "Static_" + typeName,
                    dataType: typeName,
                    value: {dataType: DataType[typeName], value: value}
                });

            }

            addVar("LocalizedText", {text: "Hello"});
            addVar("ByteString", Buffer.from("AZERTY"));
//             addVar("SByte", 0);
//             addVar("Int16", 0);
//             addVar("Int32", 0);
//             addVar("Int64", 0);
//             addVar("Byte", 0);
//             addVar("UInt16", 0);
//             addVar("UInt32", 0);
//             addVar("UInt64", 0);
// //xx            addVar("Duration"     , 0);
//             addVar("Float", 0);
//             addVar("Double", 0);
            addVar("Boolean", false);
            addVar("String", "Hello");

            done();
        });
    });
    after(function () {
        if (engine) {
            engine.shutdown();
            engine.dispose();
            engine = null;
        }
    });

    beforeEach(function () {
        this.clock = sinon.useFakeTimers(now);
    });
    afterEach(function () {
        this.clock.restore();
    });

    it("should return Good if DeadBandFilter is NOT specified on boolean value monitored item", function () {


        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_nodeId(nodeId, statusCode) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
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
                        deadbandType: subscription_service.DeadbandType.None,
                    })
                }
            });
            const monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_Boolean").should.eql(StatusCodes.Good);

        subscription.terminate();
        subscription.dispose();

    });
    it("should return Good if DeadBandFilter is NOT specified on String value monitored item", function () {


        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_nodeId(nodeId, statusCode) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
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
                        deadbandType: subscription_service.DeadbandType.None,
                    })
                }
            });
            const monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_String").should.eql(StatusCodes.Good);

        subscription.terminate();
        subscription.dispose();

    });
    it("should return Good if DeadBandFilter is NOT specified on ByteString value monitored item", function () {


        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_nodeId(nodeId, statusCode) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
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
                        deadbandType: subscription_service.DeadbandType.None,
                    })
                }
            });
            const monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_ByteString").should.eql(StatusCodes.Good);

        subscription.terminate();
        subscription.dispose();

    });

    it("should return Good if DeadBandFilter is NOT specified on LocalizedText value monitored item", function () {


        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_nodeId(nodeId, statusCode) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
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
                        deadbandType: subscription_service.DeadbandType.None,
                    })
                }
            });
            const monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_LocalizedText").should.eql(StatusCodes.Good);

        subscription.terminate();
        subscription.dispose();

    });

    it("should return BadFilterNotAllowed if DeadBandFilter is specified on boolean value monitored item", function () {


        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_nodeId(nodeId, statusCode) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
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
            const monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_Boolean").should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();
        subscription.dispose();

    });
    it("should return BadFilterNotAllowed if DeadBandFilter is specified on String value monitored item", function () {


        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_nodeId(nodeId, statusCode) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
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
            const monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_String").should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();
        subscription.dispose();

    });
    it("should return BadFilterNotAllowed if DeadBandFilter is specified on ByteString value monitored item", function () {


        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_nodeId(nodeId, statusCode) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
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
            const monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_ByteString").should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();
        subscription.dispose();

    });

    it("should return BadFilterNotAllowed if DeadBandFilter is specified on LocalizedText value monitored item", function () {


        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        function test_with_nodeId(nodeId, statusCode) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
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
            const monitoredItemCreateResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
            return monitoredItemCreateResult.statusCode;
        }


        test_with_nodeId("ns=100;s=Static_LocalizedText").should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();
        subscription.dispose();

    });
});

