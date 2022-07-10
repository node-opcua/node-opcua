import "should";
import * as sinon from "sinon";
import { DataType } from "node-opcua-variant";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, Namespace } from "node-opcua-address-space";
import { DataChangeFilter, DataChangeTrigger, MonitoredItemCreateRequest, MonitoringMode } from "node-opcua-types";
import { AttributeIds } from "node-opcua-basic-types";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { coerceNodeId, NodeId } from "node-opcua-nodeid";
import { DeadbandType } from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";

import { Subscription } from "../source/server_subscription";
import { ServerEngine } from "../source/server_engine";

// tslint:disable-next-line: no-var-requires
const { getFakePublishEngine } = require("./helper_fake_publish_engine");

const fake_publish_engine = getFakePublishEngine();

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("SM3 - Subscriptions and MonitoredItems limits", function (this: any) {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    let engine: ServerEngine;

    before((done: () => void) => {
   
        engine = new ServerEngine({
            applicationUri: "",
            serverCapabilities: {
                maxMonitoredItems: 10,
                maxMonitoredItemsPerSubscription: 6
            }
        });

        engine.initialize({ nodeset_filename: nodesets.standard }, () => {
            addressSpace = engine.addressSpace!;
            namespace = addressSpace.getOwnNamespace();

            function addVar(typeName: string, value: any) {
                namespace.index.should.eql(1);

                namespace.addVariable({
                    organizedBy: "RootFolder",
                    nodeId: "s=Static_" + typeName,
                    browseName: "Static_" + typeName,
                    dataType: typeName,
                    value: { dataType: DataType[typeName as any], value: value }
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
            
            done();
        });
    });
    after(async () => {
        if (engine) {
            await engine.shutdown();
            engine.dispose();
        }
    });

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

    const globalCounter = {
        totalMonitoredItemCount: 0
    };

    function makeSubscription() {
        const subscription = new Subscription({
            publishingInterval: 1000,
            maxKeepAliveCount: 20,
            publishEngine: fake_publish_engine,
            globalCounter,
            serverCapabilities: engine.serverCapabilities
        });
        subscription.on("monitoredItem", function (monitoredItem) {
            monitoredItem.samplingFunc = install_spying_samplingFunc();
        });
        return subscription;
    }
    function test_with_nodeId(subscription: Subscription, nodeId: NodeId) {
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
        const createResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
        return createResult.statusCode;
    }
    const namespaceSimulationIndex = 1;
    const nodeId = coerceNodeId("s=Static_Int16", namespaceSimulationIndex);

    it("SM3-A - it should refuse monitored Items if maxMonitoredItemsPerSubscription is reached ", () => {
        const subscription = makeSubscription();
        globalCounter.totalMonitoredItemCount.should.eql(0);
        test_with_nodeId(subscription, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription, nodeId).should.eql(StatusCodes.Good);
        globalCounter.totalMonitoredItemCount.should.eql(6);
        test_with_nodeId(subscription, nodeId).should.eql(StatusCodes.BadTooManyMonitoredItems);
        globalCounter.totalMonitoredItemCount.should.eql(6);
     
        subscription.terminate();
        subscription.dispose();

        subscription.monitoredItemCount.should.eql(0);
        globalCounter.totalMonitoredItemCount.should.eql(0);
     
    });
    it("SM3-B - it should refuse monitored Items if maxMonitoredItems is reached ", () => {
        const subscription1 = makeSubscription();
        const subscription2 = makeSubscription();

        
        test_with_nodeId(subscription1, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription1, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription1, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription1, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription1, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription1, nodeId).should.eql(StatusCodes.Good);

        globalCounter.totalMonitoredItemCount.should.eql(6);

        test_with_nodeId(subscription2, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription2, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription2, nodeId).should.eql(StatusCodes.Good);
        test_with_nodeId(subscription2, nodeId).should.eql(StatusCodes.Good);
        globalCounter.totalMonitoredItemCount.should.eql(10);
        test_with_nodeId(subscription2, nodeId).should.eql(StatusCodes.BadTooManyMonitoredItems);
        test_with_nodeId(subscription2, nodeId).should.eql(StatusCodes.BadTooManyMonitoredItems);
        globalCounter.totalMonitoredItemCount.should.eql(10);
  
        subscription1.terminate();
        subscription1.dispose();
        subscription1.monitoredItemCount.should.eql(0);
        globalCounter.totalMonitoredItemCount.should.eql(4);
  
        subscription2.terminate();
        subscription2.dispose();
        subscription2.monitoredItemCount.should.eql(0);
        globalCounter.totalMonitoredItemCount.should.eql(0);
    });
});
