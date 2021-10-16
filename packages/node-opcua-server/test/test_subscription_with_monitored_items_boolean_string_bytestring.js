"use strict";

const should = require("should");
const sinon = require("sinon");

const {
    MonitoringMode,
    MonitoredItemCreateRequest,
    DataChangeFilter,
    DataChangeTrigger,
    DeadbandType
} = require("node-opcua-service-subscription");
const { StatusCodes } = require("node-opcua-status-code");
const { TimestampsToReturn } = require("node-opcua-service-read");

const { DataType, VariantArrayType, Variant } = require("node-opcua-variant");
const { DataValue } = require("node-opcua-data-value");
const { AttributeIds } = require("node-opcua-data-model");
const { NodeId, coerceNodeId } = require("node-opcua-nodeid");
const { SessionContext } = require("node-opcua-address-space");

const { get_mini_nodeset_filename } = require("node-opcua-address-space/testHelpers");

const { MonitoredItem, Subscription, ServerEngine } = require("..");

const mini_nodeset_filename = get_mini_nodeset_filename();

const context = SessionContext.defaultContext;

const now = new Date().getTime();
const { getFakePublishEngine } = require("./helper_fake_publish_engine");

const fake_publish_engine = getFakePublishEngine();

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
        const dataValue = new DataValue({ value: { dataType: DataType.UInt32, value: sample_value } });
        callback(null, dataValue);
    });
    return spy_samplingEventCall;
}

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Subscriptions and MonitoredItems", function () {
    this.timeout(Math.max(300000, this._timeout));

    let addressSpace, namespace;

    let engine;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;

    before(function (done) {
        engine = new ServerEngine();

        engine.initialize({ nodeset_filename: mini_nodeset_filename }, function () {
            addressSpace = engine.addressSpace;
            namespace = addressSpace.getOwnNamespace();

            function addVar(typeName, value) {
                namespace.addVariable({
                    organizedBy: "RootFolder",
                    nodeId: "s=Static_" + typeName,
                    browseName: "Static_" + typeName,
                    dataType: typeName,
                    value: { dataType: DataType[typeName], value: value }
                });
            }

            addVar("LocalizedText", { text: "Hello" });
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
    after(async () => {
        if (engine) {
            await engine.shutdown();
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

        function test_with_nodeId(nodeId) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.None
                    })
                }
            });
            const createResult = subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        const namespaceSimulationIndex = 1;
        const nodeIdBoolean = coerceNodeId("s=Static_Boolean", namespaceSimulationIndex);
        test_with_nodeId(nodeIdBoolean).should.eql(StatusCodes.Good);

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
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.None
                    })
                }
            });
            const createResult = subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        test_with_nodeId("ns=1;s=Static_String").should.eql(StatusCodes.Good);

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
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.None
                    })
                }
            });
            const createResult = subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        test_with_nodeId("ns=1;s=Static_ByteString").should.eql(StatusCodes.Good);

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
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.None
                    })
                }
            });
            const createResult = subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        test_with_nodeId("ns=1;s=Static_LocalizedText").should.eql(StatusCodes.Good);

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
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.Percent,
                        deadbandValue: 10
                    })
                }
            });
            const createResult = subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        test_with_nodeId("ns=1;s=Static_Boolean").should.eql(StatusCodes.BadFilterNotAllowed);

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
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.Percent,
                        deadbandValue: 10
                    })
                }
            });
            const createResult = subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        test_with_nodeId("ns=1;s=Static_String").should.eql(StatusCodes.BadFilterNotAllowed);

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
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.Percent,
                        deadbandValue: 10
                    })
                }
            });
            const createResult = subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        test_with_nodeId("ns=1;s=Static_ByteString").should.eql(StatusCodes.BadFilterNotAllowed);

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
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.Percent,
                        deadbandValue: 10
                    })
                }
            });
            const createResult = subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        test_with_nodeId("ns=1;s=Static_LocalizedText").should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();
        subscription.dispose();
    });
});
