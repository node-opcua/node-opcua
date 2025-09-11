import "should";
import { OPCUAClient } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { EventEmitter } from "events";

interface TestHarness { endpointUrl: string; [k: string]: any }

export function t(test: TestHarness) {
    describe("Testing bug #957 - ServerCertificate is an empty buffer", () => {
        const RENEWAL_TIMEOUT_MS = 10_000; // safety timeout for event wait

        async function waitForEvent(emitter: EventEmitter, event: string, timeoutMs: number) {
            return await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`${event} not received within ${timeoutMs} ms`)), timeoutMs);
                emitter.once(event, () => { clearTimeout(timer); resolve(); });
            });
        }

        it("should create a client session when server certificate is an empty buffer (not null)", async () => {
            const client = OPCUAClient.create({ defaultSecureTokenLifetime: 1000 });

            // Emulate empty certificate condition (certificate provided but zero length per original bug)
            (client as any).serverCertificate = Buffer.alloc(0);

            await client.connect(test.endpointUrl);
            let session: any = null;
            try {
                session = await client.createSession();

                // Wait for first token renewal to prove secure channel lifecycle works with empty server cert
                await waitForEvent(client as unknown as EventEmitter, "security_token_renewed", RENEWAL_TIMEOUT_MS);
            } finally {
                if (session) { await session.close(); }
                await client.disconnect();
            }
        });
    });
}
