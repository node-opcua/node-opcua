import os from "node:os";
import path from "node:path";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { checkDebugFlag } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { OPCUAClient } from "..";

let setIntervalCalls = 0;
let clearIntervalCalls = 0;
let realSetInterval: typeof global.setInterval;
let realClearInterval: typeof global.clearInterval;

const doDebug = checkDebugFlag("TEST");

describe("issue 696", function (this: Mocha.Suite) {
    this.timeout(Math.max(40000, this.timeout()));
    before(() => {
        realSetInterval = global.setInterval;
        realClearInterval = global.clearInterval;
        global.setInterval = ((...args: Parameters<typeof realSetInterval>) => {
            setIntervalCalls++;
            return realSetInterval(...args);
        }) as unknown as typeof global.setInterval;
        global.clearInterval = ((...args: Parameters<typeof realClearInterval>) => {
            clearIntervalCalls++;
            return realClearInterval(...args);
        }) as unknown as typeof global.clearInterval;
    });

    after(() => {
        global.setInterval = realSetInterval;
        global.clearInterval = realClearInterval;
    });

    it("should not leak interval if connection failed", async () => {
        async function test() {
            const rootFolder = path.join(os.tmpdir(), "node-opcua-696");
            const clientCertificateManager = new OPCUACertificateManager({ rootFolder });

            const client = OPCUAClient.create({ clientCertificateManager, connectionStrategy: { maxRetry: 0 } });
            try {
                await client.connect("invalid-proto://test-host");
            } catch (err) {
                if (doDebug) {
                    console.log((err as Error).message);
                }
                throw err;
            } finally {
                await client.disconnect();
            }
        }
        await test().should.be.rejectedWith(/NODE-OPCUA-E05/);

        if (doDebug) {
            console.log(`setIntervalCalls ${setIntervalCalls} vs. clearIntervalCalls ${clearIntervalCalls}`);
        }
        setIntervalCalls.should.eql(clearIntervalCalls);
    });
});
