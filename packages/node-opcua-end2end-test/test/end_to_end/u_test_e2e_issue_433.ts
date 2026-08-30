import "should";
import { type ClientSession, OPCUAClient, type UserIdentityInfo } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { UmbrellaTestContext } from "./_helper_umbrella.js";

export function t(test: UmbrellaTestContext) {
    describe("Bug #433 - ActivateSession with null userIdentityToken", () => {
        it("accepts null userIdentityToken", async () => {
            const client = OPCUAClient.create({});
            await client.connect(test.endpointUrl!);
            let session: ClientSession | null = null;
            try {
                // Explicitly pass null userIdentityInfo, even though the public type only declares undefined
                session = await client.createSession(null as unknown as UserIdentityInfo);
                session.should.be.ok();
            } finally {
                if (session) await session.close();
                await client.disconnect();
            }
        });
    });
}
