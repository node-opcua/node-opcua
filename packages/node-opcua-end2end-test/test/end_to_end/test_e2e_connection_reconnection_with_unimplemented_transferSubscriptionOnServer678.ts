import "should"; // assertion side effects
import path from "path";
import chalk from "chalk";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import {
    OPCUAClient,
    coerceNodeId,
    StatusCodes,
    ClientMonitoredItem,
    ClientSubscription,
    AttributeIds,
    TimestampsToReturn,
    DataType,
    ClientSession
} from "node-opcua";
import { start_simple_server, crash_simple_server } from "../../test_helpers/external_server_fixture";
import { describeWithLeakDetector } from "node-opcua-leak-detector";

// -------------------------------------------------------------------------------------------------
// This test covers reconnection logic when the server either fails to republish or doesn't implement
// the TransferSubscriptions service (legacy / limited implementations). Two external server scripts
// are exercised to validate robustness of the client's session + subscription recovery path.
// -------------------------------------------------------------------------------------------------

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const serverScript1 = "simple_server_that_fails_to_republish.js";
const serverScript2 = "simple_server_with_no_transferSubscription.js";
let serverScript = serverScript1;

const port = 2049;

interface ExternalServerData {
    endpointUrl: string;
    [k: string]: unknown;
}
let server_data: ExternalServerData | null = null;
async function start_external_opcua_server(): Promise<void> {
    const options = {
        silent: true,
        server_sourcefile: path.join(__dirname, "../../test_helpers/bin", serverScript),
        port
    };
    server_data = (await start_simple_server(options)) as ExternalServerData;
}

async function crash_external_opcua_server(): Promise<void> {
    if (!server_data) return;
    await crash_simple_server(server_data as any);
    server_data = null;
}

// ---------------------------------------------------------------------------------------------------------------------
let client: OPCUAClient | null = null;
let session: ClientSession; // populated after client connect
let subscription: ClientSubscription | null = null;
let intervalId: NodeJS.Timeout | null = null;
let monitoredItem: ClientMonitoredItem | null = null;

async function start_active_client(connectionStrategy: any): Promise<void> {
    if (!server_data) throw new Error("Server not started");
    const endpointUrl = server_data.endpointUrl;

    client = OPCUAClient.create({
        connectionStrategy,
        endpointMustExist: false,
        keepSessionAlive: true,
        requestedSessionTimeout: 60_000
    });
    const nodeId = coerceNodeId("ns=1;s=MyCounter");

    await client.connect(endpointUrl);
    client.on("connection_reestablished", () => {
        debugLog(chalk.bgWhite.red(" *** CONNECTION RE-ESTABLISHED ***"));
    });
    client.on("backoff", (number: number, delay: number) => {
        debugLog(chalk.bgWhite.yellow("backoff attempt #"), number, " retrying in ", delay / 1000, " seconds");
    });

    session = await client.createSession();
    debugLog("session timeout = ", session.timeout);
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
    session.on("session_closed", (statusCode) => {
        debugLog(chalk.yellow("Session has closed : statusCode = "), statusCode ? statusCode.toString() : "????");
    });
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

    subscription
        .on("internal_error", (err: Error) => debugLog(" received internal error", err.message))
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

    monitoredItem = await ClientMonitoredItem.create(subscription, item, requestedParameters, TimestampsToReturn.Both);
    monitoredItem.on("err", (errMessage: string) => {
        throw new Error(errMessage);
    });
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
    await new Promise((resolve) => setTimeout(resolve, 1_000));
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
    const decorated = func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**"));
    debugLog("       * " + decorated);
    await func();
    debugLog("       ! " + decorated);
}

describeWithLeakDetector(
    "Testing client reconnection with a crashing server that does not implement transferSubscription server (such old Siemens S7)",
    function (this: Mocha.Context) {
        this.timeout(Math.max(120 * 1000, this.timeout()));

        afterEach(async () => {
            await terminate_active_client();
            await crash_external_opcua_server();
        });
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
            await new Promise((resolve) => setTimeout(resolve, 10_000));
            await when_the_server_restart();
        }

        async function given_a_active_client_with_subscription_and_monitored_items() {
            // Default parameters => infinite retry reconnection
            await start_active_client(undefined);
        }

        async function given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy() {
            // Fail fast initial strategy (client should still keep trying after initial failures)
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

        async function then_client_should_reconnect_and_restore_subscription() {
            if (!monitoredItem) throw new Error("monitoredItem not started");
            let change_counter = 0;
            await new Promise<void>((resolve) => {
                const on_value_changed = (dataValue: any) => {
                    change_counter += 1;
                    if (doDebug) {
                        debugLog(" DataValue changed again", dataValue.toString());
                    }
                    if (change_counter === 3) {
                        monitoredItem && monitoredItem.removeListener("changed", on_value_changed);
                        resolve();
                    }
                };
                monitoredItem && monitoredItem.on("changed", on_value_changed);
            });
        }

        function a(_serverScript: string) {
            before(() => (serverScript = _serverScript));
            it(
                _serverScript +
                    "HZZE2 - should reconnection and restore subscriptions when server becomes available again",
                async () => {
                    await f(given_a_running_opcua_server);
                    await f(given_a_active_client_with_subscription_and_monitored_items);
                    await f(when_the_server_crash);
                    await f(then_client_should_detect_failure_and_enter_reconnection_mode);
                    await f(when_the_server_restart);
                    await f(then_client_should_reconnect_and_restore_subscription);
                }
            );
            it(_serverScript + "HZZE3 - testing reconnection with failFastReconnection strategy #606", async () => {
                // Even if the client starts with a short maxRetry (fail-fast), once connected it should
                // keep retrying indefinitely after unexpected disconnection.
                await f(given_a_running_opcua_server);
                await f(given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy);
                await f(when_the_server_crash);
                await f(then_client_should_detect_failure_and_enter_reconnection_mode);
                await f(when_the_server_restart_after_some_very_long_time);
                await f(then_client_should_reconnect_and_restore_subscription);
            });
        }

        a(serverScript1);
        a(serverScript2);
    }
);
