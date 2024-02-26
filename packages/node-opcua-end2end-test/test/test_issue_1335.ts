import "should";
process.env.NODEOPCUADEBUG="CLIENT{TRACE}-TRANSPORT{HELACK-CHUNK}";
import  { OPCUAServer,ServerTCP_transport, OPCUAClient, IHelloAckLimits, adjustLimitsWithParameters } from "node-opcua";


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

const port = 2888;
async function startServer() {
    const server = new OPCUAServer({
        port,
        transportSettings: {
            adjustTransportLimits: (hello: IHelloAckLimits) => myAdjustLimits(hello)
        }
    });
    await server.start();
    console.log("server started at ", server.getEndpointUrl());
    return server;
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Server with maxChunk=1 (github#1335)", function() {

    let server:OPCUAServer;
before(async()=>{
    server = await startServer();
    
});
after(async()=>{
    await server.shutdown();
});
  it("client connection should not fail when server impose maxChunk=1", async ()=>{
    
    const endpointUrl = server.getEndpointUrl();

    const client = OPCUAClient.create({});
    try {
        await client.connect(endpointUrl);
        console.log("connected");
    } catch(err) {
        console.log("connection has failed !");
        throw err;
    }
    await client.disconnect();
    

  });

});