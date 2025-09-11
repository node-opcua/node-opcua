import "should";
import sinon from "sinon";
import {
    OPCUAClient,
    ClientSubscription,
    AttributeIds,
    resolveNodeId,
    MonitoringParameters,
    MonitoringMode,
    ReadValueId,
    TimestampsToReturn,
    CreateMonitoredItemsRequest,
    ClientMonitoredItem,
    DataType,
    coerceNodeId,
    CreateMonitoredItemsResponse,
    PublishResponse,
    NotificationMessage,
    DataChangeNotification,
    VariableIds,
    Subscription
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { perform_operation_on_client_session } from "../../test_helpers/perform_operation_on_client_session";
import { pause, waitUntilCondition } from "../discovery/_helper";
import should from "should";

const doDebug = false;
interface TestHarness { endpointUrl: string;[k: string]: any }

/**
 * Monitoring scalability tests
 * - Legacy test #69: ensure client can create and receive data changes for a modest list of nodes.
 * - Stress test: create ~5000 monitored items via a single CreateMonitoredItems service call and verify
 *   a raw notification arrives containing monitored item results (subject to maxNotificationsPerPublish rules).
 * - Issue #1008 regression: invoke GetMonitoredItems method against the Server object.
 *
 * Converted from callback-based JavaScript to async/await TypeScript while keeping original intent/comments.
 */
export function t(test: TestHarness) {
    describe("Monitoring many nodes", () => {
        let client: OPCUAClient; let endpointUrl: string;

        beforeEach(async () => {
            if ((global as any).gc) { (global as any).gc(); }
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
            client.on("lifetime_75", () => {/* token about to expire */ });
        });

        afterEach(async () => {
            if (client) {
                await client.disconnect();
            }
            // @ts-ignore
            client = null;
        });

        it("monitors a small set of nodes (#69)", async () => {
            const changeByNodes: Record<string, number> = {};
            const ids = [
                "Scalar_Simulation_Double",
                "Scalar_Simulation_Boolean",
                "Scalar_Simulation_String",
                "Scalar_Simulation_Int64",
                "Scalar_Simulation_LocalizedText"
            ];

            const makeCallback = (nodeIdStr: string) => () => {
                changeByNodes[nodeIdStr] = (changeByNodes[nodeIdStr] || 0) + 1;
            };

            await perform_operation_on_client_session(client, endpointUrl, async (session) => {

                const subscription = await session.createSubscription2({
                    requestedPublishingInterval: 150,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 10,
                    maxNotificationsPerPublish: 20000,
                    publishingEnabled: true,
                    priority: 6
                });

                try {

                    for (const id of ids) {
                        const nodeId = "ns=2;s=" + id;
                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            { nodeId: resolveNodeId(nodeId), attributeId: AttributeIds.Value },
                            { samplingInterval: 10, discardOldest: true, queueSize: 1 }
                        );
                        monitoredItem.on("changed", makeCallback(nodeId));
                    }

                    await pause(3000);

                } finally {
                    await subscription.terminate();
                }
            });
            Object.keys(changeByNodes).length.should.eql(5);
        });

        // Base ID list reused to build up to ~5000 entries
        const baseIds = [
            "Scalar_Simulation_Double",
            "Scalar_Simulation_Float",
            "Scalar_Simulation_Boolean",
            "Scalar_Simulation_String",
            "Scalar_Simulation_Int64",
            "Scalar_Simulation_Int32",
            "Scalar_Simulation_Int16",
            "Scalar_Simulation_SByte",
            "Scalar_Simulation_UInt64",
            "Scalar_Simulation_UInt32",
            "Scalar_Simulation_UInt16",
            "Scalar_Simulation_Byte",
            "Scalar_Simulation_LocalizedText",
            "Scalar_Simulation_ByteString",
            "Scalar_Simulation_DateTime",
            "Scalar_Simulation_Duration"
        ];

        function buildIdsList(target: number): string[] {
            let list = baseIds.slice();
            while (list.length < target) list = list.concat(baseIds);
            return list.slice(0, target);
        }

        function makeItems(count: number) {
            const ids = buildIdsList(count);
            const itemsToCreate: any[] = [];
            let clientHandle = 1;
            for (const s of ids) {
                const nodeId = "ns=2;s=" + s;
                const itemToMonitor = new ReadValueId({ attributeId: AttributeIds.Value, nodeId });
                clientHandle++;
                const monitoringParameters = new MonitoringParameters({
                    clientHandle,
                    samplingInterval: 100,
                    filter: null,
                    queueSize: 1,
                    discardOldest: true
                });
                itemsToCreate.push({
                    itemToMonitor,
                    monitoringMode: MonitoringMode.Reporting,
                    requestedParameters: monitoringParameters
                });
            }
            return itemsToCreate;
        }

        it("monitors a very large number of nodes (~5000)", async () => {


            await perform_operation_on_client_session(client, endpointUrl, async (session) => {

                const maxThatServerCanDo = Subscription.maxNotificationPerPublishHighLimit;



                const subscription = await session.createSubscription2({
                    requestedPublishingInterval: 10,
                    requestedLifetimeCount: 10 * 60 * 10,
                    requestedMaxKeepAliveCount: 3,
                    maxNotificationsPerPublish: 0, // unlimited requested : may be not honnored by server
                    publishingEnabled: true,
                    priority: 6
                });

                const notificationMessageSpy = sinon.spy();
                subscription.on("received_notifications", notificationMessageSpy);

                try {

                    const itemsToCreate = makeItems(5000 + baseIds.length); // mimic original expansion logic

                    const request = new CreateMonitoredItemsRequest({
                        subscriptionId: subscription.subscriptionId,
                        timestampsToReturn: TimestampsToReturn.Neither,
                        itemsToCreate
                    });

                    const rawNotifSpy = sinon.spy();
                    subscription.on("raw_notification", rawNotifSpy);
                    const keepAlive = sinon.spy();
                    subscription.on("keepalive", keepAlive);


                    const createMonitoredItemResponse: CreateMonitoredItemsResponse = await (session as any).createMonitoredItems(request)
                    doDebug && console.log(createMonitoredItemResponse.toString());

                    // wait for a raw notification to be received
                    await waitUntilCondition(async () => notificationMessageSpy.callCount > + 1, 5000, "expecting some raw notification");
                    keepAlive.resetHistory();
                    await waitUntilCondition(async () => keepAlive.callCount >= 1, 5000, "expecting a keepalive notification");


                    // find the first raw notification that as notification.length > 0 inside the notificationMessageSpy calls
                    const rawNotifs = notificationMessageSpy.getCalls()
                        .map((call) => call.args[0] as NotificationMessage)
                        .filter((n) => n.notificationData!.length > 0);

                    const totalItemsCreated = rawNotifs.reduce((acc, n) => {

                        const dataChangeNotification = n.notificationData![0] as DataChangeNotification;
                        return acc + dataChangeNotification!.monitoredItems!.length;
                    }, 0);

                    rawNotifs.length.should.be.greaterThan(0, "expecting at least one notification with some data");
                    totalItemsCreated.should.be.greaterThan(maxThatServerCanDo, "expecting at least one notification with some data");
                    totalItemsCreated.should.eql(itemsToCreate.length, "expecting to receive data for all monitored items");


                } finally {
                    await subscription.terminate();
                }
            });
        });

        it("invokes GetMonitoredItems (issue #1008)", async () => {
            const parameters = {
                requestedPublishingInterval: 100,
                requestedLifetimeCount: 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 6000,
                publishingEnabled: true,
                priority: 10
            };
            await client.withSubscriptionAsync(endpointUrl, parameters, async (session, subscription) => {
                // Delay to allow subscription to settle
                await new Promise((r) => setTimeout(r, 1000));
                const objectId = coerceNodeId("ns=0;i=2253"); // Server
                const methodId = coerceNodeId("ns=0;i=11492"); // GetMonitoredItems
                const inputArguments = [{ dataType: DataType.UInt32, value: subscription.subscriptionId }];
                const methodToCall = { objectId, methodId, inputArguments };
                const result = await session.call(methodToCall);
                result.statusCode.name.should.eql("Good");
            });
        });
    });
}
