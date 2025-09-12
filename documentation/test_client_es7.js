const { AttributeIds, OPCUAClient } = require("node-opcua");

const endpointUrl = "opc.tcp://opcuademo.sterfive.com:26543";

async function mytest() {
    const client = OPCUAClient.create({});
    client.on("backoff", () => console.log("backoff"));

    try {
        await client.connect(endpointUrl);

        const session = await client.createSession();

        const readResult = await session.read({ nodeId: "i=84", attributeId: AttributeIds.Value });

        console.log(readResult.toString());

        const readResult2 = await session.read({ nodeId: "i=84", attributeId: AttributeIds.BrowseName });

        console.log(readResult2.toString());

        await session.close();

        await client.disconnect();
    } catch (err) {
        console.log("Err =", err);
    }
}
mytest();

async function myTestWithSession() {
    const client = OPCUAClient.create({});
    client.on("backoff", () => console.log("backoff"));

    await client.withSessionAsync("opc.tcp://localhost:26543", async (session) => {
        const dataValue = await session.read({ nodeId: "i=84", attributeId: AttributeIds.BrowseName });
        console.log(dataValue.toString());
    });
}
myTestWithSession();
