import should from "should"; // eslint-disable-line @typescript-eslint/no-var-requires
import chalk from "chalk";
import { getDefaultCertificateManager, OPCUAClient, OPCUAClientOptions, ClientSession, OPCUACertificateManager } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
const doDebug = false;

interface TestHarness {
    endpointUrl: string;
    server: any; // Using any to avoid pulling full server types; can be specialized later
}

interface ClientSessionTaskData {
    index: number;
    clientCertificateManager: OPCUACertificateManager;
    /** if true (default), waits until the server has reached the configured maxSessionsForTest (or server max) once */
    waitForAllConnections?: boolean; // default true for backward compatibility
}


function r(t: number): number {
    return Math.ceil(t * 100) / 100;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));


function getTick(): number {
    return Date.now() / 1000.0;
}

async function perform<T>(msg: string, action: () => Promise<T>): Promise<T> {
    await delay(10); // keep former slight stagger
    if (doDebug) {
        console.log(msg);
    }
    const t = getTick();
    try {
        const result = await action();
        if (doDebug) {
            console.log("   ", chalk.green(msg), r(getTick() - t));
        }
        return result;
    } catch (err: unknown) {
        if (doDebug) {
            if (err instanceof Error) {
                console.log("   ", chalk.red(msg), err.message, r(getTick() - t));
            } else {
                console.log("   ", chalk.red(msg), String(err), r(getTick() - t));
            }
        }
        throw err;
    }
}

export  function t(test: TestHarness): void {
    const maxSessionsForTest = 50;

    // tracks whether threshold has been reached at least once (useful to synchronize start of session creation)
    let thresholdReached = false;
    function hasReachedConnectionThreshold(target: number): boolean {
        if (thresholdReached) return true;
        if (test.server.currentChannelCount >= target) {
            thresholdReached = true;
            return true;
        }
        return false;
    }

    const connectivity_strategy: OPCUAClientOptions["connectionStrategy"] = {
        maxRetry: 10,
        initialDelay: 100,
        maxDelay: 200,
        randomisationFactor: 0
    };

    let first_client: OPCUAClient | null = null;

    /**
     * Establish a client connection, optionally wait until global threshold reached, create & close one session, then disconnect.
     */
    async function client_session(data: ClientSessionTaskData): Promise<void> {
        const options: OPCUAClientOptions = {
            connectionStrategy: connectivity_strategy,
            requestedSessionTimeout: 100000,
            clientCertificateManager: data.clientCertificateManager
        };

        const client1 = OPCUAClient.create(options);
        const endpointUrl = test.endpointUrl;

        client1.on("send_request", function (req: any) {
            if (doDebug) {
                console.log(data.index, " >> ", req.constructor.name);
            }
        });
        client1.on("receive_response", function (res: any) {
            if (doDebug) {
                console.log(data.index, " << ", res.constructor.name, res.responseHeader.serviceResult.toString());
            }
        });
        client1.on("start_reconnection", function () {
            if (doDebug) {
                console.log(chalk.bgWhite.yellow("start_reconnection"), data.index);
            }
        });
        client1.on("backoff", function (number: number, delay: number) {
            if (doDebug) {
                console.log(chalk.bgCyan.yellow("backoff ", data.index), number, delay);
            }
        });

        should.exist(first_client);
        if (!first_client) throw new Error("First client not initialized");

        // reuse discovered endpoints to speed up
        (client1 as any)._serverEndpoints = (first_client as any)._serverEndpoints;
        (client1 as any).knowsServerEndpoint.should.eql(true);


    let the_session: ClientSession | undefined;
    let createSessionError: unknown = undefined;
    try {
            await perform("connecting client " + data.index, async () => {
                await client1.connect(endpointUrl);
            });

            // Optionally wait until server reached its max session/channel threshold once (original behaviour)
            const shouldWait = data.waitForAllConnections !== false; // default true
            if (shouldWait) {
                const target = test.server.engine.serverCapabilities.maxSessions || maxSessionsForTest;
                while (!hasReachedConnectionThreshold(target)) {
                    await delay(200);
                }
            }

            try {
                the_session = await perform("create session " + data.index, async () => {
                    return await client1.createSession();
                });
                await delay(1000); // preserve original pause only if session created
            } catch (err) {
                // capture error so caller can see rejection after cleanup
                createSessionError = err;
            }

            if (the_session) {
                await perform("closing session " + data.index, async () => {
                    await the_session!.close();
                });
            }
        } finally {
            await perform("disconnecting client " + data.index, async () => {
                try {
                    await client1.disconnect();
                } catch (_) {
                    /* ignore */
                }
            });
            if (createSessionError) {
                // rethrow after disconnect so Promise.allSettled records rejection
                throw createSessionError;
            }
        }
    }

    describe("AZAZ Testing " + maxSessionsForTest + " clients", function () {
    let clientCertificateManager: OPCUACertificateManager;

        before(async () => {
            clientCertificateManager = getDefaultCertificateManager("PKI");
            await clientCertificateManager.initialize();

            first_client = OPCUAClient.create({
                clientCertificateManager: clientCertificateManager,
                connectionStrategy: {
                    initialDelay: 1000,
                    maxRetry: 10
                }
            });
            const endpointUrl = test.endpointUrl;
            await first_client.connect(endpointUrl);
        });
        after(async () => {
            if (first_client) {
                await first_client.disconnect();
            }
        });

        /**
         * Original scenario: spin up maxSessionsForTest clients (parallel) each doing 1 session.
         */
        it("AZAZ-A should accept many clients", async function () {
            const maxSessionsBackup = test.server.engine.serverCapabilities.maxSessions;
            const maxConnectionsPerEndpointBackup = test.server.maxConnectionsPerEndpoint;
            test.server.engine.serverCapabilities.maxSessions = maxSessionsForTest;
            test.server.engine.serverCapabilities.maxSessions.should.eql(maxSessionsForTest);

            const nb = maxSessionsForTest;
            thresholdReached = false; // reset threshold tracking
            const promises = Array.from({ length: nb }, (_, i) => client_session({ index: i, clientCertificateManager }));
            await Promise.all(promises);
            test.server.engine.serverCapabilities.maxSessions = maxSessionsBackup;
        });

        /**
         * Scenario B: Run same number of clients but limit concurrency to 10 to reduce instantaneous load.
         */
        it("AZAZ-B should accept many clients with concurrency limit 10", async function () {
            const maxSessionsBackup = test.server.engine.serverCapabilities.maxSessions;
            test.server.engine.serverCapabilities.maxSessions = maxSessionsForTest;
            thresholdReached = false;
            const total = maxSessionsForTest;
            const concurrency = 10;
            const running = new Set<Promise<void>>();
            for (let i = 0; i < total; i++) {
                const p = client_session({ index: i, clientCertificateManager, waitForAllConnections: false }).finally(() => running.delete(p));
                running.add(p);
                if (running.size >= concurrency) {
                    await Promise.race(running);
                }
            }
            await Promise.all(running);
            test.server.engine.serverCapabilities.maxSessions = maxSessionsBackup;
        });

        /**
         * Scenario C: Exceed server maxSessions intentionally and verify some attempts fail (e.g., BadTooManySessions) while others succeed.
         */
        it("AZAZ-C should produce failures when exceeding server maxSessions", async function () {
            const originalMax = test.server.engine.serverCapabilities.maxSessions;
            const reducedMax = Math.min(10, originalMax); // pick a small cap
            test.server.engine.serverCapabilities.maxSessions = reducedMax;
            thresholdReached = false;
            const attempts = reducedMax * 3; // far exceed cap
            const results = await Promise.allSettled(
                Array.from({ length: attempts }, (_, i) => client_session({ index: i, clientCertificateManager, waitForAllConnections: false }))
            );
            const fulfilled = results.filter(r => r.status === "fulfilled").length;
            const rejected = attempts - fulfilled;
            // At least reducedMax should succeed, and we expect some rejections
            should(fulfilled).be.aboveOrEqual(reducedMax);
            should(rejected).be.above(0);
            test.server.engine.serverCapabilities.maxSessions = originalMax;
        });

        /**
         * Scenario D: Sequential clients (one after another) to detect potential resource leaks when not stressing concurrency.
         */
        it("AZAZ-D should handle sequential client connections cleanly", async function () {
            const maxSessionsBackup = test.server.engine.serverCapabilities.maxSessions;
            test.server.engine.serverCapabilities.maxSessions = maxSessionsForTest;
            thresholdReached = false;
            for (let i = 0; i < 20; i++) {
                await client_session({ index: i, clientCertificateManager, waitForAllConnections: false });
            }
            test.server.engine.serverCapabilities.maxSessions = maxSessionsBackup;
        });
    });
}