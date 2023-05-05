import {
    TimestampsToReturn,
    OPCUAServer,
    OPCUAClient,
    DataType,
    AttributeIds,
    AccessRestrictionsFlag,
    MessageSecurityMode,
    SecurityPolicy,
    OPCUACertificateManager
} from "node-opcua";

const port = 2798;

const pause = async (ms) => await new Promise((resolve) => setTimeout(resolve, ms));

const tmpFolder = "/tmp/a";

const certificateManager = new OPCUACertificateManager({
    automaticallyAcceptUnknownCertificate: true,
    rootFolder: tmpFolder
});

(async () => {
    await certificateManager.initialize();

    const server = new OPCUAServer({
        port,
        serverCertificateManager: certificateManager
    });

    await server.initialize();
    const addressSpace = server.engine.addressSpace;

    const namespace = addressSpace.getOwnNamespace();

    const tankLevel = namespace.addVariable({
        browseName: "TankLevel",
        nodeId: "s=TankLevel",
        organizedBy: addressSpace.rootFolder.objects,
        dataType: DataType.Double,
        value: { dataType: "Double", value: 0.0 },

        accessRestrictions: AccessRestrictionsFlag.EncryptionRequired
    });

    const timerId = setInterval(() => {
        const t = Date.now();
        const value = Math.sin(t / 10000) * 100 + 100;
        tankLevel.setValueFromSource({ dataType: "Double", value });
    }, 1000);
    addressSpace.registerShutdownTask(() => clearInterval(timerId));

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log(server.getEndpointUrl());

    clientTest();

    await new Promise((resolve) => process.once("SIGINT", resolve));
    await server.shutdown();
    console.log("Server has shut down");
})();

const clientTest = async () => {
    await certificateManager.initialize();

    await pause(1000);

    const client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode: MessageSecurityMode.Sign,
        securityPolicy: SecurityPolicy.Basic256Sha256,
        clientCertificateManager: certificateManager
    });

    client.on("backoff", () => console.log("keep trying to connect"));

    await client.withSubscriptionAsync(
        `opc.tcp://127.0.0.1:${port}`,
        { publishingEnabled: true, requestedPublishingInterval: 1000 },
        async (session, subscription) => {
            const monitoredItem2 = await subscription.monitor(
                {
                    nodeId: "ns=1;s=TankLevel",
                    attributeId: AttributeIds.Value
                },
                { samplingInterval: 1000 },
                TimestampsToReturn.Both
            );
            console.log("statusCode = ", monitoredItem2.statusCode.toString());

            monitoredItem2.on("changed", (dataValue) => {
                console.log("> Tank Level = ", dataValue.value.value, dataValue.statusCode.toString());
            });

            await new Promise((resolve) => process.once("SIGINT", resolve));
        }
    );
};
