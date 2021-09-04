const {
    OPCUAClient,
    ClientSubscription,
    AttributeIds,
    ClientMonitoredItemGroup,
    StatusCodes,
    ClientSidePublishEngine,
    Subscription
} = require("node-opcua");
const { perform_operation_on_session_async } = require("../../test_helpers/perform_operation_on_client_session");
const sinon = require("sinon");

const itemsToMonitor1 = [
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
    { nodeId: "ns=2;s=Static_Scalar_ImagePNG", attributeId: AttributeIds.Value },
];
const itemsToMonitor2 = [

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
    { nodeId: "ns=2;s=UInt64MultiStateValueDiscrete", attributeId: AttributeIds.Value },
];

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {

    describe("Testing ctt 010  - Modify the samplingInterval of multiple nodes, where the first half are set to 1000 msec and the latter half 3000 msec", function() {

        let old_publishRequestCountInPipeline = 0;
        beforeEach(() => {
            old_publishRequestCountInPipeline = ClientSidePublishEngine.publishRequestCountInPipeline;
            ClientSidePublishEngine.publishRequestCountInPipeline = 1;
        });

        afterEach(() => {
            ClientSidePublishEngine.publishRequestCountInPipeline = old_publishRequestCountInPipeline;
        });
        it("should create a large number of monitored item and alter samplingInterval for half of them", async () => {
            const client = OPCUAClient.create();
            const endpointUrl = test.endpointUrl;


            await client.withSessionAsync(endpointUrl, async (session) => {

                session.getPublishEngine().suspend(true);

                const subscription = ClientSubscription.create(session, {
                    requestedPublishingInterval: 200,
                    requestedLifetimeCount: 10 * 60 * 1000,
                    requestedMaxKeepAliveCount: 60,
                    maxNotificationsPerPublish: 0,
                    publishingEnabled: true,
                    priority: 6
                });

                const subscription_raw_notification_event = sinon.spy();

                subscription.on("raw_notification", subscription_raw_notification_event);

                subscription.on("received_notifications", () => {
                    console.log("...");
                });

                const options = {
                    samplingInterval: 10,
                    discardOldest: true,
                    queueSize: 1
                };

                const itemsToMonitorX = [].concat(itemsToMonitor1, itemsToMonitor1, itemsToMonitor1, itemsToMonitor1, itemsToMonitor1, itemsToMonitor1, itemsToMonitor1, itemsToMonitor1);
                const itemsToMonitorY = [].concat(itemsToMonitorX, itemsToMonitorX, itemsToMonitorX, itemsToMonitorX, itemsToMonitorX, itemsToMonitorX, itemsToMonitorX, itemsToMonitorX);
                const itemsToMonitor = [].concat(itemsToMonitorY, itemsToMonitorY, itemsToMonitorY, itemsToMonitorY);

                const monitoredItemGroup = ClientMonitoredItemGroup.create(subscription, itemsToMonitor, options);

                await new Promise((resolve, reject) => {
                    // subscription.on("item_added",function(monitoredItem){
                    monitoredItemGroup.on("initialized", function() {

                        const allGood = monitoredItemGroup.monitoredItems.filter((item, index) => item.statusCode !== StatusCodes.Good);
                        if (allGood.length > 0) {
                            console.log(" Initialized Failed!", monitoredItemGroup.monitoredItems.map((item, index) => itemsToMonitor[index].nodeId.toString().padEnd(20) + " " + item.statusCode.toString()).join("\n"));
                            return reject(new Error("Initialization failed , some nodeId are "));
                        }
                        monitoredItemGroup.monitoredItems.length.should.eql(itemsToMonitor.length);
                        resolve();
                    });
                });
                console.log("Sending Publish request");

                session.getPublishEngine().internalSendPublishRequest();
                // session.getPublishEngine().suspend(true);

                async function wait_notification() {
                    if (subscription_raw_notification_event.callCount > 0) {
                        return;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    await wait_notification();
                }
                await wait_notification();

                function dumpNotificationResult() {
                    console.log("notification received  = ", subscription_raw_notification_event.callCount);
                    for (const c of subscription_raw_notification_event.getCalls()) {
                        // console.log("Initial l=", c.args[0].notificationData.length.toString());
                        for (const n of c.args[0].notificationData) {
                            console.log(" monitoredItem changes = ", n.monitoredItems.length);
                        }
                    }
                }

                dumpNotificationResult();

                subscription_raw_notification_event
                    .getCall(0)
                    .args[0].notificationData[0].monitoredItems.length.should.eql(
                        Math.min(itemsToMonitor.length, Subscription.maxNotificationPerPublishHighLimit)
                    );

                subscription_raw_notification_event.resetHistory();
                subscription_raw_notification_event.callCount.should.eql(0);

                // --------------------------------------------------------------------------------------------------


                const itemsToModify = itemsToMonitor.map((item, index) => {
                    return {
                        monitoredItemId: monitoredItemGroup.monitoredItems[index].monitoredItemId,
                        requestedParameters: {
                            samplingInterval: (index % 2) ? 3000 : 1000
                        }
                    }
                })
                await session.modifyMonitoredItems({
                    subscriptionId: subscription.subscriptionId,
                    itemsToModify
                });

                session.getPublishEngine().internalSendPublishRequest();
                session.getPublishEngine().internalSendPublishRequest();
                session.getPublishEngine().internalSendPublishRequest();

                await new Promise((resolve) => setTimeout(resolve, 6000));

                dumpNotificationResult();


                await new Promise(resolve => {
                    monitoredItemGroup.terminate(function() {
                        console.log(" terminated !");
                        resolve();
                    });
                });


                await subscription.terminate();

            });
        });
    });
}
