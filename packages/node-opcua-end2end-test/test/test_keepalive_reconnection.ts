
import {
    OPCUAClient,
    OPCUAClientOptions,
    OPCUAServer,
    SecurityPolicy,
    MessageSecurityMode,
    ClientSession
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import "should";
import * as net from "net";

const realServerPort = 2254;
const proxyPort = 2255;

describe("Testing keepSessionAlive and Reconnection", function (this: any) {
    this.timeout(40 * 1000); // Extended timeout for reconnection testing

    let server: OPCUAServer;
    let client: OPCUAClient;
    let session: ClientSession;

    let proxyServer: net.Server;
    let proxySockets: net.Socket[] = [];

    before(async () => {
        // Start Real Server
        server = new OPCUAServer({
            port: realServerPort,
            securityPolicies: [SecurityPolicy.None],
            securityModes: [MessageSecurityMode.None]
        });
        await server.start();

        // Start TCP Proxy
        proxyServer = net.createServer((clientSocket) => {
            const serverSocket = net.connect(realServerPort, "127.0.0.1", () => {
                clientSocket.pipe(serverSocket);
                serverSocket.pipe(clientSocket);
            });

            proxySockets.push(clientSocket);
            proxySockets.push(serverSocket);

            clientSocket.on("error", (err) => console.log("Proxy client socket error matching", err.message));
            serverSocket.on("error", (err) => console.log("Proxy server socket error matching", err.message));

            clientSocket.on("close", () => {
                const index = proxySockets.indexOf(clientSocket);
                if (index > -1) proxySockets.splice(index, 1);
            });
            serverSocket.on("close", () => {
                const index = proxySockets.indexOf(serverSocket);
                if (index > -1) proxySockets.splice(index, 1);
            });
        });

        await new Promise<void>((resolve) => proxyServer.listen(proxyPort, resolve));
    });

    after(async () => {
        if (client) {
            await client.disconnect();
        }
        await server.shutdown();

        proxySockets.forEach(s => s.destroy());
        proxyServer.close();
    });

    it("should trigger reconnection when keepSessionAlive fails", async () => {
        const connectOptions: OPCUAClientOptions = {
            endpointMustExist: false,
            keepSessionAlive: true,
            keepAliveInterval: 500, // Check every 500 ms
            defaultTransactionTimeout: 2000, // Short timeout for reads (2s)
            connectionStrategy: {
                maxRetry: -1, // Infinite retries
                initialDelay: 100,
                maxDelay: 2000
            }
        };

        client = OPCUAClient.create(connectOptions);

        let reconnectionStarted = false;
        let connectionReestablished = false;

        client.on("start_reconnection", () => {
            console.log("Reconnection started...");
            reconnectionStarted = true;

            // Once reconnection starts, we should unfreeze the proxy or let it proceed?
            // If we froze the proxy, the old connection is dead.
            // The client will try to reconnect. 
            // It will connect to proxyPort again.
            // Our proxy server is still running, so it should accept the new connection and create a new tunnel.
            // So we don't need to do anything specific, just ensure we don't freeze the NEW sockets.
        });

        client.on("connection_reestablished", () => {
            console.log("Connection reestablished!");
            connectionReestablished = true;
        });

        const endpointUrl = `opc.tcp://127.0.0.1:${proxyPort}`;
        await client.connect(endpointUrl);

        session = await client.createSession();

        let keepaliveFailureDetected = false;
        session.on("keepalive_failure", () => {
            console.log("Keepalive failure detected!");
            keepaliveFailureDetected = true;
        });

        // Wait for a couple of keep-alive cycles to ensure it's working
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("Simulating network freeze (silent drop)...");
        // Pause all current proxy sockets
        proxySockets.forEach(s => {
            s.pause(); // Stop reading
            s.unpipe(); // Stop piping
            // We don't destroy them, just let them hang.
            // This silences the connection.
        });

        // Wait for the client to detect failure and start reconnection
        // This might take: keepAliveInterval (500) + defaultTransactionTimeout (2000)
        // Give it 10s to be safe
        await new Promise(resolve => setTimeout(resolve, 10000));

        // keepaliveFailureDetected SHOULD be true now, because we simulated a timeout.
        keepaliveFailureDetected.should.eql(true, "Keepalive failure should have been detected");

        reconnectionStarted.should.eql(true, "Client should have started reconnection");

        // allow some time for reconnection
        await new Promise(resolve => setTimeout(resolve, 3000));

        connectionReestablished.should.eql(true, "Client should have reestablished connection");

        // ensure session is still usable (or repaired)
        const isClosed = (session as any).hasBeenClosed();
        console.log("Session closed?", isClosed);

        // Clean up
        await session.close();
    });
});
