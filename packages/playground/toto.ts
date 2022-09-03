// The ExtensionObject definition is loaded out of the server during the first operation (like read) that requires it.
// If the server is restarted and the extension object definition has changed , the client need to be restarted.

import { OPCUAClient, MessageSecurityMode, SecurityPolicy, DataValue } from "node-opcua";

const endpointUrl = "opc.tcp://localhost:4840";

async function writeToDatabase(dataValue: DataValue[]) {
    /** */
}
const mainLoop = async () => {
    try {
        const client = OPCUAClient.create({
            applicationName: "my-opc-client",
            securityMode: MessageSecurityMode.None,
            securityPolicy: SecurityPolicy.None,
            endpointMustExist: true
        });

        const processData = await client.withSessionAsync(endpointUrl, async (session) => {
            const processData = await session.read([
                { nodeId: 'ns=3;s="020_FIFO_OPCUA"."Setpoints"' },
                { nodeId: 'ns=3;s="020_FIFO_OPCUA"."Actuals"' }
            ]);
            return processData;
        });
        await writeToDatabase(processData);

        setTimeout(() => mainLoop(), 500);
    } catch (error: any) {
        setTimeout(() => mainLoop(), 5000);
    }
};
mainLoop();
