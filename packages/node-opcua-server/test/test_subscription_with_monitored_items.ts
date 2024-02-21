/* eslint-disable max-statements */
"use strict";

import should from "should";
import sinon from "sinon";

import { TimestampsToReturn } from "node-opcua-service-read";
import {
    BaseNode,
    IAddressSpace,
    INamespace,
    INamespaceDataAccess,
    ISessionContext,
    Namespace,
    SessionContext,
    UAVariable
} from "node-opcua-address-space";
import { DataValue } from "node-opcua-data-value";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId, coerceNodeId } from "node-opcua-nodeid";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import {
    MonitoringParameters,
    MonitoredItemCreateRequest,
    MonitoringMode,
    PublishRequest,
    MonitoredItemCreateResult,
    DataChangeFilter,
    DataChangeTrigger,
    DeadbandType
} from "node-opcua-service-subscription";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import * as encode_decode from "node-opcua-basic-types";
import { nodesets } from "node-opcua-nodesets";
import { MonitoredItemNotification, PublishResponse, Range, WriteValue } from "node-opcua-types";
import { add_eventGeneratorObject } from "node-opcua-address-space/testHelpers";
import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";
import { standardUnits } from "node-opcua-data-access";
import { IBasicMonitoredItem, ResponseCallback } from "node-opcua-client";
import { Int64 } from "node-opcua-basic-types";
import {
    Subscription,
    SubscriptionState,
    ServerSidePublishEngine,
    MonitoredItem,
    ServerEngine,
    SubscriptionOptions
} from "../source";
import { getFakePublishEngine } from "./helper_fake_publish_engine";

const mini_nodeset_filename = get_mini_nodeset_filename();
const fake_publish_engine = getFakePublishEngine();

const context = SessionContext.defaultContext;

const doDebug = false;

const now = new Date().getTime();

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

function _simulate_client_adding_publish_request(test: any, publishEngine: any, callback?: () => void) {
    callback = callback || (() => undefined);
    const publishRequest = new PublishRequest({});
    publishEngine._on_PublishRequest(publishRequest, callback);
    test.clock.tick(0);
}

function makeSubscription(options: SubscriptionOptions) {
    const subscription1 = new Subscription(options);
    (subscription1 as any).$session = {
        sessionContext: SessionContext.defaultContext
    };
    return subscription1;
}

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("SM1 - Subscriptions and MonitoredItems", function (this: any) {
    this.timeout(Math.max(300000, this.timeout()));

    let addressSpace: IAddressSpace;
    let namespace: INamespace;
    let someVariableNode: NodeId;
    let analogItemNode: NodeId;
    let accessLevel_CurrentRead_NotUserNode: UAVariable;
    let uaSomeVariable: UAVariable;

    let engine: ServerEngine;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;

    function simulate_client_adding_publish_request(publishEngine: any, callback?: () => void) {
        _simulate_client_adding_publish_request(test, publishEngine, callback);
    }

    before((done) => {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: nodesets.standard }, function () {
            addressSpace = engine.addressSpace!;
            namespace = addressSpace.getOwnNamespace();

            uaSomeVariable = namespace.addVariable({
                organizedBy: "RootFolder",
                browseName: "SomeVariable",
                dataType: "UInt32",
                value: { dataType: DataType.UInt32, value: 0 }
            });

            someVariableNode = uaSomeVariable.nodeId;

            function addVar(typeName: keyof typeof DataType, value: any) {
                namespace.index.should.eql(1);

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

            const name = "AccessLevel_CurrentRead_NotUser";

            accessLevel_CurrentRead_NotUserNode = namespace.addVariable({
                organizedBy: "RootFolder",
                browseName: name,
                description: { locale: "en", text: name },
                nodeId: "s=" + name,
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

            function addAnalogItem(dataType: DataType | keyof typeof DataType): NodeId {
                const name = "AnalogItem" + dataType;

                const node = (namespace as unknown as INamespaceDataAccess).addAnalogDataItem({
                    organizedBy: "RootFolder",
                    nodeId: "s=" + name,
                    browseName: name,
                    definition: "(tempA -25) + tempB",
                    valuePrecision: 0.5,
                    engineeringUnitsRange: { low: 1, high: 50 },
                    instrumentRange: { low: 1, high: 50 },
                    engineeringUnits: standardUnits.degree_celsius,
                    dataType: dataType,
                    value: new Variant({
                        arrayType: VariantArrayType.Scalar,
                        dataType: DataType[dataType],
                        value: 0.0
                    })
                });
                return node.nodeId;
            }

            analogItemNode = addAnalogItem("Double");
            done();
        });
    });
    after(async () => {
        if (engine) {
            await engine.shutdown();
            engine.dispose();
        }
    });

    beforeEach(() => {
        if (test.clock) {
            throw new Error("Invalid sta");
        }
        test.clock = sinon.useFakeTimers(now);
    });
    afterEach(() => {
        test.clock.tick(1000);
        test.clock.restore();
        test.clock = undefined;
    });

    it("SM1-1 a subscription should accept monitored item", async () => {
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

        const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: { nodeId: someVariableNode },
            monitoringMode: MonitoringMode.Reporting,

            requestedParameters: {
                queueSize: 10,
                samplingInterval: 100
            }
        });

        subscription.monitoredItemCount.should.eql(0);

        const createResult = await subscription.createMonitoredItem(
            addressSpace,
            TimestampsToReturn.Both,
            monitoredItemCreateRequest
        );
        createResult.statusCode.should.eql(StatusCodes.Good);

        subscription.monitoredItemCount.should.eql(1);

        createResult.should.be.instanceOf(MonitoredItemCreateResult);

        createResult.revisedSamplingInterval.should.eql(100);

        subscription.on("terminated", function () {
            // monitored Item shall be deleted at this stage
            subscription.monitoredItemCount.should.eql(0);
        });
        subscription.terminate();
        subscription.dispose();
    });

    it("SM1-2 a subscription should fire the event removeMonitoredItem", async () => {
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

        const removeMonitoredItemSpy = sinon.spy();
        subscription.on("removeMonitoredItem", removeMonitoredItemSpy);

        const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: { nodeId: someVariableNode },
            monitoringMode: MonitoringMode.Reporting,

            requestedParameters: {
                queueSize: 10,
                samplingInterval: 100
            }
        });

        const createResult = await subscription.createMonitoredItem(
            addressSpace,
            TimestampsToReturn.Both,
            monitoredItemCreateRequest
        );

        subscription.on("terminated", function () {
            // monitored Item shall be deleted at this stage
        });
        subscription.terminate();
        subscription.dispose();
        removeMonitoredItemSpy.callCount.should.eql(1);
        subscription.monitoredItemCount.should.eql(0);
    });

    function makeSubscription(options: SubscriptionOptions) {
        const subscription1 = new Subscription(options);
        (subscription1 as any).$session = {
            sessionContext: SessionContext.defaultContext
        };
        return subscription1;
    }
    it("SM1-3 a subscription should collect monitored item notification with _harvestMonitoredItems", async () => {
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

        const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: { nodeId: someVariableNode },
            monitoringMode: MonitoringMode.Reporting,
            requestedParameters: {
                queueSize: 10,
                samplingInterval: 100
            }
        });

        const createResult = await subscription.createMonitoredItem(
            addressSpace,
            TimestampsToReturn.Both,
            monitoredItemCreateRequest
        );
        createResult.statusCode.should.eql(StatusCodes.Good);
        createResult.revisedSamplingInterval.should.eql(100);

        const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;

        // data collection is done asynchronously => let give some time for this to happen
        test.clock.tick(5);

        // at first, _harvestMonitoredItems  should has 1 notification with current dataItem value
        subscription._harvestMonitoredItems();
        should(subscription.pendingNotificationsCount).equal(1);

        // now simulate some data change
        test.clock.tick(500);

        monitoredItem.queue.length.should.eql(5);

        // then, _harvestMonitoredItems  should collect at least 2 values
        subscription._harvestMonitoredItems();
        subscription.pendingNotificationsCount.should.eql(6);

        const notifications = [...subscription._pending_notifications.values()];

        notifications[0].monitoredItemId!.should.eql(monitoredItem.monitoredItemId);

        subscription.on("terminated", () => {
            /** */
        });

        subscription.terminate();
        subscription.dispose();
    });

    it("SM1-4 a subscription should collect monitored item notification at publishing interval", async () => {
        unfreeze_data_source();

        const publishEngine = new ServerSidePublishEngine();

        const subscription = makeSubscription({
            publishingInterval: 500,
            maxKeepAliveCount: 20,
            publishEngine: publishEngine,
            publishingEnabled: true,
            id: 1000,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        publishEngine.add_subscription(subscription);

        simulate_client_adding_publish_request(subscription.publishEngine);

        test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount);
        subscription.state.should.eql(SubscriptionState.LATE);

        // Monitored item will report a new value every tick => 100 ms
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        // let spy the notifications event handler
        const spy_notification_event = sinon.spy();
        subscription.on("notification", spy_notification_event);

        const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: { nodeId: someVariableNode },
            monitoringMode: MonitoringMode.Reporting,
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

        const createResult = await subscription.createMonitoredItem(
            addressSpace,
            TimestampsToReturn.Both,
            monitoredItemCreateRequest
        );

        createResult.statusCode.should.eql(StatusCodes.Good);

        const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;
        monitoredItem.samplingInterval.should.eql(100);

        // data collection is done asynchronously => let give some time for this to happen
        test.clock.tick(5);

        // initial value shall already be in the queue
        monitoredItem.queue.length.should.eql(1);

        test.clock.tick(29);
        // now simulate some data change
        test.clock.tick(100);
        monitoredItem.queue.length.should.eql(2);

        test.clock.tick(100);
        monitoredItem.queue.length.should.eql(3);

        test.clock.tick(100);
        monitoredItem.queue.length.should.eql(4);

        freeze_data_source();

        test.clock.tick(800);

        // monitoredItem values should have been harvested by subscription timer by now
        monitoredItem.queue.length.should.eql(0);

        //xx dump(subscription._pending_notifications);

        unfreeze_data_source();

        // now let the subscription send a PublishResponse to the client
        test.clock.tick(3 * 100);
        monitoredItem.queue.length.should.eql(3);

        freeze_data_source();
        test.clock.tick(800);

        // monitoredItem values should have been harvested by subscription timer by now
        monitoredItem.queue.length.should.eql(0);

        spy_notification_event.callCount.should.be.equal(2);

        subscription.terminate();
        subscription.dispose();

        publishEngine.shutdown();
        publishEngine.dispose();
    });

    it("SM1-5 should provide a mean to access the monitored clientHandle ( using the standard OPCUA method getMonitoredItems)", async () => {
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

        const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: { nodeId: someVariableNode },
            monitoringMode: MonitoringMode.Reporting,
            requestedParameters: {
                clientHandle: 123,
                queueSize: 10,
                samplingInterval: 100
            }
        });

        const createResult = await subscription.createMonitoredItem(
            addressSpace,
            TimestampsToReturn.Both,
            monitoredItemCreateRequest
        );
        createResult.statusCode.should.eql(StatusCodes.Good);

        const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;

        const result = subscription.getMonitoredItems();
        result.statusCode.should.eql(StatusCodes.Good);
        Array.from(result.serverHandles.map((a) => parseInt(a.toString(), 10))).should.eql([monitoredItem.monitoredItemId]);
        Array.from(result.clientHandles.map((a) => parseInt(a.toString(), 10))).should.eql([monitoredItem.clientHandle]);

        subscription.terminate();
        subscription.dispose();
    });

    async function on_subscription(actionFunc: any) {
        // see Err-03.js
        const subscription = makeSubscription({
            id: 42,
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });

        try {
            await actionFunc(subscription);
        } finally {
            subscription.terminate();
            subscription.dispose();
        }
    }

    it("SM1-6 should return BadMonitoredItemFilterUnsupported if filter is DataChangeFilter PercentDeadBand and variable has no EURange", async () => {
        const not_a_analogItemNode = someVariableNode;

        await on_subscription(async (subscription: Subscription) => {
            const monitoredItemCreateRequest1 = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: not_a_analogItemNode,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.Percent,
                        deadbandValue: 10.0 /* 10% */
                    })
                }
            });

            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest1
            );
            createResult.statusCode.should.eql(StatusCodes.BadMonitoredItemFilterUnsupported);
        });
    });

    it("SM1-7 should return an error when filter is DataChangeFilter deadband is out of bound", async () => {
        function _create_MonitoredItemCreateRequest_with_deadbandValue(value: number) {
            return new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: analogItemNode,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 100,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.Status,
                        deadbandType: DeadbandType.Percent,
                        deadbandValue: value
                    })
                }
            });
        }

        await on_subscription(async (subscription: Subscription) => {
            const monitoredItemCreateRequest1 = _create_MonitoredItemCreateRequest_with_deadbandValue(-10);

            const createResult1 = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest1
            );

            createResult1.statusCode.should.eql(StatusCodes.BadDeadbandFilterInvalid);

            const monitoredItemCreateRequest2 = _create_MonitoredItemCreateRequest_with_deadbandValue(110);

            const createResult2 = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest2
            );
            createResult2.statusCode.should.eql(StatusCodes.BadDeadbandFilterInvalid);

            const monitoredItemCreateRequest3 = _create_MonitoredItemCreateRequest_with_deadbandValue(90);
            const createResult3 = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest3
            );
            createResult3.statusCode.should.eql(StatusCodes.Good);
        });
    });

    it("SM1-8 should return BadFilterNotAllowed if a DataChangeFilter is specified on a non-Value Attribute monitored item", async () => {
        await on_subscription(async (subscription: Subscription) => {
            async function test_with_attributeId(attributeId: AttributeIds) {
                const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                    itemToMonitor: {
                        nodeId: analogItemNode,
                        attributeId: attributeId
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

            (await test_with_attributeId(AttributeIds.BrowseName)).should.eql(StatusCodes.BadFilterNotAllowed);
            (await test_with_attributeId(AttributeIds.AccessLevel)).should.eql(StatusCodes.BadFilterNotAllowed);
            (await test_with_attributeId(AttributeIds.ArrayDimensions)).should.eql(StatusCodes.BadFilterNotAllowed);
            (await test_with_attributeId(AttributeIds.DataType)).should.eql(StatusCodes.BadFilterNotAllowed);
            (await test_with_attributeId(AttributeIds.DisplayName)).should.eql(StatusCodes.BadFilterNotAllowed);
            (await test_with_attributeId(AttributeIds.EventNotifier)).should.eql(StatusCodes.BadFilterNotAllowed);
            (await test_with_attributeId(AttributeIds.Historizing)).should.eql(StatusCodes.BadFilterNotAllowed);
            (await test_with_attributeId(AttributeIds.Value)).should.eql(StatusCodes.Good);
        });
    });

    it("SM1-9 With 3 subscriptions with monitored items", async () => {
        const publishEngine = new ServerSidePublishEngine({});

        let _clientHandle = 1;

        function my_samplingFunc(
            this: any,
            sessionContext: ISessionContext | null,
            oldData: DataValue,
            callback: ResponseCallback<DataValue>
        ) {
            //xx console.log(self.toString());
            const dataValue = addressSpace.findNode(this.node.nodeId)!.readAttribute(null, 13);
            callback(null, dataValue);
        }

        async function add_monitoredItem(subscription: Subscription) {
            const nodeId = "ns=1;s=Static_Float";
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    clientHandle: _clientHandle++,
                    queueSize: 10,
                    samplingInterval: 200
                }
            });

            const n = addressSpace.findNode("ns=100;s=Static_Float");
            //xx console.log(n.toString());

            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            // data collection is done asynchronously => let give some time for this to happen
            test.clock.tick(1);
        }

        function perform_publish_transaction_and_check_subscriptionId(subscription: Subscription) {
            const pubFunc = sinon.spy();

            simulate_client_adding_publish_request(publishEngine, pubFunc);

            test.clock.tick(subscription.publishingInterval);

            pubFunc.callCount.should.eql(1);

            //xx console.log(pubFunc.getCall(0).args[1].toString());

            pubFunc.getCall(0).args[1].subscriptionId.should.eql(subscription.id);
        }

        // mainTree\Monitored Item Services\Monitor Items 100\Test Cases\002.js - createMonitoredItems100x3subscriptions
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
        const subscription1 = makeSubscription({
            publishingInterval: 250,
            maxKeepAliveCount: 10,
            id: 10000,
            publishEngine: publishEngine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        publishEngine.add_subscription(subscription1);
        subscription1.state.should.eql(SubscriptionState.CREATING);

        test.clock.tick(subscription1.publishingInterval * subscription1.maxKeepAliveCount);
        subscription1.state.should.eql(SubscriptionState.LATE);

        subscription1.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = my_samplingFunc;
        });

        await add_monitoredItem(subscription1);

        perform_publish_transaction_and_check_subscriptionId(subscription1);
        subscription1.state.should.eql(SubscriptionState.NORMAL);

        //---------------------------------------------------- Subscription 2 - 1000 ms
        const subscription2 = makeSubscription({
            id: 20000,
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: publishEngine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        publishEngine.add_subscription(subscription2);

        subscription2.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = my_samplingFunc;
        });

        await add_monitoredItem(subscription2);

        perform_publish_transaction_and_check_subscriptionId(subscription2);
        subscription1.state.should.eql(SubscriptionState.NORMAL);

        //---------------------------------------------------- Subscription 3 - 5000 ms
        const subscription3 = makeSubscription({
            id: 30000,
            publishingInterval: 5000,
            maxKeepAliveCount: 20,
            publishEngine: publishEngine,
            globalCounter: { totalMonitoredItemCount: 0 },
            serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
        });
        publishEngine.add_subscription(subscription3);

        subscription3.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = my_samplingFunc;
        });

        await add_monitoredItem(subscription3);

        //xx console.log(pubFunc.getCall(0).args[0].toString());
        //xx console.log(pubFunc.getCall(0).args[1].toString());
        //perform_publish_transaction_and_check_subscriptionId(subscription1);

        subscription1.terminate();
        subscription1.dispose();
        subscription2.terminate();
        subscription2.dispose();
        subscription3.terminate();
        subscription3.dispose();
        publishEngine.shutdown();
        publishEngine.dispose();
    });

    it("SM1-10 should return BadFilterNotAllowed if DeadBandFilter is specified on non-Numeric value monitored item", async () => {
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

        (await test_with_nodeId("ns=1;s=Static_ByteString")).should.eql(StatusCodes.BadFilterNotAllowed);
        (await test_with_nodeId("ns=1;s=Static_LocalizedText")).should.eql(StatusCodes.BadFilterNotAllowed);

        subscription.terminate();
        subscription.dispose();
    });

    describe("SM1-A MonitoredItem - Access Right - and Unknown Nodes", () => {
        let subscription: Subscription | undefined = undefined;

        beforeEach(() => {
            subscription = makeSubscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                publishEngine: fake_publish_engine,
                globalCounter: { totalMonitoredItemCount: 0 },
                serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
            });
            subscription.id = 1000;
            //xx publishEngine.add_subscription(subscription);

            // let spy the notifications event handler
            const spy_notification_event = sinon.spy();
            subscription.on("notification", spy_notification_event);

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = sinon.spy((sessionContext, oldValue, callback) => {
                    const dataValue = monitoredItem.node.readAttribute(null, monitoredItem.itemToMonitor.attributeId);
                    //xx console.log("dataValue ",dataValue.toString());
                    callback(null, dataValue);
                });

                monitoredItem.node.should.eql(addressSpace.findNode(monitoredItem.itemToMonitor.nodeId));
            });
        });
        afterEach(() => {
            if (subscription) {
                subscription.terminate();
                subscription.dispose();
                subscription = undefined;
            }
        });

        function simulate_publish_request_expected_statusCode(monitoredItem: MonitoredItem, expectedStatusCode: StatusCode) {
            test.clock.tick(100);

            // process publish
            const notifs = monitoredItem.extractMonitoredItemNotifications();

            monitoredItem.queue.length.should.eql(0);

            if (expectedStatusCode === undefined) {
                notifs.length.should.eql(0, "should have no pending notification");
            } else {
                //xx console.log("-----------!!!!");
                //xx notifs.forEach(x=>console.log(x.toString()));
                notifs.length.should.eql(1, " should have one pending notification");

                const monitoredItemNotification = notifs[0] as MonitoredItemNotification;
                monitoredItemNotification.value.statusCode.should.eql(expectedStatusCode);
            }
        }

        it("SM1-A-1  CreateMonitoredItems on an item to which the user does not have read-access; should succeed but Publish should return the error ", async () => {
            if (!subscription) throw new Error("internal error");

            // specs:
            // When a user adds a monitored item that the user is denied read access to, the add operation for
            // the item shall succeed and the bad status Bad_NotReadable or Bad_UserAccessDenied shall be
            // returned in the Publish response. This is the same behaviour for the case where the access rights
            // are changed after the call to CreateMonitoredItems. If the access rights change to read rights, the
            // Server shall start sending data for the MonitoredItem. The same procedure shall be applied for an
            // IndexRange that does not deliver data for the current value but could deliver data in the future.

            if (doDebug) {
                console.log("    ", accessLevel_CurrentRead_NotUserNode.toString());
                console.log(
                    "   accessLevel_CurrentRead_NotUserNode.isUserReadable(context)  ",
                    accessLevel_CurrentRead_NotUserNode.isUserReadable(context)
                );
            }
            accessLevel_CurrentRead_NotUserNode.isReadable(context).should.eql(true);
            accessLevel_CurrentRead_NotUserNode.isUserReadable(context).should.eql(false);

            const nodeId = accessLevel_CurrentRead_NotUserNode.nodeId;
            nodeId.should.be.instanceOf(NodeId);

            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 0
                }
            });

            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );

            createResult.statusCode.should.eql(StatusCodes.Good);

            const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;

            monitoredItem.queueSize.should.eql(10);

            //xx monitoredItem.queue.length.should.eql(1);

            simulate_publish_request_expected_statusCode(monitoredItem, StatusCodes.BadNotReadable);
        });

        it("SM1-A-2  should return BadNodeIdUnknown when trying to monitor an invalid node", async () => {
            if (!subscription) throw new Error("internal error");

            const nodeId = "ns=567;s=MyVariable";

            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 0
                }
            });

            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );

            if (doDebug) {
                console.log(createResult.toString());
            }

            createResult.statusCode.should.eql(StatusCodes.BadNodeIdUnknown);

            const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId);
            should.not.exist(monitoredItem);
        });

        it("SM1-A-3  should eventually emit DataChangeNotification when trying to monitor an invalid node that become valid", async () => {
            if (!subscription) throw new Error("internal error");

            const nodeVariable = namespace.addVariable({
                browseName: "MyVar",
                nodeId: "s=MyVariable",
                dataType: "Double",
                value: { dataType: "Double", value: 3.14 },
                minimumSamplingInterval: 100
            });
            const nodeId = "ns=1;s=MyVariable";

            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 0
                }
            });

            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );

            if (doDebug) {
                console.log(createResult.toString());
            }

            createResult.statusCode.should.eql(StatusCodes.Good);

            const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;
            should.exist(monitoredItem);

            simulate_publish_request_expected_statusCode(monitoredItem, StatusCodes.Good);

            nodeVariable.setValueFromSource({ dataType: "Double", value: 6.28 });
            simulate_publish_request_expected_statusCode(monitoredItem, StatusCodes.Good);

            addressSpace.deleteNode(nodeVariable);

            simulate_publish_request_expected_statusCode(monitoredItem, StatusCodes.BadNodeIdInvalid);
        });
    });

    describe("SM1-B DeadBandFilter !!!", function () {
        let subscription: Subscription | undefined = undefined;

        before(() => {
            subscription = makeSubscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                publishEngine: fake_publish_engine,
                globalCounter: { totalMonitoredItemCount: 0 },
                serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
            });
            subscription.id = 1000;
            //xx publishEngine.add_subscription(subscription);

            // let spy the notifications event handler
            const spy_notification_event = sinon.spy();
            subscription.on("notification", spy_notification_event);

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = function () {
                    /** empty */
                }; //install_spying_samplingFunc();

                monitoredItem.node.nodeId.should.eql(monitoredItem.itemToMonitor.nodeId);
            });
        });
        after(() => {
            if (subscription) {
                subscription.terminate();
                subscription.dispose();
                subscription = undefined;
            }
        });

        const integerDeadband = 2;
        const integerWritesFail = [8, 7, 10];
        const integerWritesPass = [3, 6, 13];

        const floatDeadband = 2.2;
        const floatWritesFail = [2.3, 4.4, 1.6];
        const floatWritesPass = [6.4, 4.1, 8.4];

        const integer64Deadband = 2;
        const integer64WritesFail = [
            [0, 8],
            [0, 7],
            [0, 10]
        ];
        const integer64WritesPass = [
            [0, 3],
            [0, 6],
            [0, 13]
        ];

        /*
         Specify a filter using a deadband absolute.
         - Set the deadband value to 2.
         - Write numerous values to the item that will cause event notifications to be sent, and for some items to be filtered.
         - call Publish() to verify the deadband is correctly filtering values.
         */
        async function test_deadband(
            dataType: DataType | keyof typeof DataType | string,
            deadband: number,
            writesPass: number[] | Int64[],
            writesFail: number[] | Int64[]
        ) {
            if (!subscription) throw new Error("internal error");

            const nodeId = "ns=1;s=Static_" + dataType;
            const node = engine.addressSpace!.findNode(nodeId)! as UAVariable;
            should.exists(node);

            node.minimumSamplingInterval.should.be.belowOrEqual(100);

            function simulate_node_value_change(currentValue: any) {
                const v = new Variant({
                    dataType: DataType[dataType as keyof typeof DataType],
                    arrayType: VariantArrayType.Scalar,
                    value: currentValue
                });

                test.clock.tick(1000);

                node.setValueFromSource(v);
                node.readValue().value.value.should.eql(currentValue, "value must have been recorded");
            }

            let notifs;

            let currentValue = writesFail[0];
            simulate_node_value_change(currentValue);

            // create monitor item
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 0,
                    filter: new DataChangeFilter({
                        trigger: DataChangeTrigger.StatusValue,
                        deadbandType: DeadbandType.Absolute,
                        deadbandValue: deadband
                    })
                }
            });

            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );

            // data collection is done asynchronously => let give some time for this to happen
            test.clock.tick(5);

            createResult.statusCode.should.eql(StatusCodes.Good);
            const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;

            monitoredItem.queueSize.should.eql(10);
            monitoredItem.queue.length.should.eql(1);

            function simulate_publish_request_and_check_one(expectedValue: any) {
                test.clock.tick(100);

                // process publish
                notifs = monitoredItem.extractMonitoredItemNotifications();

                monitoredItem.queue.length.should.eql(0);

                if (expectedValue === undefined) {
                    notifs.length.should.eql(0, "should have no pending notification");
                } else {
                    notifs.length.should.eql(1, " should have one pending notification");

                    expectedValue = (encode_decode as any)["coerce" + dataType](expectedValue);

                    // verify that value matches expected value
                    (notifs[0] as any).value.value.value.should.eql(expectedValue);
                }
            }

            simulate_publish_request_and_check_one(writesFail[0]);

            // write second value to node
            currentValue = writesFail[1];
            simulate_node_value_change(currentValue);
            simulate_publish_request_and_check_one(undefined);

            // write third value to node
            currentValue = writesFail[2];
            simulate_node_value_change(currentValue);
            simulate_publish_request_and_check_one(undefined);

            // ---------------------------------------------------------------------------------------------------------
            currentValue = writesPass[0];
            simulate_node_value_change(currentValue);
            simulate_publish_request_and_check_one(currentValue);

            currentValue = writesPass[1];
            simulate_node_value_change(currentValue);
            simulate_publish_request_and_check_one(currentValue);

            currentValue = writesPass[2];
            simulate_node_value_change(currentValue);
            simulate_publish_request_and_check_one(currentValue);
        }

        ["SByte", "Int16", "Int32", "Byte", "UInt16", "UInt32"].forEach(function (dataType) {
            it("testing with " + dataType, async () => {
                await test_deadband(dataType, integerDeadband, integerWritesPass, integerWritesFail);
            });
        });
        ["Float", "Double"].forEach(function (dataType) {
            it("testing with " + dataType, async () => {
                await test_deadband(dataType, floatDeadband, floatWritesPass, floatWritesFail);
            });
        });

        ["Int64", "UInt64"].forEach(function (dataType) {
            it("testing with " + dataType, async () => {
                await test_deadband(dataType, integer64Deadband, integer64WritesPass, integer64WritesFail);
            });
        });

        it("SM1-B-1  testing with String and DeadBandFilter", async () => {
            if (!subscription) throw new Error("internal error");
            const nodeId = "ns=1;s=Static_LocalizedText";

            const filter = new DataChangeFilter({
                trigger: DataChangeTrigger.StatusValue,
                deadbandType: DeadbandType.Absolute,
                deadbandValue: 10.0
            });

            // create monitor item
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: {
                    nodeId: nodeId,
                    attributeId: AttributeIds.Value
                },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 0,
                    filter: null
                }
            });

            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );

            // data collection is done asynchronously => let give some time for this to happen
            test.clock.tick(5);

            createResult.statusCode.should.eql(StatusCodes.Good);
            const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;

            // now modify monitoredItem setting a filter
            const res = monitoredItem.modify(
                null,
                new MonitoringParameters({
                    samplingInterval: 0,
                    discardOldest: true,
                    queueSize: 1,
                    filter: filter
                })
            );

            /* MonitoredItemModifyResult*/
            res.statusCode.should.eql(StatusCodes.BadFilterNotAllowed);
        });
    });

    describe("SM1-C MonitoredItem should set SemanticChanged bit on statusCode when appropriate", () => {
        function changeEURange(analogItem: any, done: () => void) {
            const dataValueOrg = analogItem.readAttribute(AttributeIds.Value);

            const dataValue = {
                value: {
                    dataType: DataType.ExtensionObject,
                    value: new Range({
                        low: dataValueOrg.value.value.low + 1,
                        high: dataValueOrg.value.value.high + 1
                    })
                }
            };

            const writeValue = new WriteValue({
                attributeId: AttributeIds.Value,
                value: dataValue
            });
            analogItem.euRange.writeAttribute(writeValue, done);
        }
    });

    describe("SM1-D matching minimumSamplingInterval", function () {
        it("SM1-D-1 server should not allow monitoredItem sampling interval to be lesser than UAVariable minimumSampling interval", async () => {
            uaSomeVariable.minimumSamplingInterval = 1000;
            uaSomeVariable.minimumSamplingInterval.should.eql(1000);

            const subscription = makeSubscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                publishEngine: fake_publish_engine,
                globalCounter: { totalMonitoredItemCount: 0 },
                serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
            });

            try {
                subscription.on("monitoredItem", function (monitoredItem) {
                    monitoredItem.samplingFunc = install_spying_samplingFunc();
                });

                const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                    itemToMonitor: { nodeId: someVariableNode },
                    monitoringMode: MonitoringMode.Reporting,
                    requestedParameters: {
                        clientHandle: 123,
                        queueSize: 10,
                        samplingInterval: 100
                    }
                });
                monitoredItemCreateRequest.requestedParameters.samplingInterval.should.eql(
                    100,
                    "Requesting a very small sampling interval"
                );

                const createResult = await subscription.createMonitoredItem(
                    addressSpace,
                    TimestampsToReturn.Both,
                    monitoredItemCreateRequest
                );
                createResult.statusCode.should.eql(StatusCodes.Good);

                const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;

                monitoredItem.samplingInterval.should.eql(
                    1000,
                    "monitoredItem samplingInterval should match node minimumSamplingInterval"
                );

                // ---------------------------------------------------------------------------------------------------------
                // Modifying sampling interval
                // ---------------------------------------------------------------------------------------------------------

                const timestampsToReturn = TimestampsToReturn.Both;
                const requestedParameters = new MonitoringParameters({
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1000
                });

                const monitoredItemModifyResult = monitoredItem.modify(timestampsToReturn, requestedParameters);

                monitoredItemModifyResult.revisedSamplingInterval.should.eql(1000);

                monitoredItem.samplingInterval.should.eql(
                    1000,
                    "monitoredItem samplingInterval should match node minimumSamplingInterval"
                );
            } finally {
                subscription.terminate();
                subscription.dispose();
            }
        });
        it("SM1-D-2 server should not allow monitoredItem sampling interval to be lesser than the MonitoredItem.minimumSamplingInterval limit (unless 0) ", async () => {
            uaSomeVariable.minimumSamplingInterval = 20;
            uaSomeVariable.minimumSamplingInterval.should.eql(20);
            uaSomeVariable.minimumSamplingInterval.should.be.lessThan(MonitoredItem.minimumSamplingInterval);

            const subscription = makeSubscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                publishEngine: fake_publish_engine,
                globalCounter: { totalMonitoredItemCount: 0 },
                serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
            });

            try {
                subscription.on("monitoredItem", function (monitoredItem) {
                    monitoredItem.samplingFunc = install_spying_samplingFunc();
                });

                const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                    itemToMonitor: { nodeId: someVariableNode },
                    monitoringMode: MonitoringMode.Reporting,
                    requestedParameters: {
                        clientHandle: 123,
                        queueSize: 10,
                        samplingInterval: 10
                    }
                });
                monitoredItemCreateRequest.requestedParameters.samplingInterval.should.eql(
                    10,
                    "Requesting a very small sampling interval"
                );

                const createResult = await subscription.createMonitoredItem(
                    addressSpace,
                    TimestampsToReturn.Both,
                    monitoredItemCreateRequest
                );
                createResult.statusCode.should.eql(StatusCodes.Good);

                const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;

                monitoredItem.samplingInterval.should.eql(
                    MonitoredItem.minimumSamplingInterval,
                    "monitoredItem samplingInterval should match node minimumSamplingInterval"
                );

                // ---------------------------------------------------------------------------------------------------------
                // Modifying sampling interval
                // ---------------------------------------------------------------------------------------------------------

                const timestampsToReturn = TimestampsToReturn.Both;
                const requestedParameters = new MonitoringParameters({
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1000
                });

                const monitoredItemModifyResult = monitoredItem.modify(timestampsToReturn, requestedParameters);

                monitoredItemModifyResult.revisedSamplingInterval.should.eql(MonitoredItem.minimumSamplingInterval);

                monitoredItem.samplingInterval.should.eql(
                    MonitoredItem.minimumSamplingInterval,
                    "monitoredItem samplingInterval should match node minimumSamplingInterval"
                );
            } finally {
                subscription.terminate();
                subscription.dispose();
            }
        });
    });
});

describe("SM2 - MonitoredItem advanced", function (this: any) {
    let addressSpace: IAddressSpace;
    let namespace: INamespace;
    let someVariableNode: NodeId;
    let uaSomeVariable: UAVariable;
    let engine: ServerEngine;
    let publishEngine: ServerSidePublishEngine;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;
    function simulate_client_adding_publish_request(publishEngine: ServerSidePublishEngine, callback: () => void) {
        _simulate_client_adding_publish_request(test, publishEngine, callback);
    }

    before((done) => {
        if (test.clock) {
            throw new Error("Internal Error");
        }
        engine = new ServerEngine();

        engine.initialize({ nodeset_filename: mini_nodeset_filename }, function () {
            addressSpace = engine.addressSpace!;
            namespace = addressSpace.getOwnNamespace();

            uaSomeVariable = namespace.addVariable({
                organizedBy: "RootFolder",
                browseName: "SomeVariable",
                dataType: "UInt32",
                value: { dataType: DataType.UInt32, value: 0 }
            });
            someVariableNode = uaSomeVariable.nodeId;

            add_eventGeneratorObject(namespace, "ObjectsFolder");

            const browsePath = makeBrowsePath("RootFolder", "/Objects/EventGeneratorObject");

            const opts = { addressSpace: engine.addressSpace };

            // console.log("eventGeneratingObject",browsePath.toString(opts));

            done();
        });
    });
    after(async () => {
        if (engine) {
            await engine.shutdown();
            engine.dispose();
        }
    });

    beforeEach(() => {
        if (test.clock) {
            throw new Error("Internal Error");
        }
        test.clock = sinon.useFakeTimers(now);

        publishEngine = new ServerSidePublishEngine();
    });

    afterEach(() => {
        if (publishEngine) {
            publishEngine.shutdown();
            publishEngine.dispose();
        }
        test.clock.tick(1000);
        test.clock.restore();
        test.clock = null;
    });

    describe("SM2A - #maxNotificationsPerPublish", function () {
        it("should have a proper maxNotificationsPerPublish default value", async () => {
            const subscription = makeSubscription({
                publishEngine: publishEngine,
                globalCounter: { totalMonitoredItemCount: 0 },
                serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
            });
            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = install_spying_samplingFunc();
            });

            subscription.id = 1;
            publishEngine.add_subscription(subscription);
            subscription.maxNotificationsPerPublish.should.eql(Subscription.maxNotificationPerPublishHighLimit);

            subscription.terminate();
            subscription.dispose();
        });

        function numberOfNotifications(publishResponse: PublishResponse) {
            const notificationData = publishResponse.notificationMessage.notificationData! || [];
            return notificationData.reduce((accumulated, data: any) => {
                return accumulated + data.monitoredItems.length;
            }, 0);
        }

        async function createMonitoredItem(subscription: Subscription, clientHandle: number) {
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: { nodeId: someVariableNode },
                monitoringMode: MonitoringMode.Reporting,
                requestedParameters: {
                    clientHandle: clientHandle,
                    queueSize: 10,
                    samplingInterval: 100
                }
            });

            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            createResult.statusCode.should.eql(StatusCodes.Good);

            const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId);
            should.exist(monitoredItem);
            return monitoredItem;
        }

        it("QA should not publish more notifications than expected", async () => {
            const spy_callback = sinon.spy();

            const subscription = makeSubscription({
                publishingInterval: 1000,
                maxKeepAliveCount: 20,
                publishEngine: publishEngine,
                maxNotificationsPerPublish: 4, // <<<< WE WANT NO MORE THAN 4 Notification per publish
                id: 2,
                globalCounter: { totalMonitoredItemCount: 0 },
                serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
            });
            subscription.maxNotificationsPerPublish.should.eql(4);

            publishEngine.add_subscription(subscription);

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = install_spying_samplingFunc();
            });

            test.clock.tick(subscription.publishingInterval * subscription.maxKeepAliveCount);
            simulate_client_adding_publish_request(publishEngine, spy_callback);
            simulate_client_adding_publish_request(publishEngine, spy_callback);
            simulate_client_adding_publish_request(publishEngine, spy_callback);
            simulate_client_adding_publish_request(publishEngine, spy_callback);

            subscription.state.should.eql(SubscriptionState.KEEPALIVE);

            //xx // let spy the notifications event handler
            //xx var spy_notification_event = sinon.spy();
            //xx subscription.on("notification", spy_notification_event);

            const monitoredItem1 = (await createMonitoredItem(subscription, 123))!;
            const monitoredItem2 = (await createMonitoredItem(subscription, 124))!;
            const monitoredItem3 = (await createMonitoredItem(subscription, 125))!;
            const monitoredItem4 = (await createMonitoredItem(subscription, 126))!;

            // simulate client sending publish request
            simulate_client_adding_publish_request(publishEngine, spy_callback);
            simulate_client_adding_publish_request(publishEngine, spy_callback);
            simulate_client_adding_publish_request(publishEngine, spy_callback);
            simulate_client_adding_publish_request(publishEngine, spy_callback);
            simulate_client_adding_publish_request(publishEngine, spy_callback);

            // now simulate some data change on monitored items
            test.clock.tick(100);
            test.clock.tick(100);
            test.clock.tick(100);
            test.clock.tick(100);
            test.clock.tick(100);
            // add an extra tick to allow all setImmediate call to be honoured
            test.clock.tick(1);

            freeze_data_source();

            // it should have initial value + 5 modification
            monitoredItem1.queue.length.should.eql(6);
            monitoredItem2.queue.length.should.eql(6);
            monitoredItem3.queue.length.should.eql(6);
            monitoredItem4.queue.length.should.eql(6);

            test.clock.tick(800);

            // now data should have been harvested
            // monitoredItem values should have been harvested by subscription timer by now
            monitoredItem1.queue.length.should.eql(0);
            monitoredItem2.queue.length.should.eql(0);
            monitoredItem3.queue.length.should.eql(0);
            monitoredItem4.queue.length.should.eql(0);

            // verify that publishResponse has been send
            const publishResponse0 = spy_callback.getCall(0).args[1];
            numberOfNotifications(publishResponse0).should.eql(0); // KeepAlive

            const publishResponse1 = spy_callback.getCall(1).args[1];
            numberOfNotifications(publishResponse1).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
            publishResponse1.moreNotifications.should.eql(true);

            spy_callback.callCount.should.eql(7);

            const publishResponse2 = spy_callback.getCall(2).args[1];
            numberOfNotifications(publishResponse2).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
            publishResponse2.moreNotifications.should.eql(true);

            const publishResponse3 = spy_callback.getCall(4).args[1];
            numberOfNotifications(publishResponse3).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
            publishResponse3.moreNotifications.should.eql(true);

            const publishResponse4 = spy_callback.getCall(5).args[1];
            numberOfNotifications(publishResponse4).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);

            const publishResponse5 = spy_callback.getCall(6).args[1];
            numberOfNotifications(publishResponse5).should.not.be.greaterThan(subscription.maxNotificationsPerPublish + 1);
            publishResponse5.moreNotifications.should.eql(false);

            subscription.terminate();
            subscription.dispose();
        });

        //
        xit(
            '#monitoringMode Publish / should always result in the server sending an "initial" data change. ' +
                " after monitoringMode is set to Disabled and then Reporting,",
            function (done) {
                // todo

                done();
            }
        );
    });

    describe("SM2B - Subscription.subscriptionDiagnostics", function () {
        let subscription: Subscription;
        beforeEach(function () {
            fake_publish_engine.pendingPublishRequestCount = 1000;

            subscription = new Subscription({
                priority: 10,
                publishingInterval: 100,
                maxNotificationsPerPublish: 123,
                maxKeepAliveCount: 21,
                lifeTimeCount: 67,
                publishingEnabled: true, //  PUBLISHING IS ENABLED !!!
                publishEngine: fake_publish_engine,
                globalCounter: { totalMonitoredItemCount: 0 },
                serverCapabilities: { maxMonitoredItems: 10000, maxMonitoredItemsPerSubscription: 1000 }
            });
            (subscription as any).$session = {
                nodeId: coerceNodeId("i=5;s=tmp"),
                sessionContext: SessionContext.defaultContext
            };
            // console.log(subscription.subscriptionDiagnostics.toString());

            subscription.on("monitoredItem", function (monitoredItem) {
                monitoredItem.samplingFunc = install_spying_samplingFunc();
            });
        });

        async function add_monitored_item(): Promise<MonitoredItem> {
            const nodeId = "i=2258"; // CurrentTime
            const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
                itemToMonitor: { nodeId: nodeId },
                monitoringMode: MonitoringMode.Reporting,

                requestedParameters: {
                    queueSize: 10,
                    samplingInterval: 1200
                }
            });
            const createResult = await subscription.createMonitoredItem(
                addressSpace,
                TimestampsToReturn.Both,
                monitoredItemCreateRequest
            );
            createResult.statusCode.should.eql(StatusCodes.Good);
            const monitoredItem = subscription.getMonitoredItem(createResult.monitoredItemId)!;

            return monitoredItem;
        }

        afterEach(function () {
            subscription.terminate();
            subscription.dispose();
        });

        it("should update Subscription.subscriptionDiagnostics.sessionId", function () {
            subscription.subscriptionDiagnostics.sessionId.should.eql(subscription.getSessionId());
        });

        it("should update Subscription.subscriptionDiagnostics.subscriptionId", function () {
            subscription.subscriptionDiagnostics.subscriptionId.should.eql(subscription.id);
        });

        it("should update Subscription.subscriptionDiagnostics.priority", function () {
            subscription.priority.should.eql(10);
            subscription.subscriptionDiagnostics.priority.should.eql(subscription.priority);
        });

        it("should update Subscription.subscriptionDiagnostics.publishingInterval", function () {
            subscription.publishingInterval.should.eql(100);
            subscription.subscriptionDiagnostics.publishingInterval.should.eql(subscription.publishingInterval);
        });

        it("should update Subscription.subscriptionDiagnostics.maxLifetimeCount", function () {
            subscription.lifeTimeCount.should.be.above(subscription.maxKeepAliveCount * 3 - 1);
            subscription.subscriptionDiagnostics.maxLifetimeCount.should.eql(subscription.lifeTimeCount);
        });

        it("should update Subscription.subscriptionDiagnostics.maxKeepAliveCount", function () {
            subscription.maxKeepAliveCount.should.eql(21);
            subscription.subscriptionDiagnostics.maxKeepAliveCount.should.eql(subscription.maxKeepAliveCount);
        });

        it("should update Subscription.subscriptionDiagnostics.maxNotificationsPerPublish", function () {
            subscription.maxNotificationsPerPublish.should.eql(123);
            subscription.subscriptionDiagnostics.maxNotificationsPerPublish.should.eql(subscription.maxNotificationsPerPublish);
        });

        it("should update Subscription.subscriptionDiagnostics.publishingEnabled", function () {
            subscription.publishingEnabled.should.eql(true);
            subscription.subscriptionDiagnostics.publishingEnabled.should.eql(subscription.publishingEnabled);
        });

        it("should update Subscription.subscriptionDiagnostics.nextSequenceNumber", function () {
            subscription.futureSequenceNumber.should.eql(1);
            subscription.subscriptionDiagnostics.nextSequenceNumber.should.eql(subscription.futureSequenceNumber);
        });

        it("should update Subscription.subscriptionDiagnostics.disabledMonitoredItemCount", async () => {
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(0);
            subscription.monitoredItemCount.should.eql(0);

            const m1 = await add_monitored_item();
            const m2 = await add_monitored_item();
            const m3 = await add_monitored_item();

            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(3);
            subscription.subscriptionDiagnostics.disabledMonitoredItemCount.should.eql(0);

            m1.setMonitoringMode(MonitoringMode.Disabled);
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(3);
            subscription.subscriptionDiagnostics.disabledMonitoredItemCount.should.eql(1);

            m2.setMonitoringMode(MonitoringMode.Disabled);
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(3);
            subscription.subscriptionDiagnostics.disabledMonitoredItemCount.should.eql(2);
        });

        it("should update Subscription.subscriptionDiagnostics.monitoredItemCount", async () => {
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(0);
            subscription.monitoredItemCount.should.eql(0);

            await add_monitored_item();
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(1);
            subscription.monitoredItemCount.should.eql(1);

            await add_monitored_item();
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(2);
            subscription.monitoredItemCount.should.eql(2);
        });

        it("should update Subscription.subscriptionDiagnostics.dataChangeNotificationsCount", async () => {
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(0);
            subscription.subscriptionDiagnostics.dataChangeNotificationsCount.should.eql(0);

            let evtNotificationCounter = 0;
            subscription.on("notification", (/*notificationMessage*/) => {
                evtNotificationCounter += 1;
            });

            subscription.publishingInterval.should.eql(100);

            const m = await add_monitored_item();
            m.samplingInterval.should.eql(1200, "monitored item sampling interval should be 1 seconds");
            subscription.subscriptionDiagnostics.monitoredItemCount.should.eql(1);

            // simulate notification
            // now simulate some data change in 5 seconds
            test.clock.tick(1200 * 5);

            evtNotificationCounter.should.eql(5);

            subscription.subscriptionDiagnostics.notificationsCount.should.eql(evtNotificationCounter);
            subscription.subscriptionDiagnostics.dataChangeNotificationsCount.should.eql(evtNotificationCounter);
        });

        xit("should update Subscription.subscriptionDiagnostics.eventNotificationsCount", function () {
            // todo
        });
    });
});
