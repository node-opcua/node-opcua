import {
    ClientSession,
    OPCUAClient,
    readOperationLimits,
    readServerCapabilities
} from "node-opcua";
import should from "should";

import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");


export function t(test: any) {

    const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
    describe("Verifying #1375", function (this: any) {
        this.timeout(Math.max(200000, this.timeout()));

        before(() => {

        });
        beforeEach(async () => {

        });
        afterEach(async () => {

        });

        it("Should read MinSupportedSampleRate", async () => {

            const client = OPCUAClient.create({ endpointMustExist: false });

            const serverCapabilities = await client.withSessionAsync(test.endpointUrl, async (session: ClientSession) => {
                const serverCapabilities = await readServerCapabilities(session);
                return serverCapabilities;
            })
            console.log("serverCapabilities", serverCapabilities);
        });
    });
}
