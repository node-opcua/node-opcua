import "should";
import { ClientSession, OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; [k: string]: any }

export function t(test: TestHarness) {
    describe("Bug #433 - ActivateSession with null userIdentityToken", () => {
        it("accepts null userIdentityToken", async () => {
            const client = OPCUAClient.create({});
            await client.connect(test.endpointUrl);
            let session: ClientSession| null = null;
            try {
                // Explicitly pass null userIdentityInfo
                session = await client.createSession(null as any);
                session.should.be.ok();
            } finally {
                if (session) await session.close();
                await client.disconnect();
            }
        });
    });
}