import "should";
import {
    AttributeIds,
    ClientReverseConnect,
    get_mini_nodeset_filename,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAServer,
    SecurityPolicy,
    StatusCodes
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { createServerCertificateManager } from "../../test_helpers/createServerCertificateManager";
import { wait } from "../../test_helpers/utils";

// RC-E2E-3 — secured reverse connect (SignAndEncrypt / Basic256Sha256).
//
// A reverse-connect client cannot dial the server to fetch its certificate, so for a secured channel
// the server certificate must be supplied up front. We assert both directions:
//   * positive: supplying the serverCertificate up front -> connectReverse + session read succeeds;
//   * negative: omitting it -> the attempt fails cleanly (rejects) rather than hanging.

// reserved reverse-connect range — see ./README.md
const serverAPort = 2403;
const reverseListenAPort = 5603;
const clientPkiAPort = 2405;
const serverBPort = 2404;
const reverseListenBPort = 5604;
const clientPkiBPort = 2406;

interface SecureSetup {
    server: OPCUAServer;
    reverseConnect: ClientReverseConnect;
    cleanup: () => Promise<void>;
}

async function makeSecureReverseServer(port: number, listenPort: number): Promise<SecureSetup> {
    const reverseListenUrl = `opc.tcp://127.0.0.1:${listenPort}`;
    const reverseConnect = new ClientReverseConnect(reverseListenUrl);

    // starting the listener and generating the server certificate are independent — do them in parallel
    const [, serverCertificateManager] = await Promise.all([reverseConnect.start(), createServerCertificateManager(port)]);
    const server = new OPCUAServer({
        port,
        serverCertificateManager,
        nodeset_filename: [get_mini_nodeset_filename()],
        securityPolicies: [SecurityPolicy.Basic256Sha256],
        securityModes: [MessageSecurityMode.SignAndEncrypt],
        reverseConnect: {
            connections: [{ endpointUrl: reverseListenUrl }],
            reconnectDelay: 500
        }
    });
    await server.initialize();
    await server.start();

    return {
        server,
        reverseConnect,
        cleanup: async () => {
            await server.shutdown();
            server.dispose();
            await reverseConnect.stop();
        }
    };
}

describe("ReverseConnect - secured end-to-end (RC-E2E-3)", function (this: Mocha.Suite) {
    this.timeout(40000);

    it("RC-E2E-3a succeeds with SignAndEncrypt when the server certificate is supplied up front", async () => {
        const { server, reverseConnect, cleanup } = await makeSecureReverseServer(serverAPort, reverseListenAPort);
        // an auto-accepting certificate store for the client's own certificate / trust list
        // (the number only discriminates the PKI folder, but keep it inside the reserved range too)
        const clientCertificateManager = await createServerCertificateManager(clientPkiAPort);
        try {
            const client = OPCUAClient.create({
                clientName: `reverse-secure ${__filename}`,
                endpointMustExist: false,
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256,
                serverCertificate: server.getCertificate(),
                clientCertificateManager,
                // bound the retries so a mis-setup fails the test fast instead of looping forever
                connectionStrategy: { maxRetry: 1, initialDelay: 300, maxDelay: 600 }
            });

            await client.connectReverse(reverseConnect, { serverUri: server.serverInfo.applicationUri! });
            const session = await client.createSession();
            try {
                const dv = await session.read({ nodeId: "i=2258", attributeId: AttributeIds.Value });
                dv.statusCode.should.eql(StatusCodes.Good);
            } finally {
                await session.close();
                await client.disconnect();
            }
        } finally {
            await cleanup();
        }
    });

    it("RC-E2E-3b fails cleanly (does not hang) when the server certificate is omitted", async () => {
        const { server, reverseConnect, cleanup } = await makeSecureReverseServer(serverBPort, reverseListenBPort);
        const clientCertificateManager = await createServerCertificateManager(clientPkiBPort);
        try {
            const client = OPCUAClient.create({
                clientName: `reverse-secure-nocert ${__filename}`,
                endpointMustExist: false,
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256,
                // serverCertificate intentionally omitted: a secured reverse connect cannot proceed
                clientCertificateManager,
                connectionStrategy: { maxRetry: 2, initialDelay: 200, maxDelay: 400 }
            });

            let outcome: "resolved" | "rejected" | "hung" = "hung";
            try {
                await Promise.race([
                    (async () => {
                        await client.connectReverse(reverseConnect, { serverUri: server.serverInfo.applicationUri! });
                        await client.createSession();
                    })(),
                    wait(15000).then(() => {
                        throw new Error("__HANG__");
                    })
                ]);
                outcome = "resolved";
            } catch (err) {
                outcome = (err as Error).message === "__HANG__" ? "hung" : "rejected";
            }

            outcome.should.eql("rejected", "secured reverse connect without a server certificate must reject, not hang or succeed");
            await client.disconnect().catch(() => undefined);
        } finally {
            await cleanup();
        }
    });
});
