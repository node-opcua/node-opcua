import "should";
import sinon from "sinon";
import { ClientSecureChannelLayer, get_mini_nodeset_filename, OPCUAClient, OPCUAServer } from "node-opcua";

const port = 2128;

async function startServer(): Promise<OPCUAServer> {
    // get IP of the machine
    const mini = get_mini_nodeset_filename();

    const server = new OPCUAServer({
        port,
        // nodeset_filename: [nodesets.standard],
        nodeset_filename: [mini]
    });
    await server.initialize();
    await server.start();
    return server;
}
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("#1002 - ability to set transport timeout ", () => {
    let server: OPCUAServer;
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        await server.shutdown();
        server.dispose();
    });
    it("A- using default transport timeout", async () => {
        const endpointUrl = server.getEndpointUrl();
        const client = OPCUAClient.create({});
        const spyConnectionLost = sinon.spy();
        const spyClose = sinon.spy();
        const spyConnectionReestablished = sinon.spy();
        client.on("connection_lost", spyConnectionLost);
        client.on("close", spyClose);
        client.on("connection_reestablished", spyConnectionReestablished);
        const actualTimeout = await client.withSessionAsync<number>(endpointUrl, async (session) => {
            const timeout = (client as any)._secureChannel!._transport.timeout;
            const socket = (client as any)._secureChannel!._transport._socket as NodeJS.Socket;
            socket.on("timeout", () => console.log("socket timeout"));
            return timeout;
        });
        actualTimeout.should.eql(ClientSecureChannelLayer.defaultTransportTimeout);
        spyClose.callCount.should.eql(1);
        spyConnectionLost.callCount.should.eql(0);
        spyConnectionReestablished.callCount.should.eql(0);
    });
    it("B- should be possible to set the transport timeout - no automatic reconnection", async () => {
        const endpointUrl = server.getEndpointUrl();

        const transportTimeout = 1234;
        const client = OPCUAClient.create({
            transportTimeout,
            connectionStrategy: { maxRetry: 0 } // we don't want automatic reconnection => maxRetry = 0
        });
        client.on("backoff", () => console.log("keep trying", endpointUrl));
        client.on("connection_lost", () => console.log("connection lost"));
        client.on("connection_reestablished", () => console.log("connection_reestablished"));
        const spyConnectionLost = sinon.spy();
        const spyClose = sinon.spy();
        const spyConnectionReestablished = sinon.spy();
        client.on("connection_lost", spyConnectionLost);
        client.on("close", spyClose);
        client.on("connection_reestablished", spyConnectionReestablished);

        const actualTimeout = await client.withSessionAsync(endpointUrl, async (session) => {
            const timeout = (client as any)._secureChannel!._transport.timeout;
            const socket = (client as any)._secureChannel!._transport._socket as NodeJS.Socket;
            socket.on("timeout", () => console.log("socket timeout"));

            console.log("timeout = ", timeout);
            console.log("connected");
            await new Promise((resolve) => setTimeout(resolve, transportTimeout + 4000));
            console.log("done");

            return (timeout as number) || 0;
        });
        actualTimeout.should.eql(transportTimeout);
        spyConnectionLost.callCount.should.eql(1);
        spyClose.callCount.should.eql(1);
        spyConnectionReestablished.callCount.should.eql(0);
    });

    it("C- should be possible to set the transport timeout - with automatic reconnection", async () => {
        const endpointUrl = server.getEndpointUrl();

        const transportTimeout = 1000;
        const client = OPCUAClient.create({
            transportTimeout,
            connectionStrategy: { maxRetry: 1 } // we WANT automatic reconnection => maxRetry <> 1
        });
        client.on("backoff", () => console.log("keep trying", endpointUrl));
        client.on("connection_lost", () => console.log("connection lost"));
        client.on("connection_reestablished", () => console.log("connection_reestablished"));
        const spyConnectionLost = sinon.spy();
        const spyClose = sinon.spy();
        const spyConnectionReestablished = sinon.spy();
        client.on("connection_lost", spyConnectionLost);
        client.on("close", spyClose);
        client.on("connection_reestablished", spyConnectionReestablished);

        const actualTimeout = await client.withSessionAsync(endpointUrl, async (session) => {
            const timeout = (client as any)._secureChannel!._transport.timeout;
            const socket = (client as any)._secureChannel!._transport._socket as NodeJS.Socket;
            socket.on("timeout", () => console.log("socket timeout"));

            console.log("timeout = ", timeout);
            console.log("connected");
            await new Promise((resolve) => setTimeout(resolve, transportTimeout + 8000));
            console.log("done");

            return (timeout as number) || 0;
        });
        actualTimeout.should.eql(transportTimeout);
        spyConnectionLost.callCount.should.be.greaterThan(2);
        spyConnectionReestablished.callCount.should.be.greaterThan(2);
        spyClose.callCount.should.eql(1);
        spyConnectionReestablished.callCount.should.be.greaterThan(2);
    });
});
