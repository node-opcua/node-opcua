process.env.NODEOPCUADEBUG = "CLIENT{TRACE};TRANSPORT{CHUNK-HELACK}";
import { OPCUAClient } from "node-opcua";

(async () => {
    const client = OPCUAClient.create({
        requestedSessionTimeout: 1000,
        transportSettings: {
            maxChunkCount: 1,
            maxMessageSize: 1 * 8192, // should be at least 8192
            receiveBufferSize: 8 * 1024,
            sendBufferSize: 8 * 1024
        },
        connectionStrategy: {
            initialDelay: 10,
            maxDelay: 100,
            maxRetry: 2
        }
    });

    await client.connect("opc.tcp://localhost:48010");
    // await client.connect("opc.tcp://localhost:53530");

    await client.disconnect();
})();
