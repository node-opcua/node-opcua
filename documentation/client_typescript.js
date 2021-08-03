import { OPCUAClient } from "../packages/node-opcua-client";
async function main() {
    try {
        const endpointUrl2 = "opc.tcp://localhost:48010";
        const client = OPCUAClient.create({
            endpointMustExist: false
        });
        await client.connect(endpointUrl2);
        const session = await client.createSession();
        await session.close();
        await client.disconnect();
    }
    catch (err) {
        console.log(err.message);
        process.exit(0);
    }
}
main();
