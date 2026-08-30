import "should"; // extends Object with should assertions
import { OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { assertThrow } from "../../test_helpers/assert_throw.js";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";

// protocolVersion is readonly on the public OPCUAClient interface; bypassed here
// via a narrow structural cast to simulate a different client protocol version.
type ClientWithMutableProtocolVersion = { protocolVersion: number };

export function t(test: UmbrellaTestContext) {
    describe("Issue #231 - server accepts higher client protocolVersion", () => {
        it("#231-A client with larger protocolVersion connects successfully", async () => {
            const client = OPCUAClient.create({});
            client.protocolVersion.should.eql(0);
            (client as unknown as ClientWithMutableProtocolVersion).protocolVersion = 0x1000; // simulate a newer client stack
            await client.connect(test.endpointUrl!);
            await client.disconnect();
        });

        it("#231-B server reports BadProtocolVersionUnsupported for special test value", async () => {
            const client = OPCUAClient.create({});
            client.protocolVersion.should.eql(0);
            (client as unknown as ClientWithMutableProtocolVersion).protocolVersion = 0xdeadbeef; // trigger simulated server rejection
            await assertThrow(async () => {
                await client.connect(test.endpointUrl!);
            }, /BadProtocolVersionUnsupported/);
            try {
                await client.disconnect();
            } catch {
                /* ignore */
            }
        });
    });
}
