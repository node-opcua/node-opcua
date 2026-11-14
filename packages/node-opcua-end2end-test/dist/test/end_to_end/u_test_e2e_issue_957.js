import "should";
import { OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { waitForEvent } from "../../test_helpers/utils.js";
export function t(test) {
    describe("Testing bug #957 - ServerCertificate is an empty buffer", () => {
        const RENEWAL_TIMEOUT_MS = 10_000; // safety timeout for event wait
        it("should create a client session when server certificate is an empty buffer (not null)", async () => {
            const client = OPCUAClient.create({ defaultSecureTokenLifetime: 1000 });
            // Emulate empty certificate condition (certificate provided but zero length per original bug).
            // serverCertificate is readonly on the public OPCUAClient interface; bypass it here for the injection.
            client.serverCertificate = Buffer.alloc(0);
            await client.connect(test.endpointUrl);
            let session = null;
            try {
                session = await client.createSession();
                // Wait for first token renewal to prove secure channel lifecycle works with empty server cert
                await waitForEvent(client, "security_token_renewed", RENEWAL_TIMEOUT_MS);
            }
            finally {
                if (session) {
                    await session.close();
                }
                await client.disconnect();
            }
        });
    });
}
//# sourceMappingURL=u_test_e2e_issue_957.js.map