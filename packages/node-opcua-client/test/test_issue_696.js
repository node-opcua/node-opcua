const { OPCUAClient } = require("..");
const { checkDebugFlag } = require("node-opcua-debug");

let setIntervalCalls = 0;
let clearIntervalCalls = 0;
let realSetInterval;
let realClearInterval;

const doDebug = checkDebugFlag("TEST");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("issue 696", function () {
    before(() => {
        realSetInterval = global.setInterval;
        realClearInterval = global.clearInterval;
        global.setInterval = (...args) => {
            setIntervalCalls++;
            return realSetInterval(...args);
        };
        global.clearInterval = (...args) => {
            clearIntervalCalls++;
            return realClearInterval(...args);
        };
    });
    after(() => {
        global.setInterval = realSetInterval;
        global.clearInterval = realClearInterval;
    });
    it("should not leak interval if connection failed", async () => {
        async function test() {
            const client = OPCUAClient.create({ connectionStrategy: { maxRetry: 0 } });
            try {
                await client.connect("invalid-proto://test-host");
            } catch (err) {
                if (doDebug) {
                    console.log(err.message);
                }
                throw err;
            }
            finally {
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
