import path from "path";
import chalk from "chalk";
import {
    TimestampsToReturn,
    AttributeIds,
    OPCUAClient,
    ClientSubscription,
    ClientMonitoredItem,
    coerceNodeId,
    StatusCodes,
    DataType,
    MonitoringMode,
    NodeIdLike,
    ClientSession
} from "node-opcua";
import { make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { start_simple_server, crash_simple_server } from "../../test_helpers/external_server_fixture";
import "should";

const doDebug = false;
const debugLog = make_debugLog("TEST");

interface ExternalServerData {
    endpointUrl: string;
}

let server_data: ExternalServerData | null = null;
const port = 2016;

async function start_external_opcua_server() {
    const options = {
        silent: !doDebug,
        server_sourcefile: path.join(
            __dirname,
            "../../test_helpers/bin/simple_server_with_custom_extension_objects.js"
        ),
        port
    };
    server_data = (await start_simple_server(options)) as ExternalServerData;
}

async function crash_external_opcua_server() {
    if (server_data) {
        await crash_simple_server(server_data as any);
        server_data = null;
    }
}

// ---------------------------------------------------------------------------------------------------------------------
let client: OPCUAClient | null;
let session: ClientSession | null;
let intervalId: NodeJS.Timeout | null;
let monitoredItem: ClientMonitoredItem | null;
let subscription: ClientSubscription | null; // active subscription

async function start_active_client(connectionStrategy: any | undefined) {
    if (!server_data) throw new Error("Server not started");
    const endpointUrl = server_data.endpointUrl;

    client = OPCUAClient.create({
        connectionStrategy,
        endpointMustExist: false,
        keepSessionAlive: true,
        requestedSessionTimeout: 10000
    });

    client.on("connection_reestablished", () => {
        debugLog(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
    });
    client.on("backoff", (number: number, delay: number) => {
        debugLog(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
    });

    const nodeId = coerceNodeId("ns=1;s=MyCounter") as NodeIdLike;

    await client.connect(endpointUrl);
    session = await client.createSession();
    debugLog("session timeout = ", session.timeout);

    session.on("keepalive", (state: any) => {
        if (doDebug && subscription) {
            debugLog(
                chalk.yellow("KeepAlive state="),
                state.toString(),
                " pending request on server = ",
                (subscription as any).publishEngine.nbPendingPublishRequests
            );
        }
    });

    session.on("session_closed", (statusCode) => {
        debugLog(
            chalk.yellow("Session has closed : statusCode = "),
            statusCode ? statusCode.toString() : "????"
        );
    });

    const parameters = {
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 12,
        maxNotificationsPerPublish: 10,
        publishingEnabled: true,
        priority: 10
    };

    subscription = await session.createSubscription2(parameters);
    subscription
        .on("started", () => { /* started */ })
        .on("internal_error", (err: Error) => debugLog(" received internal error", err.message))
        .on("keepalive", () => {
            if (doDebug) {
                debugLog(
                    chalk.cyan("keepalive "),
                    chalk.cyan(" pending request on server = "),
                    (subscription as any).publishEngine.nbPendingPublishRequests
                );
            }
        })
        .on("terminated", (err: Error) => debugLog("Session Terminated", err.message));

    if (doDebug) {
        debugLog("started subscription :", subscription.subscriptionId);
        debugLog(" revised parameters ");
        debugLog(
            "  revised maxKeepAliveCount  ",
            subscription.maxKeepAliveCount,
            " ( requested ",
            parameters.requestedMaxKeepAliveCount + ")"
        );
        debugLog(
            "  revised lifetimeCount      ",
            subscription.lifetimeCount,
            " ( requested ",
            parameters.requestedLifetimeCount + ")"
        );
        debugLog(
            "  revised publishingInterval ",
            subscription.publishingInterval,
            " ( requested ",
            parameters.requestedPublishingInterval + ")"
        );
        debugLog("  suggested timeout hint     ", (subscription as any).publishEngine.timeoutHint);
    }

    const requestedParameters = { samplingInterval: 250, queueSize: 1, discardOldest: true };
    const itemToMonitor = { nodeId, attributeId: AttributeIds.Value };

    monitoredItem = await subscription.monitor(
        itemToMonitor,
        requestedParameters,
        TimestampsToReturn.Both,
        MonitoringMode.Reporting
    );

    monitoredItem.on("changed", (dataValue) => {
        if (doDebug) {
            debugLog(
                chalk.cyan(" ||||||||||| VALUE CHANGED !!!!"),
                dataValue.statusCode.toString(),
                dataValue.value.toString()
            );
        }
    });

    let counter = 0;
    const writeLoop = () => {
        if (!session || !client) return;
        if (doDebug && subscription) {
            debugLog(
                " Session OK ? ",
                (session as any).isChannelValid(),
                "session will expired in ",
                (session as any).evaluateRemainingLifetime() / 1000,
                " seconds",
                chalk.red("subscription will expire in "),
                (subscription as any).evaluateRemainingLifetime() / 1000,
                " seconds",
                chalk.red("subscription?"),
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
        } as any;
        session.write(nodeToWrite, (err) => {
            if (err) {
                if (doDebug) debugLog(chalk.red("       writing Failed "), err.message);
            } else {
                if (doDebug) debugLog("       writing OK counter =", counter);
                counter += 1;
            }
            setTimeout(writeLoop, 500);
        });
    };
    writeLoop();

    await new Promise((resolve) => setTimeout(resolve, 500));
}

async function terminate_active_client() {
    if (!client) return;
    if (intervalId) {
        clearInterval(intervalId); // intervalId not used explicitly after refactor but kept for parity
        intervalId = null;
    }
    if (session) {
        await session.close();
    }
    await client.disconnect();
    client = null;
    session = null;
    subscription = null;
    monitoredItem = null;
}

async function f(func: () => Promise<any>) {
    debugLog(
        "       * " +
            func.name
                .replace(/_/g, " ")
                .replace(/(given|when|then)/, chalk.green("**$1**"))
    );
    return await func();
}

describe("Testing client reconnection with crashing server", function (this: Mocha.Context) {
    this.timeout(100000);

    afterEach(async () => {
        debugLog("------------------------- Terminating client ----------------------------");
        await terminate_active_client();
        await crash_external_opcua_server();
    });

    async function given_a_running_opcua_server() { await start_external_opcua_server(); }
    async function when_the_server_crash() { await crash_external_opcua_server(); }
    async function when_the_server_restart() { await start_external_opcua_server(); }
    async function when_the_server_restart_after_some_very_long_time() {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        await when_the_server_restart();
    }
    async function when_the_client_emit_a_keep_alive_failure() {
        await new Promise((resolve) => (session as any)?.once("keepalive_failure", () => resolve(undefined)));
    }
    async function when_the_server_restart_after_some_very_long_time_greater_then_session_timeout() {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        await when_the_server_restart();
    }
    async function given_a_active_client_with_subscription_and_monitored_items() { await start_active_client(undefined); }
    async function given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy() {
        await start_active_client({ maxRetry: 2, initialDelay: 100, maxDelay: 200 });
    }
    async function then_client_should_detect_failure_and_enter_reconnection_mode() {
        await new Promise<void>((resolve) => {
            let backoff_counter = 0;
            function backoff_detector() {
                backoff_counter += 1;
                if (backoff_counter === 2) {
                    if (doDebug) {
                        debugLog("Bingo !  Client has detected disconnection and is currently trying to reconnect");
                    }
                    client!.removeListener("backoff", backoff_detector);
                    resolve();
                }
            }
            client!.on("backoff", backoff_detector);
        });
    }
    async function then_client_should_reconnect_and_restore_subscription() {
        if (!monitoredItem) throw new Error("monitoredItem missing");
        await new Promise<void>((resolve) => {
            let change_counter = 0;
            function on_value_changed() {
                change_counter += 1;
                if (doDebug) debugLog(" |||||||||||||||||||| DataValue changed again !!!");
                if (change_counter === 3) {
                    monitoredItem!.removeListener("changed", on_value_changed);
                    resolve();
                }
            }
            monitoredItem!.on("changed", on_value_changed);
        });
    }

    it("should reconnection and restore subscriptions when server becomes available again", async () => {
        await f(given_a_running_opcua_server);
        await f(given_a_active_client_with_subscription_and_monitored_items);
        await f(when_the_server_crash);
        await f(then_client_should_detect_failure_and_enter_reconnection_mode);
        await f(when_the_server_restart);
        await f(then_client_should_reconnect_and_restore_subscription);
    });

    it("testing reconnection with failFastReconnection strategy #606", async () => {
        // Even if client uses a fail fast reconnection strategy, a lost connection should cause retries
        await f(given_a_running_opcua_server);
        await f(given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy);
        await f(when_the_server_crash);
        await f(then_client_should_detect_failure_and_enter_reconnection_mode);
        await f(when_the_server_restart_after_some_very_long_time);
        await f(then_client_should_reconnect_and_restore_subscription);
    });
});
