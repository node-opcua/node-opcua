import { get_empty_nodeset_filename, is_valid_endpointUrl } from "node-opcua";
import { OPCUAClient } from "node-opcua-client";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { OPCUAServer } from "node-opcua-server";
import should from "should";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager.js";
import { ServerSideUnimplementedRequest } from "../test_helpers/unimplementedRequest.js";
import { wait } from "../test_helpers/utils.js";
// Initialize variables
const debugLog = make_debugLog("TEST");
const _doDebug = checkDebugFlag("TEST");
const empty_nodeset_filename = get_empty_nodeset_filename();
describe("testing Server resilience to unsupported request", function () {
    const port = 2990;
    let server;
    let client;
    let endpointUrl;
    let g_session;
    this.timeout(Math.max(20000, this.timeout()));
    before(async () => {
        const serverCertificateManager = await createServerCertificateManager(port);
        server = new OPCUAServer({
            port,
            serverCertificateManager,
            nodeset_filename: empty_nodeset_filename
        });
        client = OPCUAClient.create({});
        await server.start();
        // we will connect to first server end point
        endpointUrl = server.getEndpointUrl();
        debugLog("endpointUrl", endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);
        await client.connect(endpointUrl);
        g_session = await client.createSession();
    });
    after(async () => {
        await client.disconnect();
        await server.shutdown();
    });
    it("server should return a ServiceFault if receiving a unsupported MessageType", (done) => {
        const bad_request = new ServerSideUnimplementedRequest({}); // intentionally send a bad request
        g_session.performMessageTransaction(bad_request, (err) => {
            should(err).be.instanceOf(Error);
            done();
        });
    });
});
async function abruptly_disconnect_client(client) {
    await new Promise((resolve) => {
        client._secureChannel.getTransport().disconnect((err) => {
            err ? resolve() : resolve();
        });
    });
}
describe("testing Server resilience with bad internet connection", function () {
    let server;
    let client;
    let endpointUrl;
    const port = 2991;
    this.timeout(Math.max(20000, this.timeout()));
    before(async () => {
        const serverCertificateManager = await createServerCertificateManager(port);
        server = new OPCUAServer({ port, serverCertificateManager, nodeset_filename: empty_nodeset_filename });
        await server.start();
        endpointUrl = server.getEndpointUrl();
    });
    after(async () => {
        await server.shutdown();
    });
    it("server should discard session from abruptly disconnected client after the timeout has expired", async () => {
        // ask for a very short session timeout
        client = OPCUAClient.create({ requestedSessionTimeout: 200 });
        // assert that server has 0 session
        server.currentSessionCount.should.eql(0);
        // connect
        await client.connect(endpointUrl);
        try {
            // create session
            const session = await client.createSession();
            session.timeout.should.eql(client.requestedSessionTimeout);
            // assert that server has 1 sessions
            server.currentSessionCount.should.eql(1);
            await abruptly_disconnect_client(client);
            // assert that server has 1 sessions
            server.currentSessionCount.should.eql(1);
            // wait for time out
            await wait(4000);
            // assert that server has no more session
            server.currentSessionCount.should.eql(0);
        }
        finally {
            await client.disconnect();
        }
    });
});
//# sourceMappingURL=test_server_resilience.js.map