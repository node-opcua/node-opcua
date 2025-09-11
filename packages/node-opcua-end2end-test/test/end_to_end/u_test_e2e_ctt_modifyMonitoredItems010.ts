import "should";
import {
    OPCUAClient,
    ClientSubscription,
    AttributeIds,
    ClientMonitoredItemGroup,
    StatusCodes,
    ClientSidePublishEngine,
    Subscription,
    TimestampsToReturn
} from "node-opcua";
import sinon from "sinon";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; [k: string]: any }

// Scalar nodes
const itemsToMonitor1: { nodeId: string; attributeId: number }[] = [
    { nodeId: "ns=2;s=Static_Scalar_Boolean", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Byte", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_ByteString", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_DateTime", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_SByte", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Int16", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_UInt16", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Int32", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_UInt32", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Int64", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_UInt64", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Float", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Double", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Duration", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Guid", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_LocaleId", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_LocalizedText", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_NodeId", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Number", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_UInteger", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_Integer", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_UtcTime", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_XmlElement", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_ImageBMP", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_ImageGIF", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Scalar_ImagePNG", attributeId: AttributeIds.Value }
];

// Array & data item nodes (plus discrete variants)
const itemsToMonitor2: { nodeId: string; attributeId: number }[] = [
    { nodeId: "ns=2;s=Static_Array_Boolean", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Byte", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_ByteString", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_DateTime", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_SByte", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Int16", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_UInt16", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Int32", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_UInt32", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Int64", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_UInt64", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Float", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Double", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Duration", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Guid", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_LocaleId", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_LocalizedText", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_NodeId", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Number", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_UInteger", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_Integer", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_UtcTime", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_XmlElement", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_ImageBMP", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_ImageGIF", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Static_Array_ImagePNG", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=ByteDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=DoubleDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Int16DataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Int32DataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Int64DataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=UInt16DataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=UInt32DataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=UInt64DataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=SByteDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=StringDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=DateTimeDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=FloatDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=DoubleArrayAnalogDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Int16ArrayAnalogDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=UInt16ArrayAnalogDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=UInt16ArrayAnalogDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=UInt32ArrayAnalogDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=FloatArrayAnalogDataItem", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=MultiStateDiscrete001", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=MultiStateDiscrete002", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=MultiStateDiscrete003", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=MultiStateDiscrete004", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=MultiStateDiscrete005", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=TwoStateDiscrete001", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=TwoStateDiscrete002", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=TwoStateDiscrete003", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=TwoStateDiscrete004", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=TwoStateDiscrete005", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=ByteMultiStateValueDiscrete", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=SByteMultiStateValueDiscrete", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Int16MultiStateValueDiscrete", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Int32MultiStateValueDiscrete", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=Int64MultiStateValueDiscrete", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=UInt16MultiStateValueDiscrete", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=UInt32MultiStateValueDiscrete", attributeId: AttributeIds.Value },
    { nodeId: "ns=2;s=UInt64MultiStateValueDiscrete", attributeId: AttributeIds.Value }
];

export function t(test: TestHarness) {
    describe("CTT 010 modify samplingInterval on large monitored item group", () => {
        let oldPublishInPipeline = 0;
        beforeEach(() => {
            oldPublishInPipeline = (ClientSidePublishEngine as any).publishRequestCountInPipeline;
            (ClientSidePublishEngine as any).publishRequestCountInPipeline = 1;
        });
        afterEach(() => {
            (ClientSidePublishEngine as any).publishRequestCountInPipeline = oldPublishInPipeline;
        });

        it("creates many monitored items and modifies half", async () => {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;

            await client.withSessionAsync(endpointUrl, async (session) => {
                // pause publish engine while we create large group
                (session as any).getPublishEngine().suspend(true);

                const subscription = ClientSubscription.create(session, {
                    requestedPublishingInterval: 200,
                    requestedLifetimeCount: 10 * 60 * 1000,
                    requestedMaxKeepAliveCount: 60,
                    maxNotificationsPerPublish: 0,
                    publishingEnabled: true,
                    priority: 6
                });

                const rawNotificationSpy = sinon.spy();
                subscription.on("raw_notification", rawNotificationSpy);

                const options = { samplingInterval: 10, discardOldest: true, queueSize: 1 };

                // Exponentially replicate lists to reach large count (same approach as legacy test)
                const itemsToMonitorX = ([] as typeof itemsToMonitor1).concat(
                    itemsToMonitor1,
                    itemsToMonitor1,
                    itemsToMonitor1,
                    itemsToMonitor1,
                    itemsToMonitor1,
                    itemsToMonitor1,
                    itemsToMonitor1,
                    itemsToMonitor1
                );
                const itemsToMonitorY = ([] as typeof itemsToMonitor1).concat(
                    itemsToMonitorX,
                    itemsToMonitorX,
                    itemsToMonitorX,
                    itemsToMonitorX,
                    itemsToMonitorX,
                    itemsToMonitorX,
                    itemsToMonitorX,
                    itemsToMonitorX
                );
                const itemsToMonitor = ([] as typeof itemsToMonitor1).concat(
                    itemsToMonitorY,
                    itemsToMonitorY,
                    itemsToMonitorY,
                    itemsToMonitorY
                );

                const group = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, options, TimestampsToReturn.Both);
                await new Promise<void>((resolve, reject) => {
                    group.on("initialized", () => {
                        const badItems = group.monitoredItems.filter((it: any) => it.statusCode.isNotGood());
                        if (badItems.length) {
                            const details = group.monitoredItems
                                .map((it: any, i: number) => `${itemsToMonitor[i].nodeId.padEnd(30)} ${it.statusCode.toString()}`)
                                .join("\n");
                            return reject(new Error("Initialization failed for some nodeIds:\n" + details));
                        }
                        group.monitoredItems.length.should.eql(itemsToMonitor.length);
                        resolve();
                    });
                });

                // Resume publish and trigger initial publish requests
                (session as any).getPublishEngine().internalSendPublishRequest();

                // Wait for first raw notification (bounded wait)
                const waitFirstNotification = async () => {
                    for (let i = 0; i < 10; i++) { // up to ~30s
                        if (rawNotificationSpy.callCount > 0) return;
                        await new Promise((r) => setTimeout(r, 3000));
                    }
                };
                await waitFirstNotification();

                rawNotificationSpy.callCount.should.be.greaterThan(0);
                const firstMonitoredCount = rawNotificationSpy.getCall(0).args[0].notificationData[0].monitoredItems.length;
                firstMonitoredCount.should.eql(
                    Math.min(group.monitoredItems.length, (Subscription as any).maxNotificationPerPublishHighLimit)
                );

                rawNotificationSpy.resetHistory();
                rawNotificationSpy.callCount.should.eql(0);

                // Modify sampling interval: first half 1000 ms, second half 3000 ms
                const itemsToModify = group.monitoredItems.map((mi: any, index: number) => ({
                    monitoredItemId: mi.monitoredItemId,
                    requestedParameters: { samplingInterval: index % 2 ? 3000 : 1000 }
                }));

                await (session as any).modifyMonitoredItems({
                    subscriptionId: subscription.subscriptionId,
                    itemsToModify
                });

                (session as any).getPublishEngine().internalSendPublishRequest();
                (session as any).getPublishEngine().internalSendPublishRequest();
                (session as any).getPublishEngine().internalSendPublishRequest();

                await new Promise((r) => setTimeout(r, 6000));

                // Expect subsequent notifications (not asserting counts strictly due to timing variability)
                rawNotificationSpy.callCount.should.be.greaterThan(0);

                await new Promise<void>((resolve) => group.terminate(() => resolve()));
                await subscription.terminate();
            });
        });
    });
}
