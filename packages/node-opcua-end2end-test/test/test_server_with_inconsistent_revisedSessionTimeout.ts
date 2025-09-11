import "should";
import { types } from "util";
import chalk from "chalk";

import { ClientSession, CreateSessionResponse, OPCUAClient, OPCUAServer, OPCUAServerOptions } from "node-opcua";

import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { createServerCertificateManager } from "../test_helpers/createServerCertificateManager";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const debugLog = make_debugLog("TEST");
const warningLog = make_warningLog("TEST");
const errorLog = make_errorLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port = 3019;

let server: OPCUAServer;
let weirdRevisedSessionTimeout = 0;
async function startServer() {
    const serverCertificateManager = await createServerCertificateManager(port);
    const serverOptions: OPCUAServerOptions = {
        port,
        serverCertificateManager,
        isAuditing: false
    };
    server = new OPCUAServer(serverOptions);
    debugLog(chalk.yellow("  server PID          :"), process.pid);
    try {
        await server.start();
    } catch (err) {
        if (types.isNativeError(err)) {
            errorLog(" Server failed to start ... exiting => err:", err.message);
        }
        return;
    }
    server.on("response", (response) => {
        if (response instanceof CreateSessionResponse) {
            if (weirdRevisedSessionTimeout >= 0) {
                response.revisedSessionTimeout = weirdRevisedSessionTimeout;
            }
        }
    });
}

async function stopServer() {
    await server.shutdown();
}
describe("Testing server with alternate names", () => {
    before(async () => {
        await startServer();
    });
    after(async () => {
        await stopServer();
    });

    async function test(requestedSessionTimeout: number): Promise<number> {
        const endpoint = server.getEndpointUrl();
        const client = OPCUAClient.create({
            requestedSessionTimeout
        });
        return await client.withSessionAsync(endpoint, async (session: ClientSession) => {
            console.log(session.toString());

            return session.timeout;
        });
    }
    it("weirdRevisedSessionTimeout = 0", async () => {
        weirdRevisedSessionTimeout = 0;
        OPCUAClient.minimumRevisedSessionTimeout = 1234;
        const requestedSessionTimeout = 10000;
        const actualTimeout = await test(requestedSessionTimeout);
        actualTimeout.should.eql(requestedSessionTimeout);
    });
    it("weirdRevisedSessionTimeout = 3.125E-315", async () => {
        weirdRevisedSessionTimeout = 0;
        OPCUAClient.minimumRevisedSessionTimeout = 1234;
        const requestedSessionTimeout = 10000;
        const actualTimeout = await test(requestedSessionTimeout);
        actualTimeout.should.eql(requestedSessionTimeout);
    });
    it("weirdRevisedSessionTimeout = 3.125E-315", async () => {
        weirdRevisedSessionTimeout = -1; // no change
        OPCUAClient.minimumRevisedSessionTimeout = 50000;
        const requestedSessionTimeout = 1000;
        const actualTimeout = await test(requestedSessionTimeout);
        actualTimeout.should.eql(OPCUAClient.minimumRevisedSessionTimeout);
    });
});
