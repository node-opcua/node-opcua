import "should";
import { OPCUAServer } from "node-opcua-server";
import { ClientSession, OPCUAClient } from "node-opcua-client";
import {
    get_empty_nodeset_filename,
    is_valid_endpointUrl
} from "node-opcua";
import {
    make_debugLog,
    checkDebugFlag
} from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager";
import { ServerSideUnimplementedRequest } from "../test_helpers/unimplementedRequest";
import { wait } from "../test_helpers/utils";

// Initialize variables
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");
const empty_nodeset_filename = get_empty_nodeset_filename();

describe("testing Server resilience to unsupported request", function (this: Mocha.Runnable) {

    const port = 2990;

    let server: OPCUAServer;
    let client: OPCUAClient;
    let endpointUrl: string;
    let g_session: ClientSession;

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

    it("server should return a ServiceFault if receiving a unsupported MessageType", function (done) {
        const bad_request = new ServerSideUnimplementedRequest({}); // intentionally send a bad request

        (g_session as any).performMessageTransaction(bad_request, function (err: Error | null, response: any) {
            err!.should.be.instanceOf(Error);
            done();
        });
    });
});

async function abruptly_disconnect_client(client: OPCUAClient) {

    await new Promise<void>((resolve) => {
        (client as any)._secureChannel.getTransport().disconnect((err: Error) => {
            err ? resolve() : resolve();
        });
    });
}

describe("testing Server resilience with bad internet connection", function (this: Mocha.Runnable) {
    let server: OPCUAServer;
    let client: OPCUAClient;
    let endpointUrl: string;

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
            session.timeout.should.eql((client as any).requestedSessionTimeout);

            // assert that server has 1 sessions

            server.currentSessionCount.should.eql(1);



            await abruptly_disconnect_client(client);
            // assert that server has 1 sessions
            server.currentSessionCount.should.eql(1);

            // wait for time out
            await wait(4000);

            // assert that server has no more session

            server.currentSessionCount.should.eql(0);

        } finally {
            await client.disconnect();
        }
    });
});
