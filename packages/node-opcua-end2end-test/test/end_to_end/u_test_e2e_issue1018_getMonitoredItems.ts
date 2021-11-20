import {
    TimestampsToReturn,
    OPCUAClient,
    MethodIds,
    ObjectIds,
    DataType,
    ReadValueIdOptions,
    VariableIds,
    AttributeIds
} from "node-opcua";
export function t(test: any) {
    describe("getMonitoredItem issue #1018", () => {
        it("getMonitoredItems with more than 25 variables", async () => {
            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});
            const subscriptionParameters = {
                requestedPublishingInterval: 1000,
                requestedLifetimeCount: 10,
                requestedMaxKeepAliveCount: 10,
                maxNotificationsPerPublish: 10,
                publishingEnabled: true
            };
            await client.withSubscriptionAsync(endpointUrl, subscriptionParameters, async (session, subscription) => {
                const itemsToMonitor: ReadValueIdOptions[] = [];
                for (let i = 0; i < 50; i++) {
                    const itemToMonitor = {
                        nodeId: VariableIds.Server_ServerStatus_CurrentTime,
                        attributeId: AttributeIds.Value
                    };
                    itemsToMonitor.push(itemToMonitor);
                }
                const group =  await subscription.monitorItems(
                    itemsToMonitor,
                    {
                        samplingInterval: 100,
                        queueSize: 10
                    },
                    TimestampsToReturn.Both
                );

                const m = await session.call({
                    methodId: MethodIds.Server_GetMonitoredItems,
                    objectId: ObjectIds.Server,
                    inputArguments: [
                        {
                            dataType: DataType.UInt32,
                            value: subscription.subscriptionId
                        }
                    ]
                });
                console.log(m.toString());
            });
        });
    });
}
