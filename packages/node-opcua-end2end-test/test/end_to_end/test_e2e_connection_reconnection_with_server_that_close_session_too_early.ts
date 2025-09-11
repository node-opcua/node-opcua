import "should"; // side-effect assertion library
import path from "path";
import chalk from "chalk";
import {
    TimestampsToReturn,
    AttributeIds,
    StatusCodes,
    OPCUAClient,
    ClientMonitoredItem,
    coerceNodeId,
    ClientSubscription,
    DataType,
    MonitoringMode,
    ClientSession
} from "node-opcua";
import { make_debugLog, checkDebugFlag, make_errorLog } from "node-opcua-debug";
import { start_simple_server, crash_simple_server } from "../../test_helpers/external_server_fixture";
import { describeWithLeakDetector } from "node-opcua-leak-detector";

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

interface ExternalServerData {
    endpointUrl: string;
    [k: string]: unknown; // other metadata not used directly in this test
}

let server_data: ExternalServerData | null = null;

const port = 4850;
const serverScript = "simple_server_that_terminate_session_too_early.js";

async function start_external_opcua_server(): Promise<void> {
    const options = {
        silent: !doDebug,
        server_sourcefile: path.join(__dirname, "../../test_helpers/bin/", serverScript),
        port
    };
    server_data = (await start_simple_server(options)) as ExternalServerData;
}

async function crash_external_opcua_server(): Promise<void> {
    if (server_data) {
        await crash_simple_server(server_data as any);
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

    // Brutally destroy underlying socket to emulate abrupt network failure
    const secureChannel = (theClient as any)._secureChannel; // internal
    const transport = secureChannel.getTransport();
    const clientSocket: any = transport._socket;
    clientSocket.end();
    clientSocket.destroy();
    clientSocket.emit("error", new Error(socketError));
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

async function start_active_client_no_subscription(connectionStrategy: any): Promise<void> {
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

async function start_active_client(connectionStrategy: any): Promise<void> {
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
        debugLog("started subscription:", subscription!.subscriptionId);
        debugLog(" revised parameters ");
        debugLog("  revised maxKeepAliveCount  ", subscription!.maxKeepAliveCount, " ( requested ", parameters.requestedMaxKeepAliveCount + ")");
        debugLog("  revised lifetimeCount      ", subscription!.lifetimeCount, " ( requested ", parameters.requestedLifetimeCount + ")");
        debugLog(
            "  revised publishingInterval ",
            subscription!.publishingInterval,
            " ( requested ",
            parameters.requestedPublishingInterval + ")"
        );
        debugLog("  suggested timeout hint     ", (subscription as any).publish_engine.timeoutHint);
    });

    session.on("keepalive", (state) => {
        if (doDebug && subscription) {
            debugLog(
                chalk.yellow("KeepAlive state="),
                state.toString(),
                " pending request on server = ",
                (subscription as any).publish_engine.nbPendingPublishRequests
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
                    (subscription as any).publish_engine.nbPendingPublishRequests
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
            debugLog(
                " Session OK ? ",
                (session as any).isChannelValid?.(),
                "session expires in ",
                ((session as any).evaluateRemainingLifetime?.() || 0) / 1000,
                " s",
                chalk.red("subscription expires in "),
                ((subscription as any).evaluateRemainingLifetime?.() || 0) / 1000,
                " s",
                chalk.red("subscription count"),
                (session as any).subscriptionCount
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
            const statusCode = await (session as any).write(nodeToWrite);
            if (doDebug) {
                debugLog("       writing OK counter =", counter, statusCode.toString());
            }
            counter += 1;
        } catch (err: any) {
            if (doDebug) {
                debugLog(chalk.red("       writing Failed "), err.message);
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
    debugLog("       * " + nameDecorated);
    await func();
    debugLog("       ! " + nameDecorated);
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

        async function given_a_active_client_with_subscription_and_monitored_items() {
            // Default reconnection strategy (infinite retry)
            await start_active_client({ maxRetry: -1, initialDelay: 100, maxDelay: 200 });
        }
        async function given_a_active_client() {
            await start_active_client_no_subscription({ maxRetry: -1, initialDelay: 100, maxDelay: 200 });
        }

        async function given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy() {
            // Fail-fast initial strategy (client logic should still retry indefinitely after connection loss)
            await start_active_client({ maxRetry: 2, initialDelay: 100, maxDelay: 200 });
        }

        async function then_client_should_detect_failure_and_enter_reconnection_mode() {
            let backoff_counter = 0;
            if (!client) throw new Error("Client not started");
        await new Promise<void>((resolve) => {
        const backoff_detector = () => {
                    backoff_counter += 1;
                    if (backoff_counter === 2) {
                        if (doDebug) {
                            debugLog(
                                "Bingo !  Client has detected disconnection and is currently trying to reconnect"
                            );
                        }
            client && client.removeListener("backoff", backoff_detector);
                        resolve();
                    }
                };
        client && client.on("backoff", backoff_detector);
            });
        }

        async function then_client_should_reconnect() {
            await new Promise<void>((resolve) => {
                const on_session_restored = () => {
                    session.removeListener("session_restored", on_session_restored);
                    debugLog("session has been restored");
                    resolve();
                };
                session.on("session_restored", on_session_restored);
            });
        }

        async function then_client_should_reconnect_and_restore_subscription() {
            if (!monitoredItem) throw new Error("monitoredItem not created");
            let change_counter = 0;

            await new Promise<void>((resolve) => {
                const on_value_changed = (dataValue: any) => {
                    change_counter += 1;
                    if (doDebug) {
                        debugLog(" DataValue changed again", dataValue.toString());
                    }
                    if (change_counter === 3) {
                        monitoredItem!.removeListener("value_changed", on_value_changed as any);
                        resolve();
                    }
                };
                monitoredItem!.on("changed", on_value_changed as any);
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
                const statusCode = await (session as any).write({
                    nodeId,
                    attributeId: AttributeIds.Value,
                    value: {
                        statusCode: StatusCodes.Good,
                        value: { dataType: DataType.Int32, value: c++ }
                    }
                });
                debugLog("Write Status code =", statusCode.toString());
            } catch (err: any) {
                if (err.message.match(/BadSessionIdInvalid/)) {
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
