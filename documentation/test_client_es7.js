const opcua = require("node-opcua");
const os = require("os");

async function mytest() {

    const client = opcua.OPCUAClient.create();
    client.on("backoff", () => console.log("backoff"));

    try {

        await client.connect("opc.tcp://"+ os.hostname() + ":26543");

        const session = await client.createSession();

        const readResult = await session.read({nodeId: "i=84"});

        console.log(readResult.toString());

        const readResult2 = await session.read({nodeId: "i=84", attributeId: opcua.AttributeIds.BrowseName});

        console.log(readResult2.toString());

        await session.close();

        await client.disconnect();

    }
    catch (err) {
        console.log("Err =", err);
    }
}
mytest();

async function myTestWithSession() {

    const client = opcua.OPCUAClient.create();
    client.on("backoff", () => console.log("backoff"));

    await client.withSessionAsync("opc.tcp://localhost:26543", async (session)=>{
        const dataValue = await session.read({nodeId: "i=84", attributeId: opcua.AttributeIds.BrowseName});
        console.log(dataValue.toString());
    });

}
myTestWithSession();