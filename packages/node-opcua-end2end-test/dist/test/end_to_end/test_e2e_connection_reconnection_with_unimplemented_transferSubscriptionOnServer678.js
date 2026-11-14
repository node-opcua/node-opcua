import "should"; // assertion side effects
import chalk from "chalk";
import { AttributeIds, ClientMonitoredItem, ClientSubscription, coerceNodeId, DataType, OPCUAClient, StatusCodes, TimestampsToReturn } from "node-opcua";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector } from "node-opcua-leak-detector";
import { crash_simple_server, start_simple_server } from "../../test_helpers/external_server_fixture.js";
import { serverScript as serverScriptPath } from "../../test_helpers/paths.js";
// -------------------------------------------------------------------------------------------------
// This test covers reconnection logic when the server either fails to republish or doesn't implement
// the TransferSubscriptions service (legacy / limited implementations). Two external server scripts
// are exercised to validate robustness of the client's session + subscription recovery path.
// -------------------------------------------------------------------------------------------------
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");
const serverScript1 = "simple_server_that_fails_to_republish.cjs";
const serverScript2 = "simple_server_with_no_transferSubscription.cjs";
let serverScript = serverScript1;
const port = 2049;
let server_data = null;
async function start_external_opcua_server() {
    const options = {
        silent: true,
        server_sourcefile: serverScriptPath(serverScript),
        port
    };
    server_data = await start_simple_server(options);
}
async function crash_external_opcua_server() {
    if (!server_data)
        return;
    await crash_simple_server(server_data);
    server_data = null;
}
// ---------------------------------------------------------------------------------------------------------------------
let client = null;
let session; // populated after client connect
let subscription = null;
let intervalId = null;
let monitoredItem = null;
async function start_active_client(connectionStrategy) {
    if (!server_data)
        throw new Error("Server not started");
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
    client.on("backoff", (number, delay) => {
        debugLog(chalk.bgWhite.yellow("backoff attempt #"), number, " retrying in ", delay / 1000, " seconds");
    });
    session = await client.createSession();
    debugLog("session timeout = ", session.timeout);
    session.on("keepalive", (state) => {
        if (doDebug && subscription) {
            debugLog(chalk.yellow("KeepAlive state="), state.toString(), " pending request on server = ", subscription.getPublishEngine().nbPendingPublishRequests);
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
    subscription = ClientSubscription.create(session, parameters);
    subscription.on("initialized", () => {
        debugLog("started subscription:", subscription?.subscriptionId);
        debugLog(" revised parameters ");
        debugLog("  revised maxKeepAliveCount  ", subscription?.maxKeepAliveCount, " ( requested ", `${parameters.requestedMaxKeepAliveCount})`);
        debugLog("  revised lifetimeCount      ", subscription?.lifetimeCount, " ( requested ", `${parameters.requestedLifetimeCount})`);
        debugLog("  revised publishingInterval ", subscription?.publishingInterval, " ( requested ", `${parameters.requestedPublishingInterval})`);
        debugLog("  suggested timeout hint     ", subscription.getPublishEngine().timeoutHint);
    });
    subscription
        .on("internal_error", (err) => debugLog(" received internal error", err.message))
        .on("keepalive", () => {
        if (subscription) {
            debugLog(chalk.cyan("keepalive "), chalk.cyan(" pending request on server = "), subscription.getPublishEngine().nbPendingPublishRequests);
        }
    })
        .on("terminated", (err) => {
        debugLog("Session Terminated", err ? err.message : "null");
    });
    const requestedParameters = {
        samplingInterval: 250,
        queueSize: 1,
        discardOldest: true
    };
    const item = { nodeId, attributeId: AttributeIds.Value };
    monitoredItem = await ClientMonitoredItem.create(subscription, item, requestedParameters, TimestampsToReturn.Both);
    monitoredItem.on("err", (errMessage) => {
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
            const subscriptionImpl = subscription;
            debugLog(" Session OK ? ", subscriptionImpl.isChannelValid?.(), "session expires in ", (subscriptionImpl.evaluateRemainingLifetime?.() || 0) / 1000, " s", chalk.red("subscription expires in "), (subscriptionImpl.evaluateRemainingLifetime?.() || 0) / 1000, " s", chalk.red("subscription count"), subscriptionImpl.subscriptionCount);
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
            const statusCode = await session.write(nodeToWrite);
            if (doDebug) {
                debugLog("       writing OK counter =", counter, statusCode.toString());
            }
            counter += 1;
        }
        catch (err) {
            if (doDebug) {
                debugLog(chalk.red("       writing Failed "), err.message);
            }
        }
    }, 250);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
}
async function terminate_active_client() {
    if (!client)
        return;
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    try {
        await session.close();
    }
    catch {
        /* ignore */
    }
    await client.disconnect();
    client = null;
}
async function f(func) {
    const decorated = func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**"));
    debugLog(`       * ${decorated}`);
    await func();
    debugLog(`       ! ${decorated}`);
}
describeWithLeakDetector("Testing client reconnection with a crashing server that does not implement transferSubscription server (such old Siemens S7)", function () {
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
        if (!client)
            throw new Error("Client not started");
        await new Promise((resolve) => {
            const backoff_detector = () => {
                backoff_counter += 1;
                if (backoff_counter === 2) {
                    if (doDebug) {
                        debugLog("Bingo !  Client has detected disconnection and is currently trying to reconnect");
                    }
                    client?.removeListener("backoff", backoff_detector);
                    resolve();
                }
            };
            client?.on("backoff", backoff_detector);
        });
    }
    async function then_client_should_reconnect_and_restore_subscription() {
        if (!monitoredItem)
            throw new Error("monitoredItem not started");
        let change_counter = 0;
        await new Promise((resolve) => {
            const on_value_changed = (dataValue) => {
                change_counter += 1;
                if (doDebug) {
                    debugLog(" DataValue changed again", dataValue.toString());
                }
                if (change_counter === 3) {
                    monitoredItem?.removeListener("changed", on_value_changed);
                    resolve();
                }
            };
            monitoredItem?.on("changed", on_value_changed);
        });
    }
    function a(_serverScript) {
        before(() => (serverScript = _serverScript));
        it(`${_serverScript}HZZE2 - should reconnection and restore subscriptions when server becomes available again`, async () => {
            await f(given_a_running_opcua_server);
            await f(given_a_active_client_with_subscription_and_monitored_items);
            await f(when_the_server_crash);
            await f(then_client_should_detect_failure_and_enter_reconnection_mode);
            await f(when_the_server_restart);
            await f(then_client_should_reconnect_and_restore_subscription);
        });
        it(`${_serverScript}HZZE3 - testing reconnection with failFastReconnection strategy #606`, async () => {
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
});
//# sourceMappingURL=test_e2e_connection_reconnection_with_unimplemented_transferSubscriptionOnServer678.js.map