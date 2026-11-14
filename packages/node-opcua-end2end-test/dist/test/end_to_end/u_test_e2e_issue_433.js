import "should";
import { OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
export function t(test) {
    describe("Bug #433 - ActivateSession with null userIdentityToken", () => {
        it("accepts null userIdentityToken", async () => {
            const client = OPCUAClient.create({});
            await client.connect(test.endpointUrl);
            let session = null;
            try {
                // Explicitly pass null userIdentityInfo, even though the public type only declares undefined
                session = await client.createSession(null);
                session.should.be.ok();
            }
            finally {
                if (session)
                    await session.close();
                await client.disconnect();
            }
        });
    });
}
//# sourceMappingURL=u_test_e2e_issue_433.js.map