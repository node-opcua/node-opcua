// tslint:disable: no-shadowed-variable
// tslint:disable: no-console
import {
    AddressSpace,
    assert,
    AttributeIds,
    ClientMonitoredItem,
    ClientSession,
    ClientSessionRawSubscriptionService,
    ClientSidePublishEngine,
    ClientSubscription,
    DataChangeFilter,
    DataChangeNotification,
    DataChangeTrigger,
    DataType,
    DataValue,
    DeadbandType,
    ExtensionObject,
    getCurrentClock,
    makeBrowsePath,
    MonitoredItem,
    MonitoredItemNotification,
    MonitoringMode,
    MonitoringParametersOptions,
    Namespace,
    NodeIdLike,
    NotificationMessage,
    OPCUAClient,
    Range,
    ServerSidePublishEngine,
    SetTriggeringRequestOptions,
    StatusCode,
    StatusCodes,
    TimestampsToReturn,
    UAVariable
} from "node-opcua";
import * as sinon from "sinon";
import * as should from "should";

import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

async function pause(delay: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delay));
}

interface ClientSidePublishEnginePrivate extends ClientSidePublishEngine {
    internalSendPublishRequest(): void;
    suspend(suspend: boolean): void;
}
function getInternalPublishEngine(session: ClientSession): ClientSidePublishEnginePrivate {
    const s: ClientSidePublishEnginePrivate = (session as any).getPublishEngine();
    return s;
}
export function t(test: any) {
    const options = {};

    async function createSession() {
        const client = OPCUAClient.create(options);
        const endpointUrl = test.endpointUrl;
        await client.connect(endpointUrl);
        const session = await client.createSession();

        const publishEngine = getInternalPublishEngine(session);
        publishEngine.timeoutHint = 100000000; // for debugging with ease !
        // make sure we control how PublishRequest are send
        publishEngine.suspend(true);

        // create a subscriptions
        const subscription = ClientSubscription.create(session, {
            publishingEnabled: true,
            requestedLifetimeCount: 20,
            requestedMaxKeepAliveCount: 3,
            requestedPublishingInterval: 100
        });

        return { client, session, subscription, publishEngine };
    }
    interface Connection {
        client: OPCUAClient;
        session: ClientSession;
        subscription: ClientSubscription;
        publishEngine: ClientSidePublishEnginePrivate;
    }
    let s: Connection;
    async function waitForRawNotifications(): Promise<ExtensionObject[]> {
        const { publishEngine, subscription } = s;
        publishEngine.internalSendPublishRequest();
        return await new Promise((resolve: (result: ExtensionObject[]) => void) => {
            // wait for fist notification
            subscription.once("raw_notification", (notificationMessage: any) => {
                // tslint:disable-next-line: no-console
                debugLog("got notification message ", notificationMessage.toString());
                resolve(notificationMessage.notificationData);
            });
        });
    }
    async function waitForNotificationsValues(): Promise<{ value: number; statusCode: StatusCode }[]> {
        while (true) {
            const notificationData1 = await waitForRawNotifications();
            if (notificationData1.length > 0) {
                const dcn = notificationData1[0] as DataChangeNotification;
                const r = dcn.monitoredItems!.map((item: MonitoredItemNotification) => ({
                    statusCode: item.value.statusCode,
                    value: item.value.value.value
                }));
                return r;
            }
            // tslint:disable-next-line: no-console
            debugLog(" ------- skipping empty publish response");
            return [];
        }
    }
    async function incrementValue(nodeId: NodeIdLike) {
        const { session } = s;
        const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });

        dataValue.value.value += 1;

        {
            const statusCode = await session.write({
                attributeId: AttributeIds.Value,
                nodeId,
                value: dataValue
            });
            statusCode.should.eql(StatusCodes.Good);
        }
    }
    async function waitUntilKeepAlive(publishEngine: ClientSidePublishEngine, subscription: ClientSubscription) {
        publishEngine.internalSendPublishRequest();
        publishEngine.internalSendPublishRequest();
        publishEngine.internalSendPublishRequest();
        // wait until next keep alive
        await new Promise<void>((resolve) => {
            subscription.once("keepalive", () => resolve());
        });
    }

    const valueTriggeringNodeId = "ns=1;s=ValueTriggering";
    const linkedValue1NodeId = "ns=1;s=LinkedValue1";
    const linkedValue2NodeId = "ns=1;s=LinkedValue2";

    const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
    describe("SetTriggering", function (this: any) {
        this.timeout(Math.max(200000, this.timeout()));

        before(() => {
            const addressSpace = test.server.engine.addressSpace as AddressSpace;
            const namespace = test.server.engine.addressSpace.getOwnNamespace() as Namespace;

            const n = namespace.addAnalogDataItem({
                browseName: "ValueTriggering",
                componentOf: addressSpace.rootFolder.objects.server,
                dataType: "Double",
                engineeringUnitsRange: { low: -100, high: 200 },
                nodeId: "s=ValueTriggering"
            });
            valueTriggeringNodeId.should.eql(n.nodeId.toString());

            const n2 = namespace.addVariable({
                browseName: "LinkedValue1",
                componentOf: addressSpace.rootFolder.objects.server,
                dataType: "Double",
                nodeId: "s=LinkedValue1"
            });
            linkedValue1NodeId.should.eql(n2.nodeId.toString());

            const n3 = namespace.addVariable({
                browseName: "LinkedValue2",
                componentOf: addressSpace.rootFolder.objects.server,
                dataType: "Double",
                nodeId: "s=LinkedValue2"
            });
            linkedValue2NodeId.should.eql(n3.nodeId.toString());
        });
        beforeEach(async () => {
            const addressSpace = test.server.engine.addressSpace as AddressSpace;
            const n = addressSpace.findNode(valueTriggeringNodeId)! as UAVariable;
            n.setValueFromSource({ dataType: DataType.Double, value: 1 }, StatusCodes.Good);

            const n2 = addressSpace.findNode(linkedValue1NodeId)! as UAVariable;
            n2.setValueFromSource({ dataType: DataType.Double, value: 1000 }, StatusCodes.Good);

            const n3 = addressSpace.findNode(linkedValue2NodeId)! as UAVariable;
            n3.setValueFromSource({ dataType: DataType.Double, value: 2000 }, StatusCodes.Good);

            s = await createSession();
        });
        afterEach(async () => {
            await s.subscription.terminate();
            await s.session.close();
            await s.client.disconnect();
        });

        const changeSpy = sinon.spy();
        async function createMonitoredItem(nodeId: NodeIdLike, monitoringMode: MonitoringMode): Promise<ClientMonitoredItem> {
            const { session, subscription, publishEngine } = s as Connection;

            const readValue = {
                attributeId: AttributeIds.Value,
                nodeId
            };
            const requestedParameters: MonitoringParametersOptions = {
                discardOldest: true,
                queueSize: 1,
                samplingInterval: 10
            };
            const monitoredItem = await subscription.monitor(
                readValue,
                requestedParameters,
                TimestampsToReturn.Both,
                monitoringMode
            );

            if (monitoringMode === MonitoringMode.Reporting) {
                await new Promise((resolve: any) => {
                    // wait for fist notification
                    monitoredItem.once("changed", (dataValue) => {
                        // tslint:disable-next-line: no-console
                        debugLog("got initial value !!! ", dataValue.value.value);
                        resolve();
                    });
                    s.publishEngine.internalSendPublishRequest();
                });
            } else {
                s.publishEngine.internalSendPublishRequest();
            }
            monitoredItem.on("changed", changeSpy);
            return monitoredItem;
        }

        it("SetTriggering-1 it should return BadNothingToDo if both linksToAdd and linksToRemove are empty", async () => {
            const { session, subscription, publishEngine } = s;
            const t = await createMonitoredItem(valueTriggeringNodeId, MonitoringMode.Reporting);
            const l1 = await createMonitoredItem(linkedValue1NodeId, MonitoringMode.Sampling);
            const l2 = await createMonitoredItem(linkedValue2NodeId, MonitoringMode.Sampling);

            let _err!: Error;

            try {
                const result = await subscription.setTriggering(t, [], []);

                //  console.log(result.toString());

                result.removeResults?.length.should.eql(0);
                result.addResults?.length.should.eql(0);
                result.responseHeader.serviceResult.should.eql(StatusCodes.BadNothingToDo);
            } catch (err) {
                _err = err;
            }
            should.not.exist(_err, "not expecting any exception");

            /*
             */
        });
        it("SetTriggering-2 it should return BadNothingToDo if both linksToAdd and linksToRemove are empty", async () => {
            const { session, subscription, publishEngine } = s;
            const t = await createMonitoredItem(valueTriggeringNodeId, MonitoringMode.Reporting);

            let _err!: Error;

            try {
                const request: SetTriggeringRequestOptions = {
                    linksToAdd: [0xdeadbeef],
                    linksToRemove: [0xc0cac01a],
                    subscriptionId: subscription.subscriptionId,
                    triggeringItemId: t.monitoredItemId
                };
                const session2 = (session as unknown) as ClientSessionRawSubscriptionService;
                const result = await session2.setTriggering(request);
                result.removeResults?.length.should.eql(1);
                result.addResults?.length.should.eql(1);
                result.removeResults![0].should.eql(StatusCodes.BadMonitoredItemIdInvalid);
                result.addResults![0].should.eql(StatusCodes.BadMonitoredItemIdInvalid);
                result.responseHeader.serviceResult.should.eql(StatusCodes.Good);
                // console.log(result.toString());
            } catch (err) {
                console.log(err);
                _err = err;
            }
            should.not.exist(_err, "not expecting any an exception");
        });

        it("SetTriggering-3 it should return BadNothingToDo if both linksToAdd and linksToRemove are empty", async () => {
            const { session, subscription, publishEngine } = s;
            const t = await createMonitoredItem(valueTriggeringNodeId, MonitoringMode.Reporting);
            const l1 = await createMonitoredItem(linkedValue1NodeId, MonitoringMode.Sampling);
            const l2 = await createMonitoredItem(linkedValue2NodeId, MonitoringMode.Sampling);

            const raw_notification_spy = sinon.spy();
            subscription.on("raw_notification", raw_notification_spy);
            raw_notification_spy.resetHistory();
            await incrementValue(valueTriggeringNodeId);

            await waitUntilKeepAlive(publishEngine, subscription);

            raw_notification_spy.callCount.should.eql(2, "must have received a changed notification and one empty notif");

            raw_notification_spy.resetHistory();
            await incrementValue(linkedValue1NodeId);
            await incrementValue(linkedValue2NodeId);
            await incrementValue(valueTriggeringNodeId);

            await pause(100);

            // wait until next keep alive
            await waitUntilKeepAlive(publishEngine, subscription);

            raw_notification_spy.callCount.should.eql(2, "must have received a changed notification and one empty notif");
            {
                const notification = raw_notification_spy.getCall(0).args[0] as NotificationMessage;
                // tslint:disable-next-line: no-unused-expression
                doDebug && console.log(notification.toString());
                const monitoredItems = (notification.notificationData![0] as DataChangeNotification).monitoredItems!;

                monitoredItems.length.should.eql(1);

                monitoredItems[0].clientHandle.should.eql(t.monitoringParameters.clientHandle);
            }
            // ------------------------------ Now create triggering

            await subscription.setTriggering(t, [l1, l2], null);

            // ------------------------------ verify that triggers now happen
            raw_notification_spy.resetHistory();
            await incrementValue(linkedValue1NodeId);
            await incrementValue(linkedValue2NodeId);
            await incrementValue(valueTriggeringNodeId);

            await pause(50);
            // wait until next keep alive
            await waitUntilKeepAlive(publishEngine, subscription);

            raw_notification_spy.callCount.should.eql(2, "must  have received a changed notification and one empty notif");
            {
                const notification = raw_notification_spy.getCall(0).args[0] as NotificationMessage;
                // tslint:disable-next-line: no-unused-expression
                doDebug && console.log(notification.toString());

                const monitoredItems = (notification.notificationData![0] as DataChangeNotification).monitoredItems!;

                monitoredItems.length.should.eql(3);

                monitoredItems[0].clientHandle.should.eql(t.monitoringParameters.clientHandle);
                monitoredItems[1].clientHandle.should.eql(l1.monitoringParameters.clientHandle);
                monitoredItems[2].clientHandle.should.eql(l2.monitoringParameters.clientHandle);
            }

            /// ------------------------- Do it again
            raw_notification_spy.resetHistory();
            await incrementValue(linkedValue1NodeId);
            await incrementValue(linkedValue2NodeId);
            await incrementValue(valueTriggeringNodeId);

            await pause(50);
            // wait until next keep alive
            await waitUntilKeepAlive(publishEngine, subscription);

            raw_notification_spy.callCount.should.eql(2, "must  have received a changed notification and one empty notif");
            {
                const notification = raw_notification_spy.getCall(0).args[0] as NotificationMessage;
                // tslint:disable-next-line: no-unused-expression
                doDebug && console.log(notification.toString());

                const monitoredItems = (notification.notificationData![0] as DataChangeNotification).monitoredItems!;

                monitoredItems.length.should.eql(3);

                monitoredItems[0].clientHandle.should.eql(t.monitoringParameters.clientHandle);
                monitoredItems[1].clientHandle.should.eql(l1.monitoringParameters.clientHandle);
                monitoredItems[2].clientHandle.should.eql(l2.monitoringParameters.clientHandle);
            }

            // --------------------------- Now remove one element
            await subscription.setTriggering(t, [], [l1]);
            // ------------------------------ verify that triggers now happen
            raw_notification_spy.resetHistory();
            await incrementValue(linkedValue1NodeId);
            await incrementValue(linkedValue2NodeId);
            await incrementValue(valueTriggeringNodeId);

            await pause(50);
            // wait until next keep alive
            await waitUntilKeepAlive(publishEngine, subscription);

            raw_notification_spy.callCount.should.eql(2, "must have received a changed notification and one empty notif");
            {
                const notification = raw_notification_spy.getCall(0).args[0] as NotificationMessage;
                // tslint:disable-next-line: no-unused-expression
                doDebug && console.log(notification.toString());

                const monitoredItems = (notification.notificationData![0] as DataChangeNotification).monitoredItems!;

                monitoredItems.length.should.eql(2);

                monitoredItems[0].clientHandle.should.eql(t.monitoringParameters.clientHandle);
                monitoredItems[1].clientHandle.should.eql(l2.monitoringParameters.clientHandle);
            }
        });
    });
}
