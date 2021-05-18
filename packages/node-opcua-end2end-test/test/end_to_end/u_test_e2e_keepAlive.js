const { OPCUAClient, ServerState } = require("node-opcua");

const { make_debugLog, checkDebugFlag} = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

async function pause(duration) {
    return new Promise((resolve) => setTimeout(resolve, duration));
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
module.exports = function(test) {

    describe("Testing client keepalive options", function() {

        it("KA-1 it should terminate keepalive when session is closed", async () => {

            let keepAliveCounter =0;
            // Set NODEOPCUADEBUG=client_session_keepalive_manager-TEST
            const client = OPCUAClient.create({
                endpointMustExist: true,
                keepSessionAlive: true,
                requestedSessionTimeout: 1000
            });

            const endpointUrl = test.endpointUrl;
            debugLog(endpointUrl)
            await client.connect(endpointUrl);
            let session = await client.createSession();
            debugLog("session.timeout= ", session.timeout);
            session.on("keepalive", (state, count) => {
                debugLog("KeepAlive state=", ServerState[state], "count ", count);
                keepAliveCounter += 1;
            });
            await pause(5000);
            await session.close();
            debugLog("session is closed");
            await client.disconnect();
            if (process.env.DEBUG) {
                await pause(1000);
            }
            keepAliveCounter.should.be.greaterThan(3);
        })
    });
}
