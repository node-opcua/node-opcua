import net from "node:net";
import { OPCUAClient } from "node-opcua-client";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { OPCUAServer, type OPCUAServerOptions } from "../source/index.js";
import { createServerCertificateManager } from "./create_server_certificate_manager.js";

const port1 = 5856;
const port2 = 5857;
const port3 = 5858;
const host1 = "127.0.0.1";
const host2 = "127.0.0.2";

/** true when this machine can bind a socket on `host` (Linux routes all of 127.0.0.0/8 to lo); probes on port3, which no listener of this test holds yet */
async function canBind(host: string): Promise<boolean> {
    return new Promise((resolve) => {
        const s = net.createServer();
        s.once("error", () => resolve(false));
        s.listen(port3, host, () => s.close(() => resolve(true)));
    });
}

/** resolves true when a TCP connection to host:port is accepted */
async function tcpReachable(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.connect({ host, port });
        socket.setTimeout(2000);
        socket.once("connect", () => {
            socket.destroy();
            resolve(true);
        });
        socket.once("error", () => resolve(false));
        socket.once("timeout", () => {
            socket.destroy();
            resolve(false);
        });
    });
}

function listenAddress(server: OPCUAServer, index: number): net.AddressInfo {
    const tcp = (server.endpoints[index] as unknown as { _server?: net.Server })._server;
    return tcp?.address() as net.AddressInfo;
}

async function makeServer(port: number, options: OPCUAServerOptions): Promise<OPCUAServer> {
    const serverCertificateManager = await createServerCertificateManager(port);
    const server = new OPCUAServer({ serverCertificateManager, nodeset_filename: [nodesets.standard], ...options });
    await server.initialize();
    await server.start();
    return server;
}

describe("OPCUAServer endpoints[]: each entry listens on its own host", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 60000));

    it("binds each listener to the host of its entry", async function (this: Mocha.Context) {
        if (!(await canBind(host2))) {
            console.log(`      skipped: cannot bind ${host2} on this machine (needs a second loopback address)`);
            this.skip();
        }
        const server = await makeServer(port1, {
            host: "0.0.0.0", // top-level fallback, must be overridden by each entry
            endpoints: [
                { port: port1, host: host1, hostname: "localhost" },
                { port: port2, host: host2, hostname: "localhost" }
            ]
        });
        try {
            should(listenAddress(server, 0)).containEql({ address: host1, port: port1 });
            should(listenAddress(server, 1)).containEql({ address: host2, port: port2 });

            (await tcpReachable(host1, port1)).should.eql(true, "entry 1 on its own host");
            (await tcpReachable(host2, port2)).should.eql(true, "entry 2 on its own host");
            (await tcpReachable(host1, port2)).should.eql(false, "entry 2 must not listen on entry 1's host");
            (await tcpReachable(host2, port1)).should.eql(false, "entry 1 must not listen on entry 2's host");

            // and it is a working OPC UA listener
            const client = OPCUAClient.create({ endpointMustExist: false, connectionStrategy: { maxRetry: 0 } });
            await client.connect(`opc.tcp://${host2}:${port2}`);
            const endpoints = await client.getEndpoints();
            endpoints.length.should.be.greaterThan(0);
            await client.disconnect();
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });

    it("keeps the top-level host as the fallback for an entry without host", async () => {
        const server = await makeServer(port3, {
            host: host1,
            endpoints: [{ port: port3, hostname: "localhost" }]
        });
        try {
            should(listenAddress(server, 0)).containEql({ address: host1, port: port3 });
        } finally {
            await server.shutdown();
            server.dispose();
        }
    });
});
