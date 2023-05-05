import {
    HistoryReadRequest,
    TimestampsToReturn,
    OPCUAServer,
    OPCUAClient,
    resolveNodeId,
    DataType,
    ReadRawModifiedDetails,
    StatusCodes,
    AttributeIds
} from "node-opcua";
(async () => {
    const server = new OPCUAServer({});

    await server.initialize();
    const addressSpace = server.engine.addressSpace;

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
    addressSpace.installHistoricalDataNode(myHistoricalSetPointVar, {
        maxOnlineValues: 500
    });

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log(server.getEndpointUrl());
    await new Promise((resolve) => process.once("SIGINT", resolve));

    await server.shutdown();
    console.log("Server has shut down");
})();

(async () => {
    const client = OPCUAClient.create({ endpointMustExist: false });

    client.on("backoff", () => console.log("keep trying to connect"));

    await client.withSessionAsync("opc.tcp://127.0.0.1:26543", async (session) => {
        const nodeId = "ns=1;s=MyHistoricalSetPoint0";
        const w = async (value, statusCode) => {
            await session.write({
                nodeId,
                attributeId: AttributeIds.Value,
                value: {
                    value: { dataType: DataType.Double, value },
                    statusCode
                }
            });
        };
        await w(10, StatusCodes.Good);
        await w(500, StatusCodes.BadOutOfRange);
        await w(50, StatusCodes.Good);
        await w(20, StatusCodes.Good);
        await w(60, StatusCodes.Good);
        await w(-1, StatusCodes.Bad);

        const historyReadDetails = new ReadRawModifiedDetails({
            endTime: new Date(),
            isReadModified: false,
            numValuesPerNode: 3, // three at a time
            returnBounds: false,
            startTime: new Date(Date.now() - 1000 * 60 * 60 * 24)
        });
        const rawData = await session.historyRead(
            new HistoryReadRequest({
                nodesToRead: [{ nodeId }],
                historyReadDetails,
                releaseContinuationPoints: false,
                timestampsToReturn: TimestampsToReturn.Both
            })
        );
        console.log(rawData.toString());
    });
})();
