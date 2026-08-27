import * as net from "node:net";
import type { OPCUAServerEndPoint } from "node-opcua";
import { get_mini_nodeset_filename, OPCUAServer } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";

// reserved reverse-connect range — see test/reverse_connect/README.md
const serverPort = 2401;

/**
 * RC-SRV-1: direct tests of OPCUAServerEndPoint#createReverseConnection — the outbound dial that the
 * ReverseConnectManager drives. We exercise the two failure paths the hardening commit added:
 *   (a) the dial is time-bounded (a host that never completes the TCP handshake must not hang), and
 *   (b) a dial that connects while the endpoint is at maxConnections is rejected cleanly.
 */
describe("ReverseConnect - server endpoint createReverseConnection (RC-SRV)", function (this: Mocha.Suite) {
    this.timeout(20000);

    let server: OPCUAServer;

    before(async () => {
        server = new OPCUAServer({
            port: serverPort,
            nodeset_filename: [get_mini_nodeset_filename()]
        });
        await server.initialize();
        await server.start();
    });

    after(async () => {
        if (server) {
            await server.shutdown();
            server.dispose();
        }
    });

    it("RC-SRV-1a bounds the dial when the target host never completes the TCP handshake", async () => {
        const endpoint: OPCUAServerEndPoint = server.endpoints[0];
        // 192.0.2.1 is TEST-NET-1 (RFC 5737): not routable, so the SYN goes unanswered. Without the
        // connect-phase timeout the dial would hang for the OS default (~1-2 min); it must fail fast.
        const t0 = Date.now();
        const err = await new Promise<Error | null>((resolve) => {
            endpoint.createReverseConnection(
                "opc.tcp://192.0.2.1:4840",
                {
                    serverUri: server.serverInfo.applicationUri || "",
                    endpointUrl: server.getEndpointUrl(),
                    connectionTimeout: 500
                },
                (e) => resolve(e)
            );
        });
        should.exist(err);
        // bounded: it errored (timeout or unreachable), it did not hang for the OS default
        (Date.now() - t0).should.be.lessThan(5000);
    });

    it("RC-SRV-1c rejects a malformed client endpoint URL without dialing", async () => {
        const endpoint = server.endpoints[0];
        const err = await new Promise<Error | null>((resolve) => {
            endpoint.createReverseConnection(
                "not-a-valid-url",
                { serverUri: "urn:x", endpointUrl: server.getEndpointUrl(), connectionTimeout: 1000 },
                (e) => resolve(e)
            );
        });
        should.exist(err);
        err!.message.should.match(/endpoint url/i);
    });

    it("RC-SRV-1b rejects the dial when maxConnections is already reached", async () => {
        const endpoint = server.endpoints[0];
        // reach the private _channels bookkeeping (a plain object keyed by channel hash) to occupy a slot
        const channels = (endpoint as unknown as { _channels: Record<string, unknown> })._channels;

        // a throwaway server that ACCEPTS the TCP connection so the dial's "connect" fires and the
        // maxConnections guard runs
        const accepted: net.Socket[] = [];
        const blackhole = net.createServer((s) => {
            accepted.push(s);
            s.on("error", () => undefined);
        });
        // check-test-ports: dynamic-ok - a blackhole that absorbs connections; its port is read back, never fixed
        await new Promise<void>((resolve) => blackhole.listen(0, "127.0.0.1", () => resolve()));
        const blackholePort = (blackhole.address() as net.AddressInfo).port;

        const savedMax = endpoint.maxConnections;
        endpoint.maxConnections = 1;
        channels.__rc_srv_1_fake = {}; // occupy the single allowed slot
        try {
            const err = await new Promise<Error | null>((resolve) => {
                endpoint.createReverseConnection(
                    `opc.tcp://127.0.0.1:${blackholePort}`,
                    { serverUri: "urn:x", endpointUrl: server.getEndpointUrl(), connectionTimeout: 3000 },
                    (e) => resolve(e)
                );
            });
            should.exist(err);
            err!.message.should.match(/maxConnections/);
        } finally {
            delete channels.__rc_srv_1_fake;
            endpoint.maxConnections = savedMax;
            for (const s of accepted) {
                s.destroy();
            }
            await new Promise<void>((resolve) => blackhole.close(() => resolve()));
        }
    });
});
