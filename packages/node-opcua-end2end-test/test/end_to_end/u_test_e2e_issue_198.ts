import "should";
import { type ClientSession, OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { UmbrellaTestContext } from "./_helper_umbrella";

// _nextSessionName is a private OPCUAClient implementation method, hijacked here
// to force a null sessionName that the public API cannot otherwise produce.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
type InternalAny = any;

/**
 * Issue #198
 * Server should happily accept a CreateSession request even if the client's provided sessionName is null/undefined.
 * Original test hijacked the internal _nextSessionName() to force it to return null.
 */
export function t(test: UmbrellaTestContext) {
    describe("Testing server when client sessionName is not defined  #198", () => {
        it("#198 Server should handle client createSession when sessionName forced to null", async () => {
            const server = test.server;
            if (!server) return; // skip in client-only mode

            const endpointUrl = test.endpointUrl!;
            const client = OPCUAClient.create({});

            // Hijack internal method _nextSessionName to return null
            (client as InternalAny)._nextSessionName = () => null;

            let session: ClientSession | undefined;
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
