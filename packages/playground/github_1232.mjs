import {
    OPCUAClient,
    AttributeIds,
    MessageSecurityMode,
    SecurityPolicy
}from"node-opcua";

const endpointUrl = "opc.tcp://localhost:10000/Foo/Bar";
const nodeId = "ns=2;s=TestVar";

async function main() {
    try {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            connectionStrategy: {
                maxRetry: 2,
                initialDelay: 2000,
                maxDelay: 10 * 1000,
            },
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
        });
        client.on("backoff", () => console.log("Retrying connection"));

        console.log("Connecting...")
        await client.connect(endpointUrl);
        const session = await client.createSession();

        await session.extractNamespaceDataType();
        
        const dataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
        console.log(`value = ${dataValue.value.value.toString()}`);

        console.log("Closing session");
        await session.close();
        await client.disconnect();
    } catch (err) {

        console.log("Error!", err);
        process.exit();
    }
}

main();