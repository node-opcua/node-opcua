import * as net from "node:net";

import "should";
import { AttributeIds, ClientReverseConnect, get_mini_nodeset_filename, OPCUAClient, OPCUAServer, StatusCodes } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { wait } from "../../test_helpers/utils.js";

// RC-E2E-2 — reverse-connect reconnection.
//
// The SERVER dials the CLIENT through a TCP proxy we control:
//     server ──► proxy(proxyPort) ──► client reverse listener(reverseListenPort)
// Destroying the proxy sockets drops the established reverse channel. We then assert that:
//   * the server re-dials (respecting reconnectDelay) and the client re-accepts it,
//   * the client session recovers (a read returns Good again), and
//   * the client NEVER calls fetchServerCertificate — in reverse mode it must not dial the server
//     directly to re-fetch the certificate (that guard lives in client_base_impl).

// reserved reverse-connect range — see test/reverse_connect/README.md
const serverPort = 2402;
const reverseListenPort = 5601;
const proxyPort = 5602;
const reverseListenUrl = `opc.tcp://127.0.0.1:${reverseListenPort}`;
const proxyUrl = `opc.tcp://127.0.0.1:${proxyPort}`;

describe("ReverseConnect - reconnection end-to-end (RC-E2E-2)", function (this: Mocha.Suite) {
    this.timeout(40000);

    let server: OPCUAServer;
    let reverseConnect: ClientReverseConnect;
    let proxyServer: net.Server;
    let proxySockets: net.Socket[] = [];

    before(async () => {
        reverseConnect = new ClientReverseConnect(reverseListenUrl);
        await reverseConnect.start();

        // proxy: the server dials proxyPort, we forward to the client's reverse listener
        proxyServer = net.createServer((fromServer) => {
            const toClient = net.connect(reverseListenPort, "127.0.0.1", () => {
                fromServer.pipe(toClient);
                toClient.pipe(fromServer);
            });
            fromServer.on("error", () => undefined);
            toClient.on("error", () => undefined);
            proxySockets.push(fromServer, toClient);
        });
        await new Promise<void>((resolve) => proxyServer.listen(proxyPort, "127.0.0.1", () => resolve()));

        server = new OPCUAServer({
            port: serverPort,
            nodeset_filename: [get_mini_nodeset_filename()],
            reverseConnect: {
                connections: [{ endpointUrl: proxyUrl }],
                reconnectDelay: 500
            }
        });
        await server.initialize();
        await server.start();
    });

    after(async () => {
        if (server) {
            await server.shutdown();
            server.dispose();
        }
        if (reverseConnect) {
            await reverseConnect.stop();
        }
        proxySockets.forEach((s) => {
            s.destroy();
        });
        if (proxyServer) {
            await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
        }
    });

    it("RC-E2E-2 re-accepts the server's redial after a channel drop without fetching the server certificate", async () => {
        const client = OPCUAClient.create({
            clientName: `reverse-reconnect test_e2e_reverse_connect_reconnection`,
            endpointMustExist: false,
            keepSessionAlive: true,
            keepAliveInterval: 1000,
            defaultTransactionTimeout: 3000,
            connectionStrategy: { maxRetry: -1, initialDelay: 200, maxDelay: 1000 }
        });

        // count outbound certificate dials: in reverse mode this must never happen on reconnection
        let fetchServerCertificateCount = 0;
        const clientAny = client as unknown as { fetchServerCertificate: (...args: unknown[]) => unknown };
        const originalFetch = clientAny.fetchServerCertificate.bind(client);
        clientAny.fetchServerCertificate = (...args: unknown[]) => {
            fetchServerCertificateCount += 1;
            return originalFetch(...args);
        };

        await client.connectReverse(reverseConnect, { serverUri: server.serverInfo.applicationUri! });
        const session = await client.createSession();

        try {
            const readCurrentTime = () => session.read({ nodeId: "i=2258", attributeId: AttributeIds.Value });

            // established: a read works
            (await readCurrentTime()).statusCode.should.eql(StatusCodes.Good);

            // drop the reverse channel by destroying the proxy tunnel
            const dropped = proxySockets;
            proxySockets = []; // new tunnel sockets (from the redial) get tracked separately
            dropped.forEach((s) => {
                s.destroy();
            });

            // the server re-dials through the proxy and the client re-accepts; the session must recover.
            // We prove recovery with a successful read (no dependence on internal event names).
            let recovered = false;
            const t0 = Date.now();
            while (Date.now() - t0 < 25000) {
                try {
                    const dv = await readCurrentTime();
                    if (dv.statusCode.value === StatusCodes.Good.value) {
                        recovered = true;
                        break;
                    }
                } catch {
                    /* channel is down mid-reconnect; retry */
                }
                await wait(300);
            }
            recovered.should.eql(true, "the reverse-connect session should recover after the channel drop");

            // the crux: reconnection must not have triggered an outbound certificate dial
            fetchServerCertificateCount.should.eql(0, "reverse reconnection must not call fetchServerCertificate");
        } finally {
            await session.close().catch(() => undefined);
            await client.disconnect().catch(() => undefined);
        }
    });
});
