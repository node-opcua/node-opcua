import "should"; // extends Object with should assertions
import { OPCUAClient } from "node-opcua";
import { assertThrow } from "../../test_helpers/assert_throw";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; [k: string]: any }

export function t(test: TestHarness) {
    describe("Issue #231 - server accepts higher client protocolVersion", () => {
        it("#231-A client with larger protocolVersion connects successfully", async () => {
            const client = OPCUAClient.create({});
            client.protocolVersion.should.eql(0);
            (client as any).protocolVersion = 0x1000; // simulate a newer client stack
            await client.connect(test.endpointUrl);
            await client.disconnect();
        });

        it("#231-B server reports BadProtocolVersionUnsupported for special test value", async () => {
            const client = OPCUAClient.create({});
            client.protocolVersion.should.eql(0);
            (client as any).protocolVersion = 0xdeadbeef; // trigger simulated server rejection
            await assertThrow(async () => {
                await client.connect(test.endpointUrl);
            }, /BadProtocolVersionUnsupported/);
            try { await client.disconnect(); } catch { /* ignore */ }
        });
    });
}