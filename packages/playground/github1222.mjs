import {
    OPCUAServer,
    resolveNodeId,
    DataType,
    ServerState,
    AttributeIds
} from "node-opcua";
import {
    TimestampsToReturn,
    OPCUAClient,
} from "node-opcua";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    const server = new OPCUAServer({});

    await server.initialize();

    const addressSpace = server.engine.addressSpace;
    addressSpace.rootFolder.objects.server.serverStatus.state.writeEnumValue("Suspended");

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log(server.getEndpointUrl());

    const namespace = addressSpace.getOwnNamespace();
    let counter = 0;
    const myHistoricalSetPointVar = namespace.addVariable({
        browseName: "MyHistoricalSetPoint0",
        nodeId: "s=MyHistoricalSetPoint0",
        organizedBy: resolveNodeId("ObjectsFolder"),
        dataType: DataType.Double,
        userAccessLevel: "CurrentRead | CurrentWrite",
        minimumSamplingInterval: 100
    });
    await pause(1000);
    await addressSpace.rootFolder.objects.server.serverStatus.state.writeEnumValue("Running");
    await pause(1000);
    await addressSpace.rootFolder.objects.server.serverStatus.state.writeEnumValue("Test");
    await pause(1000);
    await addressSpace.rootFolder.objects.server.serverStatus.state.writeEnumValue("Running");
    await pause(1000);
    await server.shutdown(1000);
    console.log("Server has shut down");
})();

(async () => {
    const client = OPCUAClient.create({ endpointMustExist: false });

    client.on("backoff", () => console.log("keep trying to connect"));

    await client.withSubscriptionAsync(
        "opc.tcp://127.0.0.1:26543",
        { publishingEnabled: true, requestedPublishingInterval: 100 },
        async (session, subscription) => {
            console.log("client is connected");

            const nodeId = "i=2259";
            const monitoredItem = await subscription.monitor(
                { nodeId, attributeId: AttributeIds.Value },
                { samplingInterval: 100, discardOldest: true },
                TimestampsToReturn.Both
            );

            monitoredItem.on("changed", (dataValue) => {
                console.log(ServerState[dataValue.value.value]);
            });
            await new Promise((resolve) => process.once("SIGINT", resolve));
        }
    );
})();
