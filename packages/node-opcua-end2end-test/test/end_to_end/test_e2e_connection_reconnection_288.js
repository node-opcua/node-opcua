const path = require("path");

const chalk = require("chalk");
const { make_debugLog } = require("node-opcua-debug");
const {
    TimestampsToReturn,
    AttributeIds,
    OPCUAClient,
    ClientSubscription,
    ClientMonitoredItem,
    coerceNodeId,
    StatusCodes,
    DataType,
    MonitoringMode
} = require("node-opcua");

const { start_simple_server, crash_simple_server } = require("../../test_helpers/external_server_fixture");

const doDebug = false;
const debugLog = make_debugLog("TEST");
let server_data = null;
const port = 2016;

async function start_external_opcua_server() {
    const options = {
        silent: !doDebug,
        server_sourcefile: path.join(__dirname, "../../test_helpers/bin/simple_server_with_custom_extension_objects.js"),
        port
    };
    server_data = await start_simple_server(options);
}

async function crash_external_opcua_server() {
    await crash_simple_server(server_data);
    server_data= null;
}

// ---------------------------------------------------------------------------------------------------------------------
let client, session, subscription, intervalId, monitoredItem;

async function start_active_client(connectionStrategy) {
    const endpointUrl = server_data.endpointUrl;

    client = OPCUAClient.create({
        connectionStrategy,
        endpointMustExist: false,
        keepSessionAlive: true,
        requestedSessionTimeout: 60000
    });
    client.on("connection_reestablished", ()=> {
        debugLog(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
    });
    client.on("backoff", function (number, delay) {
        debugLog(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
    });

    const nodeId = coerceNodeId("ns=1;s=MyCounter");

    await client.connect(endpointUrl);

    session = await client.createSession();

    debugLog("session timeout = ", session.timeout);

    session.on("keepalive", function (state) {
        if (doDebug) {
            debugLog(
                chalk.yellow("KeepAlive state="),
                state.toString(),
                " pending request on server = ",
                subscription.publish_engine.nbPendingPublishRequests
            );
        }
    });

    session.on("session_closed", function (statusCode) {
        debugLog(chalk.yellow("Session has closed : statusCode = "), statusCode ? statusCode.toString() : "????");
    });

    // create a subscription
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
        .on("started", ()=> {/** */})
        .on("internal_error", function (err) {
            debugLog(" received internal error", err.message);
        })
        .on("keepalive", ()=> {
            debugLog(
                chalk.cyan("keepalive "),
                chalk.cyan(" pending request on server = "),
                subscription.publish_engine.nbPendingPublishRequests
            );
        })
        .on("terminated", function (err) {
            debugLog("Session Terminated", err.message);
        });
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
        debugLog("  suggested timeout hint     ", subscription.publish_engine.timeoutHint);
    }

    const result = [];
    const requestedParameters = {
        samplingInterval: 250,
        queueSize: 1,
        discardOldest: true
    };

    const item = { nodeId: nodeId, attributeId: AttributeIds.Value };

    monitoredItem = await subscription.monitor(item, requestedParameters, TimestampsToReturn.Both, MonitoringMode.Reporting);

    monitoredItem.on("changed", function (dataValue) {
        if (doDebug) {
            debugLog(chalk.cyan(" ||||||||||| VALUE CHANGED !!!!"), dataValue.statusCode.toString(), dataValue.value.toString());
        }
        result.push(dataValue);
    });

    let counter = 0;

    function writeValue() {
        if (!intervalId) {
            return;
        }
        if (doDebug) {
            debugLog(
                " Session OK ? ",
                session.isChannelValid(),
                "session will expired in ",
                session.evaluateRemainingLifetime() / 1000,
                " seconds",
                chalk.red("subscription will expire in "),
                subscription.evaluateRemainingLifetime() / 1000,
                " seconds",
                chalk.red("subscription?"),
                session.subscriptionCount
            );
        }
        if (!session.isChannelValid() && false) {
            //xx debugLog(the_session.toString());
            return; // ignore write as session is invalid for the time being
        }

        let nodeToWrite = {
            nodeId: nodeId,
            attributeId: AttributeIds.Value,
            value: /* DataValue */ {
                statusCode: StatusCodes.Good,
                sourceTimestamp: new Date(),
                value: /* Variant */ {
                    dataType: DataType.Int32,
                    value: counter
                }
            }
        };
        session.write(nodeToWrite, function (err, statusCode) {
            if (err) {
                if (doDebug) {
                    debugLog(chalk.red("       writing Failed "), err.message);
                }
            } else {
                if (doDebug) {
                    debugLog("       writing OK counter =", counter, statusCode.toString());
                }
                counter += 1;
            }
            //xx statusCode && statusCode.length===1) ? statusCode[0].toString():"");
            setTimeout(writeValue, 500);
        });
    }
    writeValue();

    await new Promise((resolve) => setTimeout(resolve, 500));
}

async function terminate_active_client() {
    if (!client) {
        return;
    }
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (session) {
        await session.close();
    }
    await client.disconnect();
    client = null;
}

async function f(func) {
    return async ()=> {
        debugLog(
            "       * " +
                func.name
                    .replace(
                        /_/g,

                        " "
                    )
                    .replace(/(given|when|then)/, chalk.green("**$1**"))
        );
        return await func();
    };
}

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing client reconnection with crashing server", function () {
    this.timeout(100000);

    afterEach(async () => {
        debugLog("------------------------- Terminating client ----------------------------");
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
        await new Promise((resolve) => setTimeout(resolve, 10000));
        await when_the_server_restart();
    }

    async function given_a_active_client_with_subscription_and_monitored_items() {
        // this client starts with default parameters
        await start_active_client(undefined);
    }

    async function given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy() {
        // this client starts with fail fast connection strategy
        await start_active_client({ maxRetry: 2, initialDelay: 100, maxDelay: 200 });
    }

    async function then_client_should_detect_failure_and_enter_reconnection_mode() {
        await new Promise((resolve) => {
            let backoff_counter = 0;

            function backoff_detector() {
                backoff_counter += 1;
                if (backoff_counter === 2) {
                    if (doDebug) {
                        debugLog("Bingo !  Client has detected disconnection and is currently trying to reconnect");
                    }
                    client.removeListener("backoff", backoff_detector);
                    resolve();
                }
            }

            client.on("backoff", backoff_detector);
        });
    }

    async function then_client_should_reconnect_and_restore_subscription() {
        await new Promise((resolve) => {
            let change_counter = 0;
            function on_value_changed(dataValue) {
                change_counter += 1;
                if (doDebug) {
                    debugLog(" |||||||||||||||||||| DataValue changed again !!!", dataValue.toString());
                }
                if (change_counter === 3) {
                    monitoredItem.removeListener("value_changed", on_value_changed);
                    resolve();
                }
            }
            monitoredItem.on("changed", on_value_changed);
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
        // rationale:
        //  even if the OPCUAClient  uses a fail fast reconnection strategy, a lost of connection
        //  should cause an infinite retry to connect again
        await f(given_a_running_opcua_server);
        await f(given_a_active_client_with_subscription_and_monitored_items_AND_short_retry_strategy);
        await f(when_the_server_crash);
        await f(then_client_should_detect_failure_and_enter_reconnection_mode);
        await f(when_the_server_restart_after_some_very_long_time);
        await f(then_client_should_reconnect_and_restore_subscription);
    });
});
