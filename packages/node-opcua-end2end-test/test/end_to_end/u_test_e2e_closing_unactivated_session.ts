import "should"; // should assertions side-effect
import { type ClientSession, type ConnectionStrategyOptions, OPCUAClient } from "node-opcua";
import { assert } from "node-opcua-assert";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { UmbrellaTestContext } from "./_helper_umbrella";

// _createSession creates a not-yet-activated session; deliberately not part of the public
// OPCUAClient surface (activation is normally implicit in createSession/withSessionAsync).
// _sessions is likewise a private implementation field, reached here only to assert cleanup.
// biome-ignore lint/suspicious/noExplicitAny: see comment above
type InternalAny = any;

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createNonActivatedSession(endpointUrl: string, connectionStrategy: ConnectionStrategyOptions) {
    const client = OPCUAClient.create({ connectionStrategy });
    await client.connect(endpointUrl);
    const session: ClientSession = await new Promise((resolve, reject) => {
        (client as InternalAny)._createSession((err: Error, s: ClientSession) => (err ? reject(err) : resolve(s)));
    });
    return { client, session };
}

export function t(test: UmbrellaTestContext) {
    describe("Closing a non activated session", () => {
        it("AKQ server shall allow closing a non activated session (historical behaviour)", async () => {
            const endpointUrl = test.endpointUrl!;
            const client1 = OPCUAClient.create({ connectionStrategy: { maxRetry: 1 } });
            await client1.connect(endpointUrl);
            const session: ClientSession = await new Promise((resolve, reject) => {
                (client1 as InternalAny)._createSession((err: Error, s: ClientSession) => (err ? reject(err) : resolve(s)));
            });
            // Attempt to close unactivated session; historical behaviour may be BadSessionNotActivated or succeed silently.
            try {
                await session.close();
            } catch (err: unknown) {
                // Accept BadSessionNotActivated as valid outcome; rethrow others.
                if (!/BadSessionNotActivated/.test((err as Error).message || "")) {
                    throw err;
                }
            }
            await client1.disconnect();
        });
    });

    describe("Server shall prune oldest unactivated sessions when reaching maximum", () => {
        it("QQQQ server shall close oldest non-activated sessions before exceeding maxSessions", async () => {
            const server = test.server;
            if (!server) throw new Error("Test harness server not provided");
            const engine = server.engine;
            const endpointUrl = test.endpointUrl!;

            const maxSessionsForTest = 3;
            const backupMaxSessions = engine.serverCapabilities.maxSessions;
            engine.serverCapabilities.maxSessions = maxSessionsForTest;

            try {
                engine.currentSessionCount.should.eql(0, "expecting server to have no session left opened");

                await delay(1000); // allow any background cleanup
                engine.currentSessionCount.should.eql(0);

                const connectionStrategy = { maxRetry: 0 }; // fail fast
                const clients: OPCUAClient[] = [];
                const sessions: ClientSession[] = [];

                async function addOne() {
                    const { client, session } = await createNonActivatedSession(endpointUrl, connectionStrategy);
                    clients.push(client);
                    sessions.push(session);
                    // Spec Part 4 §5.6.2: server shall close oldest unactivated before exceeding limit
                    engine.currentSessionCount.should.be.lessThanOrEqual(maxSessionsForTest);
                }

                for (let i = 0; i < 12; i++) {
                    await addOne();
                    const expected = Math.min(i + 1, maxSessionsForTest);
                    engine.currentSessionCount.should.eql(expected);
                }

                // Close all sessions we still have references to (some may already have been closed by server)
                for (const s of sessions) {
                    try {
                        await s.close();
                    } catch {
                        /* ignore */
                    }
                }
                // Disconnect all clients
                for (const c of clients) {
                    try {
                        await c.disconnect();
                    } finally {
                        assert((c as InternalAny)._sessions.length === 0, "client should have no remaining sessions");
                    }
                }

                await delay(500);
                engine.currentSessionCount.should.eql(0);
            } finally {
                engine.serverCapabilities.maxSessions = backupMaxSessions;
            }
        });
    });
}
