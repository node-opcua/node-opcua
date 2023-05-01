const {
    OPCUAClient,
    BrowseDirection,
    AttributeIds,
    NodeClassMask,
    makeBrowsePath,
    resolveNodeId,
    TimestampsToReturn,
    coerceInt32
} = require("node-opcua");

const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";

(async () => {
    const client = OPCUAClient.create({
        endpointMustExist: false
    });
    client.on("backoff", (retry, delay) =>
        console.log("still trying to connect to ", endpointUrl, ": retry =", retry, "next attempt in ", delay / 1000, "seconds")
    );
    const subscriptionParameters = {
        maxNotificationsPerPublish: 1000,
        publishingEnabled: true,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        requestedPublishingInterval: 1000
    };

    await client.withSubscriptionAsync(endpointUrl, subscriptionParameters, async (session, subscription) => {
        try {
            const browseResult = await session.browse({
                nodeId: resolveNodeId("RootFolder"),
                referenceTypeId: "Organizes",
                browseDirection: BrowseDirection.Forward,
                includeSubtypes: true,
                nodeClassMask: NodeClassMask.Object,
                resultMask: 63
            });
            if (browseResult.statusCode.isGood()) {
                console.log(" rootFolder contains: ");
                for (let reference of browseResult.references) {
                    console.log("  ", reference.browseName.toString(), reference.nodeId.toString());
                }
            } else {
                console.log("cannot browse rootFolder", browseResult.toString());
            }

            const datavalue = await session.read({ nodeId: "ns=1;s=free_memory", attributeId: AttributeIds.Value });

            const maxAge = 0;
            const nodeToRead = {
                nodeId: "ns=1;s=SystemMemoryFree",
                attributeId: AttributeIds.Value
            };

            const dataValue2 = await session.read(nodeToRead, maxAge);
            console.log(" free mem % = ", dataValue2.toString());

            // install monitored item
            const itemToMonitor = {
                nodeId: resolveNodeId("ns=1;s=SystemMemoryFree"),
                attributeId: AttributeIds.Value
            };
            const monitoringParameters = {
                samplingInterval: 100,
                discardOldest: true,
                queueSize: 10
            };

            const monitoredItem = await subscription.monitor(itemToMonitor, monitoringParameters, TimestampsToReturn.Both);
            monitoredItem.on("changed", function (dataValue) {
                console.log("monitored item changed:  % free mem = ", coerceInt32(dataValue.value.value), "bytes");
            });

            const browsePathResult = await session.translateBrowsePath(
                makeBrowsePath("RootFolder", "/Objects/Server/VendorServerInfo.1:TransactionsCount")
            );
            if (browsePathResult.statusCode.isGood()) {
                const transactionCountNodeId = browsePathResult.targets[0].targetId;

                const monitoredItem = await subscription.monitor(
                    {
                        nodeId: transactionCountNodeId,
                        attributeId: AttributeIds.Value
                    },
                    monitoringParameters,
                    TimestampsToReturn.Both
                );
                monitoredItem.on("changed", function (dataValue) {
                    console.log("transaction count = ", dataValue.value.value);
                });
            } else {
                console.log("cannot find TransactionCount node id", browsePathResult.toString());
            }
        } catch (err) {
            console.log("err", err.message);
        }
        // wait  until CTRL+C is pressed
        console.log("CTRL+C to stop");
        await new Promise((resolve) => process.once("SIGINT", resolve));
    });
})();
