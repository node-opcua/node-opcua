import "should";
import sinon from "sinon";
import { OPCUAClient } from "node-opcua";
import { messageLogger } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; [k: string]: any }

export function t(test: TestHarness) {
    describe("CDC multiple disconnection", () => {
        let client: OPCUAClient; let endpointUrl: string; let warningSpy: sinon.SinonSpy;

        beforeEach(() => {
            client = OPCUAClient.create({});
            endpointUrl = test.endpointUrl;
            warningSpy = sinon.spy();
            messageLogger.on("warningMessage", warningSpy);
        });

        afterEach(async () => {
            if (client) {
                try { await client.disconnect(); } catch { /* ignore */ }
            }
            // reset spy so tests stay isolated
            warningSpy.resetHistory();
            // @ts-ignore
            client = null;
        });

        function getWarnings(): string {
            const msg = warningSpy.getCalls().map((c) => c.args[0]).join(" ");
            warningSpy.resetHistory();
            return msg;
        }

        it("CDC-1 - disconnect, then connect, then disconnect", async () => {
            await client.disconnect(); // disconnect before ever connecting -> should be harmless
            getWarnings().should.not.match(/\[NODE-OPCUA-W26]/);
            await client.connect(endpointUrl);
            await client.disconnect();
            getWarnings().should.not.match(/\[NODE-OPCUA-W26]/);
        });

        it("CDC-2 - disconnect, then connect, then disconnect, then connect, then disconnect", async () => {
            await client.connect(endpointUrl);
            await client.disconnect();
            await client.connect(endpointUrl);
            await client.disconnect();
            getWarnings().should.not.match(/\[NODE-OPCUA-W26]/);
        });

        it("CDC-3 - disconnect while disconnecting", async () => {
            await client.connect(endpointUrl);
            const p1 = client.disconnect();
            await client.disconnect(); // second call while first still pending
            await p1;
            getWarnings().should.match(/\[NODE-OPCUA-W26] OPCUAClient#disconnect called while already disconnecting/);
        });
    });
}
