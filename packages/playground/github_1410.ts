import { OPCUAClient, DataValue, AttributeIds, IBasicSession, TimestampsToReturn } from "node-opcua-client";
async function handleOperationChange(session: IBasicSession, dataValue: DataValue) {

    console.log("to do something with the new value", dataValue.toString());
}

const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";
const nodeId = "ns=1;s=Temperature";

async function main() {

    const client = OPCUAClient.create({});
    client.on("connection_reestablished", () => {
        console.log("OPC UA Client: connection reestablished!");
    });

    client.on("lifetime_75", (token) => {
        console.log(`OPC UA Client: securechannel token lifetime @ 75%! tokenId='${token.tokenId}'`)
    })

    
    const subscriptionParameters = {
        requestedPublishingInterval: 1000,
        requestedLifetimeCount: 100,
        requestedMaxKeepAliveCount: 10,
        maxNotificationsPerPublish: 100,
        publishingEnabled: true,
        priority: 10
    };
    await client.withSubscriptionAsync(endpointUrl, subscriptionParameters, async (session, subscription) => {

        session.on("session_restored", () => {
            console.log("Session restored!");
        });

        const monitorItem = await subscription.monitor({ 
            nodeId,
            attributeId: AttributeIds.Value 
        }, { samplingInterval: 1000, discardOldest: true, queueSize: 10 }, 
        TimestampsToReturn.Both);
        monitorItem.on("changed", (dataValue) => {
            handleOperationChange(session, dataValue)
                .then(() => { })
                .catch((err) => console.log(err.message));
        });
        // wait for user to press CTRL+C to terminate
        console.log("Press CTRL+C to stop");
        await new Promise((resolve) => process.on("SIGINT", resolve));
    });
}
main();
