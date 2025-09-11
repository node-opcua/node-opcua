import { OPCUAClient, ServerState } from "node-opcua";

import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

async function pause(duration: number) {
    return new Promise((resolve) => setTimeout(resolve, duration));
}

export function t(test: { endpointUrl: string }) {

    describe("Testing client keepalive options", function () {

        it("KA-1 it should terminate keepalive when session is closed", async () => {

            let keepAliveCounter = 0;
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
            session.on("keepalive", (state: ServerState, count: number) => {
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
