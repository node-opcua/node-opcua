import {
    AttributeIds,
    ClientSession,
    coerceNodeId,
    OPCUAClient
} from "../packages/node-opcua";

const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";

async function main0() {

    const client = OPCUAClient.create({applicationName: "MyClientApp"});

    // async version
    await client.withSession(endpointUrl, async (session) => {

        const dataValue = await session.read({
            attributeId: AttributeIds.BrowseName,
            nodeId: "i=84",
        });

        console.log(dataValue.toString());

    });
}

// main0();
// note compile with tsc typescript_test.ts --lib ES2015

//
// http://thecodebarbarian.com/80-20-guide-to-async-await-in-node.js.html
//
async function main1() {

    try {

        const client = OPCUAClient.create({clientName: "DemoClient"});

        await client.withSessionAsync(endpointUrl, async (session) => {
            const dataValue = await session.read(
                {nodeId: "ns=1;s=Temperature", attributeId: AttributeIds.BrowseName});
            console.log("Temperature = ", dataValue.toString());
        });

    } catch (err) {
        console.log("Error = ", err);
    }
}

async function main3() {

    try {

        const client = OPCUAClient.create({clientName: "DemoClient"});
        await client.withSessionAsync(endpointUrl, async (session: ClientSession) => {

            console.log("sessionId = ", session.sessionId.toString());

            const dataValue = await session.read({nodeId: session.sessionId, attributeId: AttributeIds.Value});
            console.log("value = ", dataValue.toString());
        });

    } catch (err) {
        console.log("Error = ", err);
    }
}

main();

async function main2() {
    try {
        const client = OPCUAClient.create({clientName: "DemoClient"});

        const subscriptionParameters = {
            maxNotificationsPerPublish: 10,
            priority: 10,
            publishingEnabled: true,
            requestedLifetimeCount: 1000,
            requestedMaxKeepAliveCount: 12,
            requestedPublishingInterval: 100,
        };

        await client.withSubscriptionAsync(
            endpointUrl,
            subscriptionParameters,
            async (session, subscription) => {

                const nodeId = coerceNodeId("ns=1;s=Temperature");

                const itemToMonitor = {nodeId, attributeId: AttributeIds.Value, indexRange: null};

                const requestedParameters = {
                    samplingInterval: 1000,
                    queueSize: 10000,
                    discardOldest: true
                };

                const monitoredItem = await subscription.monitor(itemToMonitor, requestedParameters);

                monitoredItem.on("changed", (dataValue) => console.log("Temperature ", dataValue.value.value));
                monitoredItem.on("err", (err) => console.log(err));

                await new Promise((resolve) => setTimeout(resolve, 5000));

            });
    } catch (err) {
        console.log("Main 2", err);
    }
}

main2();
