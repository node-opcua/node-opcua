import { OPCUAClient, ServerState } from "node-opcua";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
const debugLog = make_debugLog("TEST");
const _doDebug = checkDebugFlag("TEST");
async function pause(duration) {
    return new Promise((resolve) => setTimeout(resolve, duration));
}
export function t(test) {
    describe("Testing client keepalive options", () => {
        it("KA-1 it should terminate keepalive when session is closed", async () => {
            let keepAliveCounter = 0;
            // Set NODEOPCUADEBUG=client_session_keepalive_manager-TEST
            const client = OPCUAClient.create({
                endpointMustExist: true,
                keepSessionAlive: true,
                requestedSessionTimeout: 1000
            });
            const endpointUrl = test.endpointUrl;
            debugLog(endpointUrl);
            await client.connect(endpointUrl);
            const session = await client.createSession();
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
        });
    });
}
//# sourceMappingURL=u_test_e2e_keepAlive.js.map