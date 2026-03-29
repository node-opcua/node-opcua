import { OPCUAClient, MessageSecurityMode, SecurityPolicy } from "node-opcua";

const endpointUrl = "opc.tcp://opcuademo.sterfive.com"; // Replace with your server URL

async function main() {
    try {
        const client = OPCUAClient.create({
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            endpointMustExist: false,
            // =>   UNUser rejectUnauthorized: false
        });

        await client.connect(endpointUrl);
        console.log("Connected to OPC UA server");

        const session = await client.createSession();
        console.log("Session created");

        const subscription = await session.createSubscription2({
            requestedPublishingInterval: 1000,
            requestedMaxKeepAliveCount: 10,
            requestedLifetimeCount: 60,
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            priority: 10
        });
        console.log("Subscription created:", subscription.subscriptionId);
        console.log("Subscription object (response):", subscription);
        subscription.on("terminated", () => { // This line causes the TypeError
            console.log("Subscription terminated");
        });

        // ... (rest of the code to monitor items)

    } catch (err) {
        console.error("Error:", err);
    } finally {
        if (client) await client.disconnect();
    }
}

main();