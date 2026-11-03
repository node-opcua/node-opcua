/*
 * attempt a DoS attack on Server by consuming SecureChannels and NOT using them.
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import chalk from "chalk";
import {
    ApplicationDescription,
    ApplicationType,
    ClientSecureChannelLayer,
    type ClientSession,
    CreateSessionRequest,
    is_valid_endpointUrl,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAServer,
    SecurityPolicy
} from "node-opcua";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import sinon from "sinon";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager.js";
import { compiledHelper } from "../test_helpers/paths.js";

// _secureChannel (private impl field) and its transport's underlying raw socket (not part of
// the public IClientTransport surface) are reached here only to simulate an abrupt connection
// drop for fault injection.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
type InternalAny = any;

const debugLog = make_debugLog("TEST");
const _doDebug = checkDebugFlag("TEST");

const fail_fast_connectionStrategy = { maxRetry: 0 };
const maxConnectionsPerEndpoint = 3;
const maxSessions = 10000;
const port = 2001;

describe("testing Server resilience to DDOS attacks", function (this: Mocha.Context) {
    // extend mocha timeout for long channel churn
    this.timeout(120000);

    let server: OPCUAServer;
    let endpointUrl: string;
    let clients: OPCUAClient[] = [];
    let sessions: ClientSession[] = [];
    let rejected_connections = 0;

    beforeEach(async () => {
        clients = [];
        sessions = [];
        rejected_connections = 0;
        const serverCertificateManager = await createServerCertificateManager(port);
        server = new OPCUAServer({
            port,
            serverCertificateManager,
            maxConnectionsPerEndpoint,
            serverCapabilities: { maxSessions }
        });
        await server.start();
        endpointUrl = server.getEndpointUrl();
        debugLog("endpointUrl", endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);
    });

    afterEach(async () => {
        await server.shutdown();
    });

    it("ZAA1 should be possible to create many sessions per connection", async () => {
        const client = OPCUAClient.create({
            connectionStrategy: fail_fast_connectionStrategy
        });

        await client.connect(endpointUrl);

        const localSessions: ClientSession[] = [];

        try {
            for (let i = 0; i < 4; i++) {
                const session = await client.createSession();
                localSessions.push(session);
            }
        } finally {
            // close sessions
            for (const s of localSessions) {
                try {
                    await s.close();
                } catch {
                    /* ignore */
                }
            }
            await client.disconnect();
        }
    });

    it("ZAA2 When creating valid SecureChannel, prior unused channels should be recycled", async () => {
        // uncomment this line to run with external server
        //xx endpointUrl = "opc.tcp://" + os.hostname() + ":26543";

        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);
        const nbExtra = 5;
        const nbConnections = server.maxConnectionsPerEndpoint + nbExtra;
        const channels: ClientSecureChannelLayer[] = [];

        // step1 construct many channels
        for (let i = 0; i < nbConnections; i++) {
            const ch = new ClientSecureChannelLayer({
                defaultSecureTokenLifetime: 5_000_000,
                securityMode: MessageSecurityMode.None,
                securityPolicy: SecurityPolicy.None,
                // biome-ignore lint/suspicious/noExplicitAny: explicit null forces "fetch via GetEndpoints"; the option type only declares undefined
                serverCertificate: null as any,
                connectionStrategy: { maxRetry: 0 }
            });
            try {
                await new Promise<void>((resolve, reject) => ch.create(endpointUrl, (err) => (err ? reject(err) : resolve())));
            } catch (_err) {
                // ignore individual creation errors; still push channel for closing attempt
            }
            channels.push(ch);
        }

        console.log("nb channels = ", channels.length);
        // step2 close all channels
        let nbError = 0;
        for (const ch of channels) {
            try {
                await new Promise<void>((resolve, reject) => {
                    ch.close((err) => (err ? reject(err) : resolve()));
                });
            } catch {
                nbError++;
            }
        }
        // step3 verify (#errors == nbExtra)
        nbError.should.eql(nbExtra);
    });

    async function createClientAndSession(_index: number) {
        const client = OPCUAClient.create({ connectionStrategy: fail_fast_connectionStrategy });
        clients.push(client);
        // small stagger
        await new Promise((r) => setTimeout(r, 10));
        try {
            await client.connect(endpointUrl);
            try {
                const session = await client.createSession();
                sessions.push(session);
            } catch {
                // ignore
            }
        } catch (_err) {
            rejected_connections++;
        }
    }

    it("ZAA3 server should reject connections if all secure channels are used", async () => {
        const nbExtra = 5;
        const nbConnections = server.maxConnectionsPerEndpoint + nbExtra;
        for (let i = 0; i < nbConnections; i++) {
            await createClientAndSession(i);
        }
        let nbError = 0;
        // close sessions
        for (const s of sessions) {
            try {
                await s.close();
            } catch {
                nbError++;
            }
        }
        // disconnect clients
        for (const c of clients) {
            try {
                await c.disconnect();
            } catch {
                nbError++;
            }
        }
        nbError.should.eql(0);
        rejected_connections.should.eql(5);
        sessions.length.should.eql(server.maxConnectionsPerEndpoint);
    });

    it("ZAA4 Server shall not keep channel that have been disconnected abruptly", async () => {
        const nbExtra = 5;
        const nbConnections = server.maxConnectionsPerEndpoint + nbExtra;
        // build clients & sessions
        for (let i = 0; i < nbConnections; i++) {
            await createClientAndSession(i);
        }
        // abruptly terminate existing channels
        for (const client of clients) {
            const sc = (client as InternalAny)._secureChannel;
            if (sc) {
                try {
                    const socket = (sc.getTransport() as InternalAny)._socket;
                    socket.end();
                    socket.destroy();
                    socket.emit("error", new Error("Terminate"));
                } catch {
                    /* ignore */
                }
            }
        }
        rejected_connections.should.eql(5);
        // attempt again to fill more
        for (let i = 0; i < nbConnections; i++) {
            await createClientAndSession(i + 1000);
        }
        rejected_connections.should.eql(10);
        // cleanup
        for (const s of sessions) {
            try {
                await s.close();
            } catch {
                /* ignore */
            }
        }
        for (const c of clients) {
            try {
                await c.disconnect();
            } catch {
                /* ignore */
            }
        }
    });

    // Open a SecureChannel and send one CreateSession on it. Do not activate the Session.
    // A Session is attached to its channel during CreateSession, before ActivateSession, so
    // this leaves the channel with a created-but-unactivated Session.
    function createSessionOnly(client: OPCUAClient): Promise<void> {
        const request = new CreateSessionRequest({
            clientDescription: new ApplicationDescription({
                applicationUri: "urn:test:probe",
                applicationType: ApplicationType.Client
            }),
            endpointUrl,
            sessionName: "probe-" + crypto.randomBytes(4).toString("hex"),
            clientNonce: crypto.randomBytes(32),
            clientCertificate: undefined,
            requestedSessionTimeout: 600000,
            maxResponseMessageSize: 0
        });
        return new Promise<void>((resolve, reject) => {
            (
                client as unknown as {
                    performMessageTransaction(r: object, cb: (err: Error | null) => void): void;
                }
            ).performMessageTransaction(request, (err) => (err ? reject(err) : resolve()));
        });
    }

    it("ZAA6 a channel that carries only an unactivated session shall not block a new connection", async () => {
        // fill every slot with a created-but-unactivated session
        const held: OPCUAClient[] = [];
        for (let i = 0; i < server.maxConnectionsPerEndpoint; i++) {
            const client = OPCUAClient.create({ connectionStrategy: fail_fast_connectionStrategy });
            held.push(client);
            await client.connect(endpointUrl);
            await createSessionOnly(client);
        }

        // a further legitimate connection must still succeed: the oldest channel whose
        // sessions are all unactivated is reclaimed, so one slot becomes free.
        const late = OPCUAClient.create({ connectionStrategy: fail_fast_connectionStrategy });
        let connected = false;
        try {
            await late.connect(endpointUrl);
            connected = true;
        } catch {
            // refused: the weakness is present
        } finally {
            try {
                await late.disconnect();
            } catch {
                /* ignore */
            }
            for (const client of held) {
                try {
                    await client.disconnect();
                } catch {
                    /* ignore */
                }
            }
        }
        should(connected).eql(true);
    });

    it("ZAA5 Server shall not keep channel that have been disconnected abruptly - version 2", async () => {
        const serverEndpoint = server.endpoints[0];
        const spyCloseChannel = sinon.spy();
        const spyNewChannel = sinon.spy();
        serverEndpoint.on("closeChannel", spyCloseChannel);
        serverEndpoint.on("newChannel", spyNewChannel);

        let launches = 0;
        async function launchCrashingClient() {
            launches++;
            const server_script = compiledHelper("crashing_client");
            await new Promise<void>((resolve) => {
                const child = spawn("node", [server_script, String(port)], {});
                child.on("close", () => resolve());
                child.stderr.on("data", (data) => {
                    data.toString()
                        .split("\n")
                        .forEach((line: string) => {
                            if (line.trim().length) process.stderr.write(`                 ${chalk.red(line)}\n`);
                        });
                });
                child.stdout.on("data", (data) => {
                    data.toString()
                        .split("\n")
                        .forEach((line: string) => {
                            if (line.trim().length) process.stdout.write(`                 ${chalk.yellow(line)}\n`);
                        });
                });
            });
        }

        async function verifyChannelCount() {
            await new Promise((r) => setTimeout(r, 350));
            serverEndpoint.currentChannelCount.should.eql(0);
            spyNewChannel.callCount.should.eql(launches);
            spyCloseChannel.callCount.should.eql(launches);
        }

        await verifyChannelCount();
        for (let i = 0; i < 4; i++) {
            await launchCrashingClient();
            await verifyChannelCount();
        }
    });
});
