import should from "should"; // eslint-disable-line @typescript-eslint/no-var-requires
import chalk from "chalk";
import { OPCUAClient, OPCUAClientOptions, ClientSession } from "node-opcua";

const doDebug = false;

interface TestHarness {
    endpointUrl: string;
    server: {
        engine: {
            serverCapabilities: {
                maxSessions: number;
            };
        };
    };
}

interface SessionTaskData { index: number }

export function t(test: TestHarness): void {
    const maxSessionsForTest = 50; // configurable upper bound for these tests

    function getTick() {
        return Date.now() / 1000.0;
    }

    const connectionStrategy = {
        maxRetry: 100,
        initialDelay: 100,
        maxDelay: 200,
        randomisationFactor: 0.5
    };

    let client: OPCUAClient | null = null;

    const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    function r(t: number): number {
        return Math.ceil(t * 100) / 100;
    }


    async function perform<T>(msg: string, func: () => Promise<T>): Promise<T> {
        await delay(10);
        if (doDebug) {
            console.log(msg);
        }
        const t = getTick();
        try {
            const result = await func();
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

    async function client_session(data: SessionTaskData): Promise<void> {
        should.exist(client); // ensure instantiated in before hook
        if (!client) throw new Error("Client not initialized");


        async function waitRandom() {
            await delay(Math.ceil(Math.random() * 10 + 1000));
        }

        const the_session: ClientSession = await perform<ClientSession>("create session " + data.index, async () => {
            return await client!.createSession();
        });

        await waitRandom();

        await perform("closing session " + data.index, async () => {
            doDebug && console.log("closing session ", data.index);
            await the_session.close();
        });
    }

    describe("AAAY Testing " + maxSessionsForTest + " sessions on the same  connection ", function () {
        before(async () => {
            const options = {
                connectionStrategy,
                requestedSessionTimeout: 100000
            };
            client = OPCUAClient.create(options as OPCUAClientOptions);
            const endpointUrl = test.endpointUrl;
            client.on("send_request", function (req) {
                if (doDebug) {
                    console.log(req.constructor.name);
                }
            });
            client.on("receive_response", function (res) {
                if (doDebug) {
                    console.log(res.constructor.name, res.responseHeader.serviceResult.toString());
                }
            });

            client.on("start_reconnection", function (err: Error) {
                if (doDebug) {
                    console.log(chalk.bgWhite.yellow("start_reconnection"));
                }
            });
            client.on("backoff", function (number, delay) {
                if (doDebug) {
                    console.log(chalk.bgWhite.yellow("backoff"), number, delay);
                }
            });

            //xx client.knowsServerEndpoint.should.eql(true);

            await client.connect(endpointUrl);
        });
        after(async () => {
            if (client) {
                await client.disconnect();
            }
        });
        it("QZQ should be possible to open  many sessions on a single connection", async function () {
            const maxSessionsBackup = test.server.engine.serverCapabilities.maxSessions;
            test.server.engine.serverCapabilities.maxSessions = maxSessionsForTest;
            const nb = maxSessionsForTest + 10;
            const promises = Array.from({ length: nb }, (_, i) => client_session({ index: i }));
            await Promise.allSettled(promises).catch((err) => {
                console.log("Error", err);
            });
            test.server.engine.serverCapabilities.maxSessions = maxSessionsBackup;
        });
        it("QZQ should be possible to run 100 sessions with concurrency limited to 20", async function () {
            const totalSessions = 100;
            const concurrency = 20;
            const maxSessionsBackup = test.server.engine.serverCapabilities.maxSessions;
            // Ensure server allows at least 'concurrency' simultaneous sessions (add a small buffer)
            test.server.engine.serverCapabilities.maxSessions = Math.max(maxSessionsBackup, concurrency + 10);

            const running = new Set<Promise<void>>();
            for (let i = 0; i < totalSessions; i++) {
                const p = client_session({ index: i }).finally(() => running.delete(p));
                running.add(p);
                if (running.size >= concurrency) {
                    // Wait until at least one finishes before launching next
                    await Promise.race(running);
                }
            }
            // Await remaining
            await Promise.all(running);

            test.server.engine.serverCapabilities.maxSessions = maxSessionsBackup;
        });
    });
}
