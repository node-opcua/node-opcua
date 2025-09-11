/*
 * attempt a DoS attack on Server by consuming SecureChannels and NOT using them.
 */
import "should";
import path from "path";
import { spawn } from "child_process";
import sinon from "sinon";
import chalk from "chalk";
import {
    is_valid_endpointUrl,
    MessageSecurityMode,
    SecurityPolicy,
    OPCUAServer,
    OPCUAClient,
    ClientSecureChannelLayer,
    ClientSession
} from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const fail_fast_connectionStrategy = { maxRetry: 0 };
const maxConnectionsPerEndpoint = 3;
const maxSessions = 10000;
const port = 2001;

describe("testing Server resilience to DDOS attacks", function () {
    // extend mocha timeout for long channel churn
    // @ts-ignore mocha context
    this.timeout(30000);

    let server: OPCUAServer;
    let endpointUrl: string;
    let clients: OPCUAClient[] = [];
    let sessions: any[] = [];
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
                try { await s.close(); } catch { /* ignore */ }
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
                serverCertificate: null as any,
                connectionStrategy: { maxRetry: 0 }
            });
            try {
                await new Promise<void>((resolve, reject) => 
                    ch.create(endpointUrl, (err) => err ? reject(err) : resolve()));
            } catch (err) {
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
                    ch.close((err) => (err) ? reject(err) : resolve());
                });
            } catch {
                nbError++;
            }
        }
        // step3 verify (#errors == nbExtra)
        nbError.should.eql(nbExtra);
    });

    let clientCounter = 1;
    async function createClientAndSession(index: number) {
        const client = OPCUAClient.create({ connectionStrategy: fail_fast_connectionStrategy });
        (client as any).name = "client" + clientCounter++;
        clients.push(client);
        // small stagger
        await new Promise(r => setTimeout(r, 10));
        try {
            await client.connect(endpointUrl);
            try {
                const session = await client.createSession();
                sessions.push(session);
            } catch {
                // ignore
            }
        } catch (err) {
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
            try { await s.close(); } catch { nbError++; }
        }
        // disconnect clients
        for (const c of clients) {
            try { await c.disconnect(); } catch { nbError++; }
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
            const sc: any = (client as any)._secureChannel;
            if (sc) {
                try {
                    const socket = sc.getTransport()._socket;
                    socket.end();
                    socket.destroy();
                    socket.emit("error", new Error("Terminate"));
                } catch { /* ignore */ }
            }
        }
        rejected_connections.should.eql(5);
        // attempt again to fill more
        for (let i = 0; i < nbConnections; i++) {
            await createClientAndSession(i + 1000);
        }
        rejected_connections.should.eql(10);
        // cleanup
        for (const s of sessions) { try { await s.close(); } catch { /* ignore */ } }
        for (const c of clients) { try { await c.disconnect(); } catch { /* ignore */ } }
    });

    it("ZAA5 Server shall not keep channel that have been disconnected abruptly - version 2", async () => {
        const serverEndpoint: any = (server as any).endpoints[0];
        const spyCloseChannel = sinon.spy();
        const spyNewChannel = sinon.spy();
        serverEndpoint.on("closeChannel", spyCloseChannel);
        serverEndpoint.on("newChannel", spyNewChannel);

        let launches = 0;
        async function launchCrashingClient() {
            launches++;
            const server_script = path.join(__dirname, "../dist/test_helpers/crashing_client");
            await new Promise<void>((resolve) => {
                const child = spawn("node", [server_script, String(port)], {});
                child.on("close", () => resolve());
                child.stdout.on("data", (data) => {
                    data.toString().split("\n").forEach((line: string) => {
                        if (line.trim().length) process.stdout.write("                 " + chalk.yellow(line) + "\n");
                    });
                });
            });
        }

        async function verifyChannelCount() {
            await new Promise(r => setTimeout(r, 350));
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
