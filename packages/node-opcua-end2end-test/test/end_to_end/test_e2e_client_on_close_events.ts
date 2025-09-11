import "should";
import sinon from "sinon";
import { OPCUAClient, OPCUAServer, nodesets } from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("testing Client-Server - Event", function (this: Mocha.Context) {
    this.timeout(Math.max(600000, this.timeout()));

    const port = 2013;
    let server: OPCUAServer | null = null;
    let endpointUrl: string = "";

    async function start_server() {
        server = new OPCUAServer({
            port,
            nodeset_filename: (nodesets as any).ua, // original test used nodesets.ua
            serverCapabilities: { maxSessions: 10 }
        });
        await server.start();
        endpointUrl = server.getEndpointUrl();
        if (doDebug) debugLog("Server started at", endpointUrl);
    }

    async function end_server() {
        if (server) {
            await server.shutdown();
            server = null;
        }
    }

    it("TSC-1 should raise a close event once on normal disconnection", async () => {
        let close_counter = 0;
        const client = OPCUAClient.create({});
        client.on("close", (err: Error | null) => {
            if (err) {
                // Should not happen for client-initiated disconnect
                err.message.should.not.match(/.*/); // force failure if triggered
            }
            close_counter++;
        });
        debugLog(" --> Starting server");
        await start_server();
        try {
            debugLog(" --> Connecting Client");
            await client.connect(endpointUrl);
            close_counter.should.eql(0);
            debugLog(" --> Disconnecting Client");
            await client.disconnect();
            close_counter.should.eql(1);
        } finally {
            debugLog(" --> stopping server");
            await end_server();
        }
    });

    it("TSC-2 client (not reconnecting) should raise a close event with an error when server initiates disconnection", async () => {
        const options = {
            connectionStrategy: { maxRetry: 0, initialDelay: 10, maxDelay: 20, randomisationFactor: 0 }
        };
        const client = OPCUAClient.create(options);
        const closeSpy = sinon.spy();
        client.on("close", closeSpy);
        debugLog(" --> Starting server");
        await start_server();
        debugLog(" --> Connecting Client");
        await client.connect(endpointUrl);
        closeSpy.callCount.should.eql(0);
        debugLog(" --> Stopping server");
        await end_server();
        await new Promise((r) => setTimeout(r, 1000));
        closeSpy.callCount.should.eql(1);
        closeSpy.getCall(0).args.length.should.eql(1);
        (closeSpy.getCall(0).args[0] as Error).should.not.eql(null);
        (closeSpy.getCall(0).args[0] as Error).message.should.match(/disconnected by third party/);
        await client.disconnect();
        closeSpy.callCount.should.eql(1); // no additional close event
    });

    it("TSC-3 client (reconnecting) should raise a close event with error after failing to reconnect", async () => {
        const options = {
            connectionStrategy: { initialDelay: 100, maxDelay: 200, maxRetry: 1, randomisationFactor: 0 }
        };
        const client = OPCUAClient.create(options);
        const closeSpy = sinon.spy();
        const backoffSpy = sinon.spy();
        client.on("close", closeSpy);
        client.on("backoff", backoffSpy);
        client.on("backoff", () => {
            debugLog("client.on('backoff'): attempting reconnect isReconnecting=", (client as any).isReconnecting);
        });
        client.on("close", (err: Error | null) => {
            debugLog("client 'close' event", err ? err.message : null);
        });
        debugLog(" 1--> Starting server");
        await start_server();
        debugLog(" 2--> Connecting Client");
        await client.connect(endpointUrl);
        closeSpy.callCount.should.eql(0);
        debugLog(" 3 -> Stopping server (abrupt)");
        await new Promise<void>((resolve) => {
            client.once("connection_lost", () => {
                debugLog(" )> received connection_lost event");
                setImmediate(() => resolve());
            });
            debugLog(" 4 --> Stopping server");
            end_server().then(() => debugLog(" 5 --> Server stopped"));
        });
        debugLog(" 6 --> client detected server shutdown; waiting for reconnect attempts");
        await new Promise((r) => setTimeout(r, 10000));
        ((client as any).isReconnecting).should.eql(true);
        debugLog(" 7 --> disconnecting client (while reconnecting)");
        await client.disconnect();
        debugLog(" 8 --> client disconnected");
        backoffSpy.callCount.should.be.greaterThan(0);
        closeSpy.callCount.should.eql(1);
        const err = closeSpy.getCall(0).args[0] as Error;
        err.should.be.instanceOf(Error);
        err.message.should.match(/Reconnection has been canceled/);
    });
});
