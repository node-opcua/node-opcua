const { OPCUAClient } = require("..");
const { make_debugLog } = require("node-opcua-debug");

const debugLog = make_debugLog("TEST");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("issue #931 investigation", function() {

    async function wait(t) {
        return await new Promise((resolve) => setTimeout(resolve, t));
    }

    it("should be able to disconnect when the client is trying to initially connect to a server", async () => {

        const client = OPCUAClient.create({
            connectionStrategy: {
                maxRetry: 100,
                initialDelay: 100,
                maxDelay: 200,
            }
        });

        let backoffCount = 0;
        client.on("backoff", (retry, next) => {
            backoffCount++;
            debugLog("backoff", retry, next);
        });

        debugLog("Before Connect");
        client.connect("opc.tcp://localhost:20000").catch((err) => {
            debugLog("connection failed !", err.message);
        });
        debugLog("Connect in progress");
        await wait(2000);

        backoffCount.should.be.greaterThan(0);

        const refBackoffCount = backoffCount;

        debugLog("now disconnecting");
        await client.disconnect();
        await wait(1000);
        backoffCount.should.eql(refBackoffCount, "Backoff should stops when disconnect is called while connection is still in progress");
    });
});
