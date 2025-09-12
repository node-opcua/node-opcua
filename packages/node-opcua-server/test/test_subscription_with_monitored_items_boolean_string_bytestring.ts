import "should";
import sinon, { SinonStatic } from "sinon";

import {
    MonitoringMode,
    MonitoredItemCreateRequest,
    DataChangeFilter,
    DataChangeTrigger,
    DeadbandType
} from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { TimestampsToReturn } from "node-opcua-service-read";

import { DataType, VariantArrayType, Variant } from "node-opcua-variant";
import { DataValue } from "node-opcua-data-value";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId, coerceNodeId, NodeIdLike } from "node-opcua-nodeid";
import { IAddressSpace, INamespace, SessionContext } from "node-opcua-address-space";

import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { MonitoredItem, Subscription, ServerEngine } from "../source";

const mini_nodeset_filename = get_mini_nodeset_filename();

const context = SessionContext.defaultContext;

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
    const spy_samplingEventCall = sinon.spy(function (sessionContext, oldValue, callback) {
        if (!dataSourceFrozen) {
            sample_value++;
        }
        const dataValue = new DataValue({ value: { dataType: DataType.UInt32, value: sample_value } });
        callback(null, dataValue);
    });
    return spy_samplingEventCall;
}

function makeSubscription(options: any) {
    const subscription1 = new Subscription(options);
    (subscription1 as any).$session = {
        sessionContext: SessionContext.defaultContext
    };
    return subscription1;
}

describe("Subscriptions and MonitoredItems", function (this: any) {
    this.timeout(Math.max(300000, this._timeout));

    let addressSpace: IAddressSpace;
    let namespace: INamespace;

    let engine: ServerEngine;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;

    before(function (done) {
        engine = new ServerEngine();

        engine.initialize({ nodeset_filename: mini_nodeset_filename }, function () {
            addressSpace = engine.addressSpace!;
            namespace = addressSpace.getOwnNamespace();

            function addVar(typeName: keyof typeof DataType, value: any) {
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
        }
    });

    beforeEach(function () {
        const now = new Date().getTime();
        this.clock = sinon.useFakeTimers(now);
    });
    afterEach(function () {
        this.clock.restore();
    });

    it("SM4-1 should return Good if DeadBandFilter is NOT specified on boolean value monitored item", async function () {
        const subscription = makeSubscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        async function test_with_nodeId(nodeId: NodeIdLike) {
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
            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        const namespaceSimulationIndex = 1;
        const nodeIdBoolean = coerceNodeId("s=Static_Boolean", namespaceSimulationIndex);
        const statusCode = await test_with_nodeId(nodeIdBoolean);
        statusCode.should.eql(StatusCodes.Good);

        subscription.terminate();
        subscription.dispose();
    });
    it("SM4-2 should return Good if DeadBandFilter is NOT specified on String value monitored item", async function () {
        const subscription = makeSubscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        async function test_with_nodeId(nodeId: string) {
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
            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        const statusCode = await test_with_nodeId("ns=1;s=Static_String");
        statusCode.should.eql(StatusCodes.Good);

        subscription.terminate();
        subscription.dispose();
    });
    it("SM4-3 should return Good if DeadBandFilter is NOT specified on ByteString value monitored item", async () => {
        const subscription = makeSubscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        async function test_with_nodeId(nodeId: string) {
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
            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        const statusCode = await test_with_nodeId("ns=1;s=Static_ByteString");
        statusCode.should.eql(StatusCodes.Good);

        subscription.terminate();
        subscription.dispose();
    });

    it("SM4-4 should return Good if DeadBandFilter is NOT specified on LocalizedText value monitored item", async () => {
        const subscription = makeSubscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        async function test_with_nodeId(nodeId: string) {
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
            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        const statusCode = await test_with_nodeId("ns=1;s=Static_LocalizedText");
        statusCode.should.eql(StatusCodes.Good);

        subscription.terminate();
        subscription.dispose();
    });

    it("SM4-5 should return BadFilterNotAllowed if DeadBandFilter is specified on boolean value monitored item", async function () {
        const subscription = makeSubscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        async function test_with_nodeId(nodeId: string) {
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
            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        const statusCode = await test_with_nodeId("ns=1;s=Static_Boolean");
        statusCode.should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();
        subscription.dispose();
    });
    it("SM4-6 should return BadFilterNotAllowed if DeadBandFilter is specified on String value monitored item", async () => {
        const subscription = makeSubscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        async function test_with_nodeId(nodeId: string) {
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
            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        const statusCode = await test_with_nodeId("ns=1;s=Static_String");

        subscription.terminate();
        subscription.dispose();
        statusCode.should.eql(StatusCodes.BadFilterNotAllowed);
    });
    it("SM4-7 should return BadFilterNotAllowed if DeadBandFilter is specified on ByteString value monitored item", async function () {
        const subscription = makeSubscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        async function test_with_nodeId(nodeId: string) {
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
            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        const statusCode = await test_with_nodeId("ns=1;s=Static_ByteString");
        statusCode.should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();
        subscription.dispose();
    });

    it("SM4-8 should return BadFilterNotAllowed if DeadBandFilter is specified on LocalizedText value monitored item", async () => {
        const subscription = makeSubscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        async function test_with_nodeId(nodeId: string) {
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
            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            return createResult.statusCode;
        }

        const statusCode = await test_with_nodeId("ns=1;s=Static_LocalizedText");
        statusCode.should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();
        subscription.dispose();
    });
});
