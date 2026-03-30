/*
 * attempt a DoS attack on Server by repeatedly creating secure channel connections with invalid parameters
 */
import path from "node:path";
import chalk from "chalk";
import {
    AttributeIds,
    is_valid_endpointUrl,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAServer,
    SecurityPolicy,
    ServerSecureChannelLayer
} from "node-opcua";
import { exploreCertificateInfo, readCertificateChainAsync, readCertificateRevocationList } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// -----------------------------------------------------------------------------
// Constants & Shared Helpers
// -----------------------------------------------------------------------------
const fail_fast_connectionStrategy = { maxRetry: 0 }; // disable automatic retry to simulate aggressive clients
const certificateFolder = path.join(__dirname, "../../node-opcua-samples/certificates");
const port = 2019;

function delay(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

interface IWithThrottleTime {
    throttleTime: number;
}

describe("testing Server resilience to DDOS attacks 2", function () {
    // @ts-expect-error mocha context
    this.timeout(Math.max(30000000, this.timeout()));

    const invalidCertificateFile = path.join(certificateFolder, "client_cert_2048_outofdate.pem");
    const validCertificate = path.join(certificateFolder, "client_cert_2048.pem");
    const privateKeyFile = path.join(certificateFolder, "client_key_2048.pem");

    let server: OPCUAServer;
    let endpointUrl: string;
    const maxConnectionsPerEndpoint = 3;
    const maxSessions = 10000;
    let _clients: OPCUAClient[] = [];
    let _sessions: unknown[] = [];
    let _rejected_connections = 0;
    const remotePorts: Record<number, number> = {};
    function register(remotePort: number) {
        if (!remotePorts[remotePort]) {
            remotePorts[remotePort] = 1;
        } else {
            console.log(chalk.red("Port has been recycled"), remotePort);
            remotePorts[remotePort] += 1;
        }
    }
    // Speed up tests: reduce handshake throttle so channels are created rapidly
    const serverSecureChannelLayerEx = ServerSecureChannelLayer as unknown as IWithThrottleTime;
    const originalThrottle = serverSecureChannelLayerEx.throttleTime;
    before(() => {
        serverSecureChannelLayerEx.throttleTime = 1;
    });
    after(() => {
        serverSecureChannelLayerEx.throttleTime = originalThrottle;
    });

    beforeEach(async () => {
        // Reset state between tests
        _clients = [];
        _sessions = [];
        _rejected_connections = 0;
        const serverCertificateManager = await createServerCertificateManager(port);

        const certChain = await readCertificateChainAsync(validCertificate);
        const firstCert = certChain[0];
        await serverCertificateManager.trustCertificate(firstCert);

        // Minimal server with a restricted number of secure channels to stress limits
        server = new OPCUAServer({
            port,
            maxConnectionsPerEndpoint,
            serverCapabilities: { maxSessions },
            serverCertificateManager
        });

        // ---------------------------------------------------------------------
        // Trust chain preparation (issuer + CRL) so that server evaluates client certs fully
        // ---------------------------------------------------------------------
        const issuerCertificateFile = path.join(certificateFolder, "CA/public/cacert.pem");
        const revokeListFile = path.join(certificateFolder, "CA/crl/revocation_list.crl");

        const issuerCertificateChain = await readCertificateChainAsync(issuerCertificateFile);

        for (let i = 0; i < issuerCertificateChain.length; i++) {
            const issuerCertificate = issuerCertificateChain[i];
            exploreCertificateInfo(issuerCertificate); // parsed just for side-effect/validation
            const status = await server.serverCertificateManager.addIssuer(issuerCertificate);
            if (status !== "Good" && status !== "BadCertificateUntrusted") {
                console.log("status = ", status);
                throw new Error("Invalid issuer files");
            }
        }

        const crl = await readCertificateRevocationList(revokeListFile);
        server.serverCertificateManager.addRevocationList(crl);

        await server.start();
        const epd = server.endpoints[0].endpointDescriptions()[0];
        endpointUrl = epd.endpointUrl || "";
        is_valid_endpointUrl(endpointUrl).should.equal(true);

        // Instrumentation: track lifecycle events to ensure channels close / recycle
        server.on("connectionError", () => console.log("connectionError"));

        server.on("newChannel", (channel) => {
            console.log(">newChannel =>", channel.remotePort, channel.remoteAddress);
            register(channel.remotePort);
        });
        server.on("closeChannel", (channel) => {
            console.log("<closeChannel =>", channel.remotePort, channel.remoteAddress);
        });

        server.on("connectionRefused", (socketData) => {
            register(socketData.remotePort || 0);
            console.log("Connection refused", JSON.stringify(socketData));
        });
        server.on("openSecureChannelFailure", (socketData, channelData) => {
            if (doDebug) {
                console.log(
                    "openSecureChannelFailure",
                    JSON.stringify(socketData),
                    channelData.securityPolicy,
                    MessageSecurityMode[channelData.securityMode]
                );
            }
            register(socketData.remotePort || 0);
        });
    });

    afterEach(async () => {
        await server.shutdown();
    });

    it("ZCCC1 should ban client that constantly reconnect", async () => {
        // Placeholder test - behavior depends on server rate limiting implementation.
        console.log("done");
    });

    it("ZCCC2 should ban client that constantly reconnect with an invalid certificate (out of date)", async () => {
        // Attempt multiple rapid connections using an out-of-date client certificate
        const serverCertificateChain = await readCertificateChainAsync(server.certificateFile);

        const localClients: OPCUAClient[] = [];
        for (let i = 0; i < 10; i++) {
            try {
                const client = OPCUAClient.create({
                    endpointMustExist: false,
                    connectionStrategy: fail_fast_connectionStrategy,
                    securityPolicy: SecurityPolicy.Basic256Sha256,
                    securityMode: MessageSecurityMode.SignAndEncrypt,
                    defaultSecureTokenLifetime: 100000,
                    certificateFile: invalidCertificateFile,
                    privateKeyFile,
                    serverCertificate: serverCertificateChain[0]
                });
                localClients.push(client);
                await client.connect(endpointUrl);
                client.createSession();
            } catch (err) {
                console.log((err as Error).message);
            }
        }
        for (const c of localClients) {
            try {
                await c.disconnect();
            } catch {
                /* ignore */
            }
        }

        debugLog("new try to connect with a valid certificate => It should work");
        const client = OPCUAClient.create({
            endpointMustExist: false,
            connectionStrategy: fail_fast_connectionStrategy,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            securityMode: MessageSecurityMode.SignAndEncrypt,
            defaultSecureTokenLifetime: 100000,
            certificateFile: validCertificate,
            privateKeyFile
        });
        await client.connect(endpointUrl);
        const session = await client.createSession();
        await session.close();
        await client.disconnect();
        console.log("----- Well done!");
    });
});

describe("testing Server resilience to DDOS attacks - ability to recover", () => {
    let connectionRefusedCount = 0;
    const requestedSessionTimeout = 3000;
    let server: OPCUAServer;

    async function startServer() {
        connectionRefusedCount = 0;
        const server = new OPCUAServer({ port, serverCapabilities: { maxSessions: 4 }, maxConnectionsPerEndpoint: 3 });
        await server.start();
        server.on("openSecureChannelFailure", (socketData, channelData) => {
            console.log("openSecureChannelFailure", JSON.stringify(socketData), channelData.channelId);
        });
        server.on("connectionRefused", (socketData, endpointData) => {
            console.log("connectionRefused", JSON.stringify(socketData), endpointData.toString());
            connectionRefusedCount++;
        });
        return server;
    }
    async function extractServerCertificate(server: OPCUAServer) {
        return await readCertificateChainAsync(server.certificateFile);
    }
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        await server.shutdown();
    });

    const clientsToClose: OPCUAClient[] = [];
    const promises: Promise<unknown>[] = [];

    afterEach(async () => {
        for (const c of clientsToClose) {
            try {
                await c.disconnect();
            } catch {
                /* ignore */
            }
        }
        await Promise.all(promises);
    });

    async function simulateDDOSAttack() {
        const serverCertificate = await extractServerCertificate(server);
        async function attack(i: number) {
            try {
                const client = OPCUAClient.create({
                    serverCertificate,
                    requestedSessionTimeout,
                    connectionStrategy: { maxRetry: 0 },
                    clientName: `RogueClient${i}!!`
                });
                clientsToClose.push(client);
                client.on("backoff", (nbRetry) => console.log("backoff", i, nbRetry));
                await client.connect(server.getEndpointUrl());
                await client.createSession();
            } catch (err) {
                console.log(chalk.bgRed("!!!!!!!!!!!! CONNECTION ERROR = RogueClient", i, (err as Error).message));
            }
        }
        // Launch a burst of rogue clients in parallel
        for (let i = 0; i < 10; i++) {
            promises.push(attack(i));
        }
    }

    async function normalClientConnection(i?: number) {
        try {
            const client = OPCUAClient.create({
                requestedSessionTimeout: 500,
                connectionStrategy: { maxRetry: 0 },
                clientName: `NormalClient${i ?? ""}!!`
            });
            await client.connect(server.getEndpointUrl());
            try {
                const session = await client.createSession();
                const dataValue = await session.read({ nodeId: "i=2258", attributeId: AttributeIds.Value });
                console.log(dataValue.toString());
                await session.close();
            } finally {
                await client.disconnect();
            }
        } catch {
            return false;
        }
        return true;
    }

    it("ZCCC4 should eventually allow connection again after a DDOS attack", async () => {
        // WHEN a DDOS wave floods the server with rogue sessions
        await simulateDDOSAttack();
        // WAIT until first refusal observed (server begins defense)
        await new Promise((resolve) => server.once("connectionRefused", () => resolve(null)));
        await delay(requestedSessionTimeout / 10);
        console.log(chalk.bgYellowBright("========================================================================"));
        connectionRefusedCount.should.be.greaterThanOrEqual(1);
        // THEN an immediate legitimate connection attempt may still fail (not asserted strictly here)
        const _success1 = await normalClientConnection();
        // EVENTUALLY after rogue sessions timeout, normal client must succeed
        await delay(requestedSessionTimeout * 3);
        const success2 = await normalClientConnection();
        should(success2).eql(true, "expecting client to be able to connect again");
    });
});
