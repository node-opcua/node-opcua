// tslint:disable:no-console
import { OPCUAClient } from "node-opcua";

const endpointUrl = "opc.tcp://localhost:26543";

async function main() {
    let counter = 1;

    while (true) {
        const client = OPCUAClient.create({ endpointMustExist: false });
        client.on("backoff", (retryCount: number, delay: number) => console.log("    backoff", retryCount, delay));

        try {
            await client.connect(endpointUrl);
            const session = await client.createSession();
            await session.close();
            await client.disconnect();
        } catch (err) {
            if (err instanceof Error) {
                console.log("err", err.message);
            }
        }

        console.log(" Connected = ", counter++);
    }
}

main();
