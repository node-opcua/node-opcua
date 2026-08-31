import "should"; // side-effect assertion library
import chalk from "chalk";
import {
    AttributeIds,
    type ClientMonitoredItem,
    type ClientSession,
    ClientSubscription,
    type ClientTCP_transport,
    type ConnectionStrategyOptions,
    coerceNodeId,
    DataType,
    type DataValue,
    MonitoringMode,
    OPCUAClient,
    StatusCodes,
    TimestampsToReturn
} from "node-opcua";
import type { ClientSessionImpl } from "node-opcua-client/source/private/client_session_impl";
import type { ClientSubscriptionImpl } from "node-opcua-client/source/private/client_subscription_impl";
import type { OPCUAClientImpl } from "node-opcua-client/source/private/opcua_client_impl";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { describeWithLeakDetector } from "node-opcua-leak-detector";
import { crash_simple_server, type ServerHandle, start_simple_server } from "../../test_helpers/external_server_fixture.js";
import { serverScript as serverScriptPath } from "../../test_helpers/paths.js";

// -------------------------------------------------------------------------------------------------
// This test stresses the client reconnection pipeline with a server that (a) crashes, (b) drops the
// TCP connection, or (c) explicitly scraps the session too early (as observed with some servers like
// KepwareServerEx6). We verify that:
//   1. The client enters reconnection mode (backoff events emitted)
//   2. The session + subscriptions + monitored items are transparently restored
//   3. Writes continue to succeed after recovery even if the previous session id becomes invalid
// -------------------------------------------------------------------------------------------------

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");
const errorLog = make_errorLog("TEST");

let server_data: ServerHandle | null = null;

const port = 4850;
const serverScript = "simple_server_that_terminate_session_too_early.js";

async function start_external_opcua_server(): Promise<void> {
    const options = {
        silent: !doDebug,
        server_sourcefile: serverScriptPath(serverScript),
        port
    };
    server_data = await start_simple_server(options);
}

async function crash_external_opcua_server(): Promise<void> {
    if (server_data) {
        await crash_simple_server(server_data);
        server_data = null;
    }
}

// ---------------------------------------------------------------------------------------------------------------------
let client: OPCUAClient | null = null;
let session: ClientSession; // initialised after client connection
let subscription: ClientSubscription | null = null;
let intervalId: NodeJS.Timeout | null = null;
let monitoredItem: ClientMonitoredItem | null = null;

async function break_connection(theClient: OPCUAClient, socketError: string): Promise<void> {
    // Ask server to simulate a network outage (server side will delay or close channel)
    const inputArguments = [
        {
            dataType: DataType.UInt32,
            value: 10_000 // ms duration for simulated outage
        }
    ];
    const methodToCall = {
        inputArguments,
        methodId: "ns=1;s=SimulateNetworkOutage",
        objectId: "ns=1;s=MyObject"
    };
    const r = await session.call(methodToCall);
    debugLog(r.toString());

    // Brutally destroy underlying socket to emulate abrupt network failure.
    // `getTransport()` now returns `IClientTransport | undefined`; here we know
    // we built the client with the default factory so the concrete type is
    // `ClientTCP_transport` and `._socket` is available.
    const secureChannel = (theClient as unknown as OPCUAClientImpl)._secureChannel; // internal
    const transport = secureChannel?.getTransport() as ClientTCP_transport | undefined;
    const clientSocket = transport?._socket;
    clientSocket?.end();
    clientSocket?.destroy();
    clientSocket?.emit("error", new Error(socketError));
    await new Promise((resolve) => setImmediate(resolve));
}

async function provoke_server_session_early_termination(): Promise<void> {
    const methodToCall = {
        inputArguments: [],
        methodId: "ns=1;s=ScrapSession",
        objectId: "ns=1;s=MyObject"
    };
    const r = await session.call(methodToCall);
    debugLog(r.toString());
    await new Promise((resolve) => setImmediate(resolve));
}

async function start_active_client_no_subscription(connectionStrategy: ConnectionStrategyOptions | undefined): Promise<void> {
    if (!server_data) throw new Error("Server not started");
    const endpointUrl = server_data.endpointUrl;

    client = OPCUAClient.create({
        connectionStrategy,
        endpointMustExist: false,
        keepSessionAlive: true,
        requestedSessionTimeout: 5_000 // intentionally small to exercise lifetime churn
    });

    await client.connect(endpointUrl);
    client.on("connection_reestablished", () => {
        debugLog(chalk.bgWhite.red(" *** CONNECTION RE-ESTABLISHED ***"));
    });
    client.on("backoff", (number: number, delay: number) => {
        debugLog(chalk.bgWhite.yellow("backoff attempt #"), number, " retrying in ", delay, "ms");
    });

    session = await client.createSession();
    debugLog("session timeout = ", session.timeout);

    session.on("session_closed", (statusCode) => {
        debugLog(chalk.yellow("Session has closed : statusCode = "), statusCode ? statusCode.toString() : "????");
    });
}

async function start_active_client(connectionStrategy: ConnectionStrategyOptions | undefined): Promise<void> {
    await start_active_client_no_subscription(connectionStrategy);

    const nodeId = coerceNodeId("ns=1;s=MyCounter");

    const parameters = {
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 1_000,
        requestedMaxKeepAliveCount: 12,
        maxNotificationsPerPublish: 10,
        publishingEnabled: true,
        priority: 10
    };

    subscription = await ClientSubscription.create(session, parameters);

    subscription.on("initialized", () => {
        debugLog("started subscription:", subscription?.subscriptionId);
        debugLog(" revised parameters ");
        debugLog(
            "  revised maxKeepAliveCount  ",
            subscription?.maxKeepAliveCount,
            " ( requested ",
            `${parameters.requestedMaxKeepAliveCount})`
        );
        debugLog(
            "  revised lifetimeCount      ",
            subscription?.lifetimeCount,
            " ( requested ",
            `${parameters.requestedLifetimeCount})`
        );
        debugLog(
            "  revised publishingInterval ",
            subscription?.publishingInterval,
            " ( requested ",
            `${parameters.requestedPublishingInterval})`
        );
        debugLog("  suggested timeout hint     ", (subscription as ClientSubscriptionImpl).publishEngine.timeoutHint);
    });

    session.on("keepalive", (state) => {
        if (doDebug && subscription) {
            debugLog(
                chalk.yellow("KeepAlive state="),
                state.toString(),
                " pending request on server = ",
                (subscription as ClientSubscriptionImpl).publishEngine.nbPendingPublishRequests
            );
        }
    });

    subscription
        .on("internal_error", (err: Error) => {
            debugLog(" received internal error", err.message);
        })
        .on("keepalive", () => {
            if (subscription) {
                debugLog(
                    chalk.cyan("keepalive "),
                    chalk.cyan(" pending request on server = "),
                    (subscription as ClientSubscriptionImpl).publishEngine.nbPendingPublishRequests
                );
            }
        })
        .on("terminated", (err: Error | null) => {
            debugLog("Session Terminated", err ? err.message : "null");
        });

    const requestedParameters = {
        samplingInterval: 250,
        queueSize: 1,
        discardOldest: true
    };
    const item = { nodeId, attributeId: AttributeIds.Value };

    monitoredItem = await subscription.monitor(item, requestedParameters, TimestampsToReturn.Both, MonitoringMode.Reporting);

    monitoredItem.on("err", (errMessage: string) => errorLog(errMessage));
    monitoredItem.on("changed", (dataValue) => {
        if (doDebug) {
            debugLog(chalk.cyan(" VALUE CHANGED"), dataValue.statusCode.toString(), dataValue.value.toString());
        }
    });
    monitoredItem.on("initialized", () => doDebug && debugLog(" MonitoredItem initialized"));

    let counter = 0;
    intervalId = setInterval(async () => {
        if (doDebug && subscription) {
            const sessionImpl = session as ClientSessionImpl;
            debugLog(
                " Session OK ? ",
                sessionImpl.isChannelValid?.(),
                "session expires in ",
                (sessionImpl.evaluateRemainingLifetime?.() || 0) / 1000,
                " s",
                chalk.red("subscription expires in "),
                ((subscription as ClientSubscriptionImpl).evaluateRemainingLifetime?.() || 0) / 1000,
                " s",
                chalk.red("subscription count"),
                sessionImpl.subscriptionCount
            );
        }

        const nodeToWrite = {
            nodeId,
            attributeId: AttributeIds.Value,
            value: {
                statusCode: StatusCodes.Good,
                sourceTimestamp: new Date(),
                value: { dataType: DataType.Int32, value: counter }
            }
        };
        try {
            const statusCode = await (session as ClientSessionImpl).write(nodeToWrite);
            if (doDebug) {
                debugLog("       writing OK counter =", counter, statusCode.toString());
            }
            counter += 1;
        } catch (err) {
            if (doDebug) {
                debugLog(chalk.red("       writing Failed "), (err as Error).message);
            }
        }
    }, 250);
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function terminate_active_client(): Promise<void> {
    if (!client) return;
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    try {
        await session.close();
    } catch {
        /* ignore */
    }
    await client.disconnect();
    client = null;
}

async function f(func: () => Promise<void>): Promise<void> {
    const nameDecorated = func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**"));
    debugLog(`       * ${nameDecorated}`);
    await func();
    debugLog(`       ! ${nameDecorated}`);
}

describeWithLeakDetector(
    "GHGL1 - Testing client reconnection with a crashing server that closes the session too early (such as KepwareServerEx6)",
    function (this: Mocha.Context) {
        this.timeout(100_000);

        afterEach(async () => {
            await terminate_active_client();
            await crash_external_opcua_server();
        });

        async function when_connection_is_broken() {
            if (!client) throw new Error("Client not started");
            await break_connection(client, "ECONNRESET");
        }
        async function given_a_running_opcua_server() {
            await start_external_opcua_server();
        }

        async function when_the_server_crash() {
            await crash_external_opcua_server();
        }

        async function when_the_server_restart() {
            await start_external_opcua_server();
        }

        async function when_the_server_restart_after_some_very_long_time() {
            await new Promise((resolve) => setTimeout(resolve, 6_000));
            await when_the_server_restart();
        }

        // Armed by every given_* step, BEFORE the connection is broken, so
        // that a reconnection completing on the very first retry attempt can
        // never slip past the then_* steps: on a fast/local network the
        // simulated 10s outage can leave the transport connect merely
        // stalling (not failing), in which case ZERO backoff events ever fire
        // (backoff only fires on a *failed* attempt) and session_restored is
        // emitted exactly once, possibly before a then_* step gets to attach
        // its own listener. Counting from the start makes both observations
        // race-free.
        let session_restored_count = 0;
        function arm_session_restored_counter() {
            session_restored_count = 0;
            session.on("session_restored", () => {
                session_restored_count += 1;
                debugLog("session has been restored (count = ", session_restored_count, ")");
            });
        }

        async function given_a_active_client_with_subscription_and_monitored_items() {
            // Default reconnection strategy (infinite retry)
            await start_active_client({ maxRetry: -1, initialDelay: 100, maxDelay: 200 });
            arm_session_restored_counter();
        }
        async function given_a_active_client() {
            await start_active_client_no_subscription({ maxRetry: -1, initialDelay: 100, maxDelay: 200 });
            arm_session_restored_counter();
        }

        async function given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy() {
            // Fail-fast initial strategy (client logic should still retry indefinitely after connection loss)
            await start_active_client({ maxRetry: 2, initialDelay: 100, maxDelay: 200 });
            arm_session_restored_counter();
        }

        async function then_client_should_detect_failure_and_enter_reconnection_mode() {
            let backoff_counter = 0;
            if (!client) throw new Error("Client not started");
            // Resolve on EITHER 2 backoff events OR the session having been
            // restored (see arm_session_restored_counter) — requiring a fixed
            // backoff count alone hangs forever when the first retry succeeds.
            if (session_restored_count > 0) {
                return;
            }
            await new Promise<void>((resolve) => {
                let settled = false;
                const settle = () => {
                    if (settled) return;
                    settled = true;
                    client?.removeListener("backoff", backoff_detector);
                    session.removeListener("session_restored", on_session_restored);
                    resolve();
                };
                const backoff_detector = () => {
                    backoff_counter += 1;
                    if (backoff_counter === 2) {
                        if (doDebug) {
                            debugLog("Bingo !  Client has detected disconnection and is currently trying to reconnect");
                        }
                        settle();
                    }
                };
                const on_session_restored = () => {
                    if (doDebug) {
                        debugLog("Bingo !  session was restored before 2 backoff events were observed");
                    }
                    settle();
                };
                client?.on("backoff", backoff_detector);
                session.on("session_restored", on_session_restored);
            });
        }

        async function then_client_should_reconnect() {
            // The restoration may already have happened while the previous
            // step was still waiting (session_restored fires exactly once per
            // reconnection) — check the counter armed before the break first.
            if (session_restored_count > 0) {
                return;
            }
            await new Promise<void>((resolve) => {
                const on_session_restored = () => {
                    session.removeListener("session_restored", on_session_restored);
                    resolve();
                };
                session.on("session_restored", on_session_restored);
            });
        }

        async function then_client_should_reconnect_and_restore_subscription() {
            if (!monitoredItem) throw new Error("monitoredItem not created");
            let change_counter = 0;

            await new Promise<void>((resolve) => {
                const on_value_changed = (dataValue: DataValue) => {
                    change_counter += 1;
                    if (doDebug) {
                        debugLog(" DataValue changed again", dataValue.toString());
                    }
                    if (change_counter === 3) {
                        monitoredItem?.removeListener("value_changed", on_value_changed);
                        resolve();
                    }
                };
                monitoredItem?.on("changed", on_value_changed);
            });
        }

        it("GZZE1 should reconnection and restore subscriptions when server becomes available again", async () => {
            await f(given_a_running_opcua_server);
            await f(given_a_active_client_with_subscription_and_monitored_items);
            await f(when_the_server_crash);
            await f(then_client_should_detect_failure_and_enter_reconnection_mode);
            await f(when_the_server_restart);
            await f(then_client_should_reconnect_and_restore_subscription);
        });

        it("GZZE2 testing reconnection with failFastReconnection strategy #606", async () => {
            // Even with a short maxRetry (fail-fast) initial strategy, once a channel existed the client will keep
            // trying forever to restore it after an unexpected disconnection.
            await f(given_a_running_opcua_server);
            await f(given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy);
            await f(when_the_server_crash);
            await f(then_client_should_detect_failure_and_enter_reconnection_mode);
            await f(when_the_server_restart_after_some_very_long_time);
            await f(then_client_should_reconnect_and_restore_subscription);
        });

        async function when_server_closes_session_too_early() {
            await provoke_server_session_early_termination();
        }
        let c = 0;
        async function when_client_detects_a_sessionIdInvalid() {
            const nodeId = coerceNodeId("ns=1;s=MyCounter");

            try {
                const statusCode = await (session as ClientSessionImpl).write({
                    nodeId,
                    attributeId: AttributeIds.Value,
                    value: {
                        statusCode: StatusCodes.Good,
                        value: { dataType: DataType.Int32, value: c++ }
                    }
                });
                debugLog("Write Status code =", statusCode.toString());
            } catch (err) {
                if ((err as Error).message.match(/BadSessionIdInvalid/)) {
                    // expected: the previous session has been scrapped by the server
                    return;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 2_000));
            if (c < 3) {
                await when_client_detects_a_sessionIdInvalid();
            }
        }
        async function then_it_should_succeed_to_recover() {
            // If we reached here without throwing, recovery path worked.
        }
        it("GZZE3 should reconnect when network is broken", async () => {
            await f(given_a_running_opcua_server);
            await f(given_a_active_client);
            await f(when_connection_is_broken);
            await f(then_client_should_detect_failure_and_enter_reconnection_mode);
            await f(then_client_should_reconnect);
            await f(when_server_closes_session_too_early);
            await f(when_client_detects_a_sessionIdInvalid);
            await f(then_it_should_succeed_to_recover);
        });
    }
);
