import "should";
import { OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; server: any; [k: string]: any }

/**
 * Issue #198
 * Server should happily accept a CreateSession request even if the client's provided sessionName is null/undefined.
 * Original test hijacked the internal _nextSessionName() to force it to return null.
 */
export function t(test: TestHarness) {
    describe("Testing server when client sessionName is not defined  #198", () => {
        it("#198 Server should handle client createSession when sessionName forced to null", async () => {
            const server = test.server;
            if (!server) return; // skip in client-only mode

            const endpointUrl = test.endpointUrl;
            const client = OPCUAClient.create({});

            // Hijack internal method _nextSessionName to return null
            (client as any)._nextSessionName = function () { return null; };

            let session: any;
            try {
                await client.connect(endpointUrl);
                session = await client.createSession();
            } finally {
                if (session) {
                    await session.close();
                }
                await client.disconnect();
            }
        });
    });
}
