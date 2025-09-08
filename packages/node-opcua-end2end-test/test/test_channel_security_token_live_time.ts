import path from "path";
import fs from "fs";
import "should";
import {
    is_valid_endpointUrl,
    OPCUAServer,
    OPCUAClient,
    ServerSecureChannelLayer
} from "node-opcua";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";



function getFixture(file: string) {
    file = path.join(__dirname, "../../node-opcua-address-space/test_helpers/test_fixtures", file);
    fs.existsSync(file).should.be.eql(true);
    return file;
}
const empty_nodeset_filename = getFixture("fixture_empty_nodeset2.xml");


const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port = 2041;


// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing ChannelSecurityToken lifetime", function (this: Mocha.Runnable) {
    this.timeout(Math.max(100000, this.timeout()));

    let server: OPCUAServer;
    let client: OPCUAClient;
    let endpointUrl: string;
    let backup = 9;
    before(async () => {
        backup = ServerSecureChannelLayer.g_MinimumSecureTokenLifetime;
        ServerSecureChannelLayer.g_MinimumSecureTokenLifetime = 250;

        const serverCertificateManager = await createServerCertificateManager(port);
        server = new OPCUAServer({ port, serverCertificateManager, nodeset_filename: empty_nodeset_filename });
        await server.start();
        // we will connect to first server end point
        endpointUrl = server.getEndpointUrl();
        debugLog("endpointUrl", endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);
    });

    after(async () => {
        ServerSecureChannelLayer.g_MinimumSecureTokenLifetime = backup;
        if (server) {
            await server.shutdown();
            OPCUAServer.registry.count().should.eql(0);
        }
    });

    beforeEach(async () => {
        client = OPCUAClient.create({
            defaultSecureTokenLifetime: 100 // very short live time !
        });
    });

    afterEach(async () => {
        await client.disconnect();
    });

    it("A secure channel should raise a event to notify its client that its token is at 75% of its lifetime", async () => {
        await client.connect(endpointUrl);

        await new Promise<void>((resolve) => {
            (client as any)._secureChannel.once("lifetime_75", resolve);
        });
        await client.disconnect();
    });

    it("A secure channel should raise a event to notify its client that a token about to expired has been renewed", async () => {
        await client.connect(endpointUrl);

        await new Promise<void>((resolve) => {
            (client as any)._secureChannel.on("security_token_renewed", function () {
                debugLog(" received security_token_renewed");
                resolve();
            });
        });
        await client.disconnect();
    });

    it("A client should periodically renew the expiring security token", async () => {
        await client.connect(endpointUrl);

        let waitingTime = (client.defaultSecureTokenLifetime + 1000) * 10;
        console.log("waiting time = ", waitingTime);

        let security_token_renewed_counter = 0;
        await new Promise<void>((resolve, reject) => {
            const id = setTimeout(() => reject(new Error("security token not renewed")), waitingTime);

            (client as any)._secureChannel.on("security_token_renewed", function () {
                debugLog(" received security_token_renewed");
                security_token_renewed_counter += 1;
                if (security_token_renewed_counter > 3) {
                    resolve();
                 
                    clearTimeout(id);
                }
            });
        });

        security_token_renewed_counter.should.be.greaterThan(3);
    });
});
