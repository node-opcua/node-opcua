process.env.NODEOPCUADEBUG = "CLIENT{TRACE}-TRANSPORT{HELACK-CHUNK}";

import { OPCUAServer, ServerTCP_transport, OPCUAClient, HelloMessage, adjustLimitsWithParameters, IHelloAckLimits } from "node-opcua";

const myParameters = {
    minBufferSize: 8192,
    maxBufferSize: 16384,
    minMaxMessageSize: 8192,
    defaultMaxMessageSize: 16384,
    maxMaxMessageSize: 128 * 1024 * 1024,
    minMaxChunkCount: 1,
    defaultMaxChunkCount: 1,
    maxMaxChunkCount: 9000
};

const myAdjustLimits = (hello: IHelloAckLimits): IHelloAckLimits => {
    return adjustLimitsWithParameters(hello, myParameters);
};

async function startServer() {
    const server = new OPCUAServer({
        transportSettings: {
            adjustTransportLimits: (hello: IHelloAckLimits) => myAdjustLimits(hello)
        }
    });
    await server.start();
    console.log("server started at ", server.getEndpointUrl());
    return server;
}

async function testClient(endpointUrl: string) {
    const client = OPCUAClient.create({});

    await client.connect(endpointUrl);
    console.log("connected");
    await client.disconnect();
}

async function main() {
    const server = await startServer();

    await testClient(server.getEndpointUrl());
    await server.shutdown();
}
main();
