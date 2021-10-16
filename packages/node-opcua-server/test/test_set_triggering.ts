/* eslint-disable max-statements */
import "should";
import * as sinon from "sinon";

import {
    MonitoringMode,
    MonitoredItemCreateRequest,
    DataChangeFilter,
    DataChangeTrigger,
    DeadbandType,
    PublishRequest,
    PublishResponse,
    DataChangeNotification
} from "node-opcua-service-subscription";
import { StatusCodes } from "node-opcua-status-code";
import { TimestampsToReturn } from "node-opcua-service-read";

import { DataType, VariantArrayType, Variant } from "node-opcua-variant";
import { DataValue } from "node-opcua-data-value";
import { AttributeIds } from "node-opcua-data-model";
import { NodeId, coerceNodeId } from "node-opcua-nodeid";
import { AddressSpace, Namespace, SessionContext, UAVariable } from "node-opcua-address-space";
import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";

import { MonitoredItem, Subscription, ServerEngine, ServerSidePublishEngine, SubscriptionState } from "..";

// tslint:disable-next-line: no-var-requires
const { getFakePublishEngine } = require("./helper_fake_publish_engine");
const mini_nodeset_filename = get_mini_nodeset_filename();

const doDebug = false;
const now = new Date().getTime();

const fake_publish_engine = getFakePublishEngine();
let dataSourceFrozen = false;

function freeze_data_source() {
    dataSourceFrozen = true;
}

function unfreeze_data_source() {
    dataSourceFrozen = false;
}
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Subscriptions and MonitoredItems and triggering", function (this: any) {
    /***
     * 5.12.1.6 Triggering model ToC
     * The MonitoredItems Service allows the addition of items that are reported only when some other item
     * (the triggering item) triggers. This is done by creating links between the triggered items and the
     * items to report. The monitoring mode of the items to report is set to sampling-only so that it will
     * sample and queue Notifications without reporting them. Figure 18 illustrates this concept.
     *
     * The triggering mechanism is a useful feature that allows Clients to reduce the data volume on the
     * wire by configuring some items to sample frequently but only report when some other Event happens
     * The following triggering behaviors are specified.
     * If the monitoring mode of the triggering item is SAMPLING,
     *    then it is not reported when the triggering item triggers the items to report.
     * If the monitoring mode of the triggering item is REPORTING,
     *    then it is reported when the triggering item triggers the items to report.
     * If the monitoring mode of the triggering item is DISABLED,
     *    then the triggering item does not trigger the items to report.
     * If the monitoring mode of the item to report is SAMPLING,
     *    then it is reported when the triggering item triggers the items to report.
     * If the monitoring mode of the item to report is REPORTING,
     *    this effectively causes the triggering item to be ignored. All notifications of the items to report
     *    are sent after the publishing interval expires.
     * If the monitoring mode of the item to report is DISABLED,
     *    then there will be no sampling of the item to report and therefore no notifications to report.
     *
     * The first trigger shall occur when the first notification is queued for the triggering item after the
     * creation of the link. Clients create and delete triggering links between a triggering item and a set
     * of items to report. If the MonitoredItem that represents an item to report is deleted before its
     * associated triggering link is deleted, the triggering link is also deleted, but the triggering
     * item is otherwise unaffected.
     *
     * Deletion of a MonitoredItem should not be confused with the removal of the Attribute that it monitors.
     * If the Node that contains the Attribute being monitored is deleted, the MonitoredItem generates a
     * Notification with a StatusCode Bad_NodeIdUnknown that indicates the deletion, but the MonitoredItem is not deleted.
     */
    this.timeout(Math.max(300000, this._timeout));

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let engine: ServerEngine;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const test = this;

    before(async () => {
        engine = new ServerEngine({ applicationUri: "uri" });

        await new Promise<void>((resolve) => {
            engine.initialize({ nodeset_filename: mini_nodeset_filename }, () => {
                resolve();
            });
        });
        addressSpace = engine.addressSpace!;
        namespace = addressSpace.getOwnNamespace();

        function addVar(varName: string, value: number) {
            namespace.addVariable({
                organizedBy: "RootFolder",

                nodeId: "s=Static_" + varName,

                browseName: "Static_" + varName,
                dataType: "UInt32",
                value: { dataType: DataType.UInt32, value }
            });
        }
        addVar("V1", 1);
        addVar("V2", 1);
        addVar("V3", 1);
        addVar("V4", 1);
        addVar("V5", 1);
    });
    const namespaceSimulationIndex = 1;
    const nodeIdV1 = coerceNodeId("s=Static_V1", namespaceSimulationIndex);
    const nodeIdV2 = coerceNodeId("s=Static_V2", namespaceSimulationIndex);
    const nodeIdV3 = coerceNodeId("s=Static_V3", namespaceSimulationIndex);
    const nodeIdV4 = coerceNodeId("s=Static_V4", namespaceSimulationIndex);
    const nodeIdV5 = coerceNodeId("s=Static_V5", namespaceSimulationIndex);
    after(async () => {
        if (engine) {
            await engine.shutdown();
            engine.dispose();
        }
    });

    beforeEach(() => {
        test.clock = sinon.useFakeTimers(now);
    });

    function multipleIncrement(nodeIds: NodeId[]) {
        nodeIds.map((nodeId: NodeId) => {
            const variable = addressSpace.findNode(nodeId) as UAVariable;
            const dataValue = variable.readValue();
            variable.setValueFromSource({ dataType: DataType.UInt32, value: dataValue.value.value + 1 });
        });
    }
    function install_spying_samplingFunc(nodeId: NodeId) {
        const spy_samplingEventCall = sinon.spy((oldValue, callback) => {
            const variable = addressSpace.findNode(nodeId) as UAVariable;
            const dataValue = variable.readValue();
            callback(null, dataValue);
        });
        return spy_samplingEventCall;
    }

    let subscription: Subscription;
    let serverSidePublishEngine: ServerSidePublishEngine;
    let send_response_for_request_spy: sinon.SinonSpy;
    beforeEach(() => {
        serverSidePublishEngine = new ServerSidePublishEngine({});
        send_response_for_request_spy = sinon.spy(serverSidePublishEngine, "_send_response_for_request");

        subscription = new Subscription({
            id: 1234,
            publishingInterval: 100,

            maxKeepAliveCount: 20,

            lifeTimeCount: 1000,

            publishEngine: serverSidePublishEngine
        });
        serverSidePublishEngine.add_subscription(subscription);
        subscription.state.should.equal(SubscriptionState.CREATING);
        send_response_for_request_spy.callCount.should.equal(0);

        multipleIncrement([nodeIdV1, nodeIdV2, nodeIdV3, nodeIdV4]);
        subscription.on("monitoredItem", (monitoredItem) => {
            monitoredItem.samplingFunc = install_spying_samplingFunc(monitoredItem.node.nodeId);
        });
    });
    afterEach(() => {
        subscription.terminate();
        subscription.dispose();
        serverSidePublishEngine.shutdown();
        serverSidePublishEngine.dispose();
    });

    afterEach(() => {
        test.clock.restore();
    });

    function installMonitoredItem(nodeId: NodeId, clientHandle: number, monitoringMode: MonitoringMode) {
        const monitoredItemCreateRequest = new MonitoredItemCreateRequest({
            itemToMonitor: {
                nodeId,

                attributeId: AttributeIds.Value
            },
            monitoringMode,
            requestedParameters: {
                clientHandle,
                discardOldest: true,
                queueSize: 1,
                samplingInterval: 100,

                filter: null
            }
        });
        const createResult = subscription.createMonitoredItem(addressSpace, TimestampsToReturn.Both, monitoredItemCreateRequest);
        return createResult;
    }

    const invalidMonitoredItemId = 0xdeadbeef;

    function waitInitialNotification() {
        send_response_for_request_spy.resetHistory();
        const fakeRequest0 = new PublishRequest({ subscriptionAcknowledgements: [] });
        serverSidePublishEngine._on_PublishRequest(fakeRequest0);
        test.clock.tick(100);

        if (doDebug) {
            // tslint:disable-next-line: no-console
            console.log(send_response_for_request_spy.callCount);
            // tslint:disable-next-line: no-console
            console.log(send_response_for_request_spy.getCall(0).args[1].toString());
        }
        while (send_response_for_request_spy.callCount === 0) {
            test.clock.tick(100);
        }
        send_response_for_request_spy.callCount.should.eql(1);
        const publishResponse = send_response_for_request_spy.getCall(0).args[1] as PublishResponse;
        return publishResponse;
    }
    function waitNextNotification() {
        send_response_for_request_spy.resetHistory();
        test.clock.tick(100);
        const fakeRequest1 = new PublishRequest({ subscriptionAcknowledgements: [] });
        serverSidePublishEngine._on_PublishRequest(fakeRequest1);

        while (send_response_for_request_spy.callCount === 0) {
            test.clock.tick(100);
        }
        if (doDebug) {
            // tslint:disable-next-line: no-console
            console.log(send_response_for_request_spy.callCount);
            // tslint:disable-next-line: no-console
            console.log(send_response_for_request_spy.getCall(0).args[1].toString());
        }
        send_response_for_request_spy.callCount.should.eql(1);
        const publishResponse = send_response_for_request_spy.getCall(0).args[1] as PublishResponse;
        return publishResponse;
    }

    it("STG-1 should return BadNothingToDo if linksToAdd and linksToRemove are empty", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const result = subscription.setTriggering(createResult1.monitoredItemId, [], []);
        result.statusCode.should.eql(StatusCodes.BadNothingToDo);
    });

    it("STG-2 should return BadMonitoredItemIdInvalid if triggeringItem is not found", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Reporting);

        const result = subscription.setTriggering(invalidMonitoredItemId, [createResult1.monitoredItemId], []);
        result.statusCode.should.eql(StatusCodes.BadMonitoredItemIdInvalid);
    });

    it("STG-3 should return Good if triggeringItem is found and all other monitoredItem are found - add", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Reporting);
        const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Reporting);

        const result = subscription.setTriggering(
            createResult1.monitoredItemId,
            [createResult2.monitoredItemId, createResult3.monitoredItemId],
            []
        );
        result.statusCode.should.eql(StatusCodes.Good);
        result.addResults.should.eql([StatusCodes.Good, StatusCodes.Good]);
        result.removeResults.should.eql([]);
    });

    it("STG-4 should return Good if triggeringItem is found and all other monitoredItem are found - remove", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Reporting);
        const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Reporting);

        const result0 = subscription.setTriggering(
            createResult1.monitoredItemId,
            [createResult2.monitoredItemId, createResult3.monitoredItemId],
            []
        );
        const result1 = subscription.setTriggering(
            createResult1.monitoredItemId,
            [],
            [createResult2.monitoredItemId, createResult3.monitoredItemId]
        );
        result1.statusCode.should.eql(StatusCodes.Good);
        result1.removeResults.should.eql([StatusCodes.Good, StatusCodes.Good]);
        result1.addResults.should.eql([]);
    });

    it("STG-5 If the monitoring mode of the triggering item is SAMPLING,  then it is not reported when the triggering item triggers the items to report.", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Sampling);
        const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Sampling);
        const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Sampling);

        const result = subscription.setTriggering(
            createResult1.monitoredItemId,
            [createResult2.monitoredItemId, createResult3.monitoredItemId],
            []
        );
        result.statusCode.should.eql(StatusCodes.Good);
        result.addResults.should.eql([StatusCodes.Good, StatusCodes.Good]);
        result.removeResults.should.eql([]);
    });

    it("STG-6 If the monitoring mode of the triggering item is REPORTING, then it is reported when the triggering item triggers the items to report.", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Sampling);
        const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Sampling);

        multipleIncrement([nodeIdV1, nodeIdV2, nodeIdV3]);
        test.clock.tick(100);
        // wait initial notification on itm 1
        const publishedResponse0 = waitInitialNotification();
        {
            publishedResponse0.notificationMessage.notificationData!.length.should.eql(1);
            const notifs0 = (publishedResponse0.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems!;
            notifs0.length.should.eql(1);
        }

        const result = subscription.setTriggering(
            createResult1.monitoredItemId,
            [createResult2.monitoredItemId, createResult3.monitoredItemId],
            []
        );
        result.statusCode.should.eql(StatusCodes.Good);
        result.addResults.should.eql([StatusCodes.Good, StatusCodes.Good]);
        result.removeResults.should.eql([]);

        multipleIncrement([nodeIdV1, nodeIdV2, nodeIdV3]);
        test.clock.tick(100);

        const publishResponse = waitNextNotification();

        publishResponse.notificationMessage.notificationData!.length.should.eql(1);
        const notifs = (publishResponse.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems!;

        // console.log(publishResponse.notificationMessage.toString());

        notifs.length.should.eql(3);
        notifs[0].clientHandle.should.eql(1);
        notifs[1].clientHandle.should.eql(2);
        notifs[2].clientHandle.should.eql(3);

        // ----------------------------- REMOVE ONE LINKED ITEM
        const result1 = subscription.setTriggering(createResult1.monitoredItemId, [], [createResult2.monitoredItemId]);
        result1.statusCode.should.eql(StatusCodes.Good);
        result1.removeResults.should.eql([StatusCodes.Good]);
        result1.addResults.should.eql([]);

        multipleIncrement([nodeIdV1, nodeIdV2, nodeIdV3]);
        test.clock.tick(100);

        const publishResponse1 = waitNextNotification();

        publishResponse1.notificationMessage.notificationData!.length.should.eql(1);
        const notifs1 = (publishResponse1.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems!;
        notifs1.length.should.eql(2);
        notifs1[0].clientHandle.should.eql(1);
        notifs1[1].clientHandle.should.eql(3);
    });

    it("STG-7 If the monitoring mode of the triggering item is DISABLED, then the triggering item does not trigger the items to report.", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Disabled);
        const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Sampling);
        const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Sampling);
        const publishedResponse0 = waitInitialNotification();
        {
            publishedResponse0.notificationMessage.notificationData!.length.should.eql(0);
        }

        const result = subscription.setTriggering(
            createResult1.monitoredItemId,
            [createResult2.monitoredItemId, createResult3.monitoredItemId],
            []
        );
        result.statusCode.should.eql(StatusCodes.Good);
        result.addResults.should.eql([StatusCodes.Good, StatusCodes.Good]);
        result.removeResults.should.eql([]);

        multipleIncrement([nodeIdV1, nodeIdV2, nodeIdV3]);
        test.clock.tick(100);
        const publishResponse = waitNextNotification();
        publishResponse.notificationMessage.notificationData!.length.should.eql(0);
    });

    it("STG-8 If the monitoring mode of the item to report is SAMPLING, then it is reported when the triggering item triggers the items to report.", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Sampling);
        const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Sampling);

        const publishedResponse0 = waitInitialNotification();
        {
            publishedResponse0.notificationMessage.notificationData!.length.should.eql(1);
            const notifs0 = (publishedResponse0.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems!;
            notifs0.length.should.eql(1);
        }

        const result = subscription.setTriggering(
            createResult1.monitoredItemId,
            [createResult2.monitoredItemId, createResult3.monitoredItemId],
            []
        );
        result.statusCode.should.eql(StatusCodes.Good);
        result.addResults.should.eql([StatusCodes.Good, StatusCodes.Good]);
        result.removeResults.should.eql([]);

        multipleIncrement([nodeIdV1, nodeIdV2, nodeIdV3]);
        test.clock.tick(100);
        const publishResponse = waitNextNotification();

        publishResponse.notificationMessage.notificationData!.length.should.eql(1);
        const notifs = (publishResponse.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems!;
        notifs.length.should.eql(3);
        notifs[0].clientHandle.should.eql(1);
        notifs[1].clientHandle.should.eql(2);
        notifs[2].clientHandle.should.eql(3);
    });

    it(
        "STG-9 If the monitoring mode of the item to report is REPORTING, this effectively causes the triggering item to be" +
            "ignored. All notifications of the items to report are sent after the publishing interval expires.",
        () => {
            const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Sampling);
            const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Reporting);
            const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Reporting);

            multipleIncrement([nodeIdV1, nodeIdV2, nodeIdV3]);
            test.clock.tick(100);
            const publishedResponse0 = waitInitialNotification();
            {
                publishedResponse0.notificationMessage.notificationData!.length.should.eql(1);
                const notifs0 = (publishedResponse0.notificationMessage.notificationData![0] as DataChangeNotification)
                    .monitoredItems!;
                notifs0.length.should.eql(2);
                notifs0[0].clientHandle.should.eql(2);
                notifs0[1].clientHandle.should.eql(3);
            }

            const result = subscription.setTriggering(
                createResult1.monitoredItemId,
                [createResult2.monitoredItemId, createResult3.monitoredItemId],
                []
            );
            result.statusCode.should.eql(StatusCodes.Good);
            result.addResults.should.eql([StatusCodes.Good, StatusCodes.Good]);
            result.removeResults.should.eql([]);

            multipleIncrement([nodeIdV1, nodeIdV2, nodeIdV3]);
            test.clock.tick(100);
            const publishResponse = waitNextNotification();

            publishResponse.notificationMessage.notificationData!.length.should.eql(1);
            const notifs = (publishResponse.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems!;
            notifs.length.should.eql(2);
            notifs[0].clientHandle.should.eql(2);
            notifs[1].clientHandle.should.eql(3);
        }
    );

    it(
        "STG-10 If the monitoring mode of the item to report is DISABLED," +
            " then there will be no sampling of the item to report and therefore no notifications to report.",
        () => {
            const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
            const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Disabled);
            const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Disabled);
            const publishedResponse0 = waitInitialNotification();
            {
                publishedResponse0.notificationMessage.notificationData!.length.should.eql(1);
                const notifs0 = (publishedResponse0.notificationMessage.notificationData![0] as DataChangeNotification)
                    .monitoredItems!;
                notifs0.length.should.eql(1);
            }

            const result = subscription.setTriggering(
                createResult1.monitoredItemId,
                [createResult2.monitoredItemId, createResult3.monitoredItemId],
                []
            );
            result.statusCode.should.eql(StatusCodes.Good);
            result.addResults.should.eql([StatusCodes.Good, StatusCodes.Good]);
            result.removeResults.should.eql([]);

            multipleIncrement([nodeIdV1, nodeIdV2, nodeIdV3]);
            test.clock.tick(100);
            const publishResponse = waitNextNotification();

            publishResponse.notificationMessage.notificationData!.length.should.eql(1);
            const notifs = (publishResponse.notificationMessage.notificationData![0] as DataChangeNotification).monitoredItems!;
            notifs.length.should.eql(1);
            notifs[0].clientHandle.should.eql(1);
        }
    );

    it("STG-11 SetTriggering: Remove the same link twice.", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Reporting);
        const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Reporting);

        const result0 = subscription.setTriggering(
            createResult1.monitoredItemId,
            [createResult2.monitoredItemId, createResult3.monitoredItemId],
            []
        );
        const result1 = subscription.setTriggering(createResult1.monitoredItemId, [], [createResult3.monitoredItemId]);
        result1.statusCode.should.eql(StatusCodes.Good);
        result1.removeResults.should.eql([StatusCodes.Good]);
        result1.addResults.should.eql([]);

        const result2 = subscription.setTriggering(createResult1.monitoredItemId, [], [createResult3.monitoredItemId]);
        result2.statusCode.should.eql(StatusCodes.Good);
        result2.removeResults.should.eql([StatusCodes.BadMonitoredItemIdInvalid]);
        result2.addResults.should.eql([]);
    });
    it("STG-12 SetTriggering: LinksToAdd and LinksToRemove are both empty.", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);

        const result0 = subscription.setTriggering(createResult1.monitoredItemId, [], []);
        result0.statusCode.should.eql(StatusCodes.BadNothingToDo);
    });
    it("STG-13 SetTriggering: Specify the same item in both linksToAdd and linksToRemove.", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const createResult2 = installMonitoredItem(nodeIdV2, 2, MonitoringMode.Reporting);
        const createResult3 = installMonitoredItem(nodeIdV3, 3, MonitoringMode.Reporting);

        const result1 = subscription.setTriggering(
            createResult1.monitoredItemId,
            [createResult2.monitoredItemId, createResult3.monitoredItemId],
            [createResult2.monitoredItemId, createResult3.monitoredItemId]
        );
        result1.statusCode.should.eql(StatusCodes.Good);
        result1.addResults.should.eql([StatusCodes.Good, StatusCodes.Good]);
        result1.removeResults.should.eql([StatusCodes.BadMonitoredItemIdInvalid, StatusCodes.BadMonitoredItemIdInvalid]);
    });

    it("STG-14 triggeringItem and linked items cannot be the same - add", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const result1 = subscription.setTriggering(createResult1.monitoredItemId, [createResult1.monitoredItemId], []);
        result1.statusCode.should.eql(StatusCodes.Good);
        result1.addResults.should.eql([StatusCodes.BadMonitoredItemIdInvalid]);
        result1.removeResults.should.eql([]);
    });
    it("STG-15 triggeringItem and linked items cannot be the same - remove", () => {
        const createResult1 = installMonitoredItem(nodeIdV1, 1, MonitoringMode.Reporting);
        const result1 = subscription.setTriggering(createResult1.monitoredItemId, [], [createResult1.monitoredItemId]);
        result1.statusCode.should.eql(StatusCodes.Good);
        result1.addResults.should.eql([]);
        result1.removeResults.should.eql([StatusCodes.BadMonitoredItemIdInvalid]);
    });
});
