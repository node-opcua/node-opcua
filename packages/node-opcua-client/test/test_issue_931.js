const os = require("os");
const { make_debugLog } = require("node-opcua-debug");
const { OPCUAClient, MessageSecurityMode, SecurityPolicy } = require("..");

const debugLog = make_debugLog("TEST");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("issue #931 investigation", function () {
    this.timeout(30000);
    async function wait(t) {
        return await new Promise((resolve) => setTimeout(resolve, t));
    }

    async function doTest(options, host) {
        const client = OPCUAClient.create(options);

        let backoffCount = 0;
        client.on("backoff", (retry, next) => {
            backoffCount++;
            debugLog("backoff", retry, next);
        });

        debugLog("Before Connect");
        client.connect(`opc.tcp://${host}:20000`).catch((err) => {
            debugLog("connection failed !", err.message);
        });
        debugLog("Connect in progress");
        await wait(3000);

        backoffCount.should.be.aboveOrEqual(0);

        const refBackoffCount = backoffCount;

        debugLog("now disconnecting");
        await client.disconnect();
        await wait(1000);
        backoffCount.should.eql(
            refBackoffCount,
            "Backoff should stops when disconnect is called while connection is still in progress"
        );
    }
    it("931-A should be able to disconnect when the client is trying to initially connect to a server - No Security - Localhost", async () => {
        const options = {
            connectionStrategy: {
                maxRetry: 100,
                initialDelay: 100,
                maxDelay: 200
            }
        };
        await doTest(options, "localhost");
    });
    it("931-A should be able to disconnect when the client is trying to initially connect to a server - No Security - hostname", async () => {
        const options = {
            connectionStrategy: {
                maxRetry: 100,
                initialDelay: 100,
                maxDelay: 200
            }
        };
        await doTest(options, os.hostname());
    });
    it("931-B should be able to disconnect when the client is trying to initially connect to a server - With Security - localhost", async () => {
        const options = {
            connectionStrategy: {
                maxRetry: 100,
                initialDelay: 100,
                maxDelay: 200
            },
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        };
        await doTest(options, "localhost");
    });
    it("931-B should be able to disconnect when the client is trying to initially connect to a server - With Security - hostname", async () => {
        const options = {
            connectionStrategy: {
                maxRetry: 100,
                initialDelay: 100,
                maxDelay: 200
            },
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        };
        await doTest(options, os.hostname());
    });

    it("931-Z connect disconnect no wait ", async () => {
        const host = os.hostname();
        const options = {
            connectionStrategy: {
                maxRetry: 100,
                initialDelay: 100,
                maxDelay: 200
            },
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        };
        const client = OPCUAClient.create(options);

        let backoffCount = 0;
        client.on("backoff", (retry, next) => {
            backoffCount++;
            debugLog("backoff", retry, next);
        });

        debugLog("Before Connect");
        client.connect(`opc.tcp://${host}:20000`).catch((err) => {
            debugLog("connection failed !", err.message);
        });
        debugLog("Connect in progress");
        debugLog("now disconnecting");
        await client.disconnect();
        await wait(2000);
        backoffCount.should.eql(0, "Backoff should stops when disconnect is called while connection is still in progress");
    });
});
