import { OPCUAClient } from "node-opcua";

const endpointUrl1 = "opc.tcp://localhost:48010";
const endpointUrl = "opc.tcp://localhost:26543";
(async () => {
    const client = OPCUAClient.create({
        endpointMustExist: false
    });
    await client.connect(endpointUrl);
    console.log("connected");

    const session = await client.createSession();

    const subscription = await session.createSubscription2({
        requestedPublishingInterval: 500,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true
    });
    console.log("subscription created : ", subscription.subscriptionId);
    await session.close(false);
    await client.disconnect();
})();
