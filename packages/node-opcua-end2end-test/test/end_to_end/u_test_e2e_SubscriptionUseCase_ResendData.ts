/* eslint-disable max-statements */
import "should";
import { DataType, AttributeIds, OPCUAClient, StatusCodes, OPCUAServer, UAVariable, MonitoringMode, TimestampsToReturn, NotificationMessage, DataChangeNotification, MethodIds, ObjectIds, DataValue, VariableIds } from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// eslint-disable-next-line import/order
import { describeWithLeakDetector as describe} from "node-opcua-leak-detector";

export function t(test: any) {

    describe("Server#ResendData(subscription)", function () {

        let server: OPCUAServer;
        let client: OPCUAClient;
        let uaVar1: UAVariable;
        let uaVar2: UAVariable;
        let uaVar3: UAVariable;
        let endpointUrl: string;

        before(() => {
            server = test.server;

            endpointUrl = test.endpointUrl;


            const namespace = server.engine.addressSpace!.getOwnNamespace();

            const rootFolder = server.engine.addressSpace!.rootFolder;
            const objectsFolder = rootFolder.objects;

            function addVariable(browseName: string, value: number): UAVariable {
                // Variable with dataItem capable of sending data change notification events
                // this type of variable can be continuously monitored.
                const n1 = namespace.addVariable({
                    organizedBy: objectsFolder,
                    browseName,
                    nodeId: `s=${browseName}`,
                    dataType: "Double",
                    value: {
                        dataType: DataType.Double,
                        value: 0.0
                    }
                });
                n1.minimumSamplingInterval.should.eql(0);

                let changeDetected = 0;
                n1.on("value_changed", function (dataValue) {
                    changeDetected += 1;
                });

                n1.setValueFromSource({ dataType: DataType.Double, value: value }, StatusCodes.Good);
                changeDetected.should.equal(1);
                return n1;
            }
            uaVar1 = addVariable("V1", 100);
            uaVar2 = addVariable("V2", 200);
            uaVar3 = addVariable("V3", 300);
        });

        beforeEach(() => {
            client = OPCUAClient.create({
                keepSessionAlive: true,
                requestedSessionTimeout: 4 * 60 * 1000 // 4 min ! make sure that session doesn't drop during test
            });
        });

        afterEach(() => {
            /** */
        });

        const sleep = async (n: number) => new Promise((resolve) => setTimeout(resolve, n));

        const publishingInterval = 3000;
        const samplingInterval = 500;

        it("with Subscription#resend - Server_ResendData", async () => {

            await client.withSubscriptionAsync(endpointUrl, {
                priority: 1,
                publishingEnabled: true,
                maxNotificationsPerPublish: 1000,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 50,
                requestedPublishingInterval: publishingInterval,
            }, async (session, subscription) => {
                /** */
                let messages: NotificationMessage[] = [];
                subscription.on("received_notifications", (notificationMessage) => {
                    debugLog(notificationMessage.toString());
                    messages.push(notificationMessage);
                });


                const m1 = await subscription.monitor({
                    nodeId: uaVar1.nodeId,
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval,
                    queueSize: 100,

                }, TimestampsToReturn.Both, MonitoringMode.Disabled);

                const m2 = await subscription.monitor({
                    nodeId: uaVar2.nodeId,
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval,
                    queueSize: 100,

                }, TimestampsToReturn.Both, MonitoringMode.Sampling);

                const m3 = await subscription.monitor({
                    nodeId: uaVar3.nodeId,
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval,
                    queueSize: 100,

                }, TimestampsToReturn.Both, MonitoringMode.Reporting);

                await sleep(publishingInterval * 2);

                let referenceValue: DataValue;
                {
                    messages.length.should.eql(1);
                    messages[0].notificationData!.length.should.eql(1);
                    const n = messages[0].notificationData![0] as DataChangeNotification;
                    n.monitoredItems!.length.should.eql(1);
                    n.monitoredItems![0].clientHandle.should.eql(3);
                    n.monitoredItems![0].value.value.value.should.eql(300);
                    referenceValue = n.monitoredItems![0].value;
                }
                messages = [];
                await sleep(publishingInterval * 2);

                console.log("calling resendData");
                await session.call({
                    methodId: MethodIds.Server_ResendData,
                    objectId: ObjectIds.Server,
                    inputArguments: [
                        { dataType: DataType.UInt32, value: subscription.subscriptionId }
                    ]
                });
                await sleep(publishingInterval * 2);

                {
                    messages.length.should.eql(1);
                    messages[0].notificationData!.length.should.eql(1);
                    const n = messages[0].notificationData![0] as DataChangeNotification;
                    n.monitoredItems!.length.should.eql(1);
                    n.monitoredItems![0].clientHandle.should.eql(3);
                    n.monitoredItems![0].value.value.value.should.eql(300);

                    const newDataValue = n.monitoredItems![0].value;

                    referenceValue.toString().should.eql(newDataValue.toString());
                }

                console.log("now item2 goes reporting");
                messages = [];
                await m2.setMonitoringMode(MonitoringMode.Reporting);
                await sleep(publishingInterval * 3);

                // Note: not clear what should be the behavior here ?
                // My understanding: we should have 2 elements related to item 2
                // => causes: initial value, resend
                // => also due to queueSize was large enough
                {
                    messages.length.should.eql(1);
                    messages[0].notificationData!.length.should.eql(1);
                    const n0 = messages[0].notificationData![0] as DataChangeNotification;
                    n0.monitoredItems!.length.should.eql(2);
                    n0.monitoredItems![0].clientHandle.should.eql(2);
                    n0.monitoredItems![0].value.value.value.should.eql(200);

                    n0.monitoredItems![1].clientHandle.should.eql(2);
                    n0.monitoredItems![1].value.value.value.should.eql(200);
                    n0.monitoredItems![1].value.toString().should.eql(n0.monitoredItems![0].value.toString());

                    // n0.monitoredItems![2].clientHandle.should.eql(2);
                    // n0.monitoredItems![2].value.value.value.should.eql(200);
                    // n0.monitoredItems![2].value.toString().should.eql(n0.monitoredItems![0].value.toString());
                }
            });
        });
        it("with Subscription#resend - Server_ResendData CurrentTime", async () => {

            await client.withSubscriptionAsync(endpointUrl, {
                priority: 1,
                publishingEnabled: true,
                maxNotificationsPerPublish: 1000,
                requestedLifetimeCount: 1000,
                requestedMaxKeepAliveCount: 50,
                requestedPublishingInterval: publishingInterval,
            }, async (session, subscription) => {
                /** */

                let messages: NotificationMessage[] = [];
                subscription.on("received_notifications", (notificationMessage) => {
                    debugLog(notificationMessage.toString());
                    messages.push(notificationMessage);
                });

                const m1 = await subscription.monitor({
                    nodeId: VariableIds.Server_ServerStatus_CurrentTime,
                    attributeId: AttributeIds.Value
                }, {
                    samplingInterval: publishingInterval * 10,
                    queueSize: 0,

                }, TimestampsToReturn.Server, MonitoringMode.Reporting);

                await sleep(publishingInterval + 10);

                let ref;
                {
                    messages.length.should.eql(1);
                    messages[0].notificationData!.length.should.eql(1);
                    const n0 = messages[0].notificationData![0] as DataChangeNotification;
                    n0.monitoredItems!.length.should.eql(1);
                    n0.monitoredItems![0].clientHandle.should.eql(1);
                    ref = n0.monitoredItems![0].value;
                }
                messages = [];

                console.log("calling resendData");
                await session.call({
                    methodId: MethodIds.Server_ResendData,
                    objectId: ObjectIds.Server,
                    inputArguments: [
                        { dataType: DataType.UInt32, value: subscription.subscriptionId }
                    ]
                });
                await session.call({
                    methodId: MethodIds.Server_ResendData,
                    objectId: ObjectIds.Server,
                    inputArguments: [
                        { dataType: DataType.UInt32, value: subscription.subscriptionId }
                    ]
                });
                await sleep(publishingInterval * 2);

                console.log("now item2 goes reporting");
                {
                    messages.length.should.eql(1);
                    messages[0].notificationData!.length.should.eql(1);
                    const n0 = messages[0].notificationData![0] as DataChangeNotification;
                    n0.monitoredItems!.length.should.eql(2);
                    n0.monitoredItems![0].clientHandle.should.eql(1);
                    n0.monitoredItems![0].value.toString().should.eql(ref.toString());

                    n0.monitoredItems![1].clientHandle.should.eql(1);
                    n0.monitoredItems![1].value.toString().should.eql(ref.toString());

                    // messages[1].notificationData!.length.should.eql(1);
                    // const n1 = messages[1].notificationData![0] as DataChangeNotification;
                    // n1.monitoredItems!.length.should.eql(1);
                    // n1.monitoredItems![0].clientHandle.should.eql(1);
                    // n1.monitoredItems![0].value.toString().should.eql(ref.toString());

                }
                messages = [];
            });
        });
    });
};
