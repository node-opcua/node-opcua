"use strict";

const should = require("should");
const sinon = require("sinon");

const { OPCUAClient, OPCUAServer, nodesets } = require("node-opcua");

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client-Server - Event", function () {
    this.timeout(Math.max(600000, this.timeout()));

    const port = 2013;
    let server;
    let endpointUrl;

    async function start_server(done) {
        server = new OPCUAServer({
            port,
            nodeset_filename: nodesets.ua,
            serverCapabilities: { maxSessions: 10 }
        });

        await server.start();
        endpointUrl = server.getEndpointUrl();
    }
    async function end_server() {
        if (server) {
            await server.shutdown();
            server = null;
        }
    }

    it("TSC-1 should raise a close event once on normal disconnection", async () => {
        let close_counter = 0;

        const client = OPCUAClient.create();
        client.on("close", function (err) {
            /*
                        console.log(err);
                        console.log(new Error("Here I am"));
            */
            should.not.exist(err, "No error shall be transmitted when client initiates the disconnection");
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
        // note : client is not trying to reconnect
        const options = {
            connectionStrategy: {
                maxRetry: 0, // <= no retry
                initialDelay: 10,
                maxDelay: 20,
                randomisationFactor: 0
            }
        };
        const client = OPCUAClient.create(options);

        const _client_received_close_event = sinon.spy();
        client.on("close", _client_received_close_event);

        debugLog(" --> Starting server");
        await start_server();
        debugLog(" --> Connecting Client");
        await client.connect(endpointUrl);

        _client_received_close_event.callCount.should.eql(0);
        debugLog(" --> Stopping server");
        await end_server();

        await new Promise((resolve) => setTimeout(resolve, 1000));

        _client_received_close_event.callCount.should.eql(1);
        _client_received_close_event.getCall(0).args.length.should.eql(1);
        should(_client_received_close_event.getCall(0).args[0]).not.eql(null);
        _client_received_close_event.getCall(0).args[0].message.should.match(/disconnected by third party/);

        await client.disconnect();
        _client_received_close_event.callCount.should.eql(1);
        _client_received_close_event.getCall(0).args.length.should.eql(1);
        should(_client_received_close_event.getCall(0).args[0]).not.eql(null);
        _client_received_close_event.getCall(0).args[0].message.should.match(/disconnected by third party/);
    });

    it("TSC-3 client (reconnecting)  should raise a close event with an error when server initiates disconnection (after reconnecting has failed)", async () => {
        // note : client will  try to reconnect and eventually fail ...
        const options = {
            connectionStrategy: {
                initialDelay: 100,
                maxDelay: 200,
                maxRetry: 1, // <= RETRY
                randomisationFactor: 0
            }
        };
        const client = OPCUAClient.create(options);

        const _client_received_close_event = sinon.spy();
        client.on("close", _client_received_close_event);

        const _client_backoff_event = sinon.spy();
        client.on("backoff", _client_backoff_event);

        client.on("backoff", () => {
            debugLog("client.on('backoff'): client is attempting to connect", "isReconnecting=", client.isReconnecting);
        });

        client.on("close", function (err) {
            debugLog(" 8 --> client has sent 'close' event", err ? err.message : null);
        });

        debugLog(" 1--> Starting server");
        await start_server();

        debugLog(" 2--> Connecting Client");
        await client.connect(endpointUrl);
        _client_received_close_event.callCount.should.eql(0);

        debugLog(" 3 -> Stopping server  and wait for client to detect that server has shutdown abruptly");
        await new Promise((resolve, reject) => {
            client.once("connection_lost", () => {
                debugLog(" )> received connection_lost event");
                setImmediate(() => resolve());
            });
            debugLog(" 4 --> Stopping server");
            end_server().then(() => {
                debugLog(" 5 --> Server stopped");
            });
        });

        debugLog("  6 --> client has detected that server has shutdown abruptly");
        debugLog("        and will try to reconnect");
        // wait for client to attempt to reconnect
        debugLog("  7 ---> now waiting for client to attempt to reconnect");
        await new Promise((resolve) => setTimeout(resolve, 10000));
        client.isReconnecting.should.eql(true);
        debugLog("  6 --> client now reconnecting");

        // let's give client some time to attempt a reconnection
        debugLog(" 6--> disconnecting client (while reconnecting, but server not present)");
        await client.disconnect();
        debugLog(" 8 --> client has been disconnected");
    
        _client_backoff_event.callCount.should.be.greaterThan(0);
        _client_received_close_event.callCount.should.eql(1); // TO CHECK
        should.exist(_client_received_close_event.getCall(0).args[0], "expecting an error in the close event");
        _client_received_close_event.getCall(0).args[0].message.should.match(/Reconnection has been canceled/);
    });
});
