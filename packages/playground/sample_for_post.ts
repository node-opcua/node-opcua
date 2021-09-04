// tslint:disable:no-console
import { AttributeIds, OPCUAClient } from "node-opcua";

async function main() {
    const client = OPCUAClient.create({
        endpointMustExist: false
    });

    client.on("backoff", (retry: number, delay: number) => {
        console.log(" cannot connect to endpoint retry = ", retry, " next attempt in ", delay / 1000, "seconds");
    });

    // put the endpoint to your OPCUA Server here
    const endpointUrl = "opc.tcp://localhost:48020";

    try {
        await client.connect(endpointUrl);

        const session = await client.createSession();

        const dataValue = await session.read({
            attributeId: AttributeIds.Value,
            nodeId: "i=2258" // Server CurrentTime
        });

        console.log("Server time is ", dataValue.value.toString());

        await session.close();

        await client.disconnect();
    } catch (err) {
        if (err instanceof Error) {
            console.log(" err ", err.message);
        }
    }
}

main();
