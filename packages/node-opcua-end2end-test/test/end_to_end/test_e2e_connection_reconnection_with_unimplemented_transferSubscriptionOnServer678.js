const async = require("async");
const chalk = require("chalk");
const path = require("path");
const start_simple_server = require("../../test_helpers/external_server_fixture").start_simple_server;
const stop_simple_server = require("../../test_helpers/external_server_fixture").stop_simple_server;

const doDebug = false;

let server_data = null;

async function start_external_opcua_server() {

    const options = {
 //       server_sourcefile: path.join(__dirname, "../../test_helpers/bin/simple_server_with_custom_extension_objects.js"),
        server_sourcefile: path.join(__dirname, "../../test_helpers/bin/simple_server_with_no_transferSubscription.js"),
        port: 2223
    };

    await new Promise((resolve, reject) => {
        start_simple_server(options, function (err, data) {
            if (err) {
                return reject(err);
            }
            console.log("data", data.endpointUrl);
            console.log("certificate", data.serverCertificate.toString("base64").substring(0, 32) + "...");
            console.log("pid", data.pid_collected);

            server_data = data;
            resolve(err);
        });
    });


}

async function crash_external_opcua_server() {

    if (!server_data) {
        return;
    }
    const promise = new Promise((resolve) => {
        server_data.process.once("exit", function (err) {
            console.log("process killed");
            resolve();
        });
        server_data.process.kill("SIGTERM");
        server_data = null;
    });
    await promise;
}

const opcua = require("node-opcua");
// ---------------------------------------------------------------------------------------------------------------------
let client, session, subscription, intervalId, monitoredItem;

async function start_active_client(connectionStrategy) 
{

    const endpointUrl = server_data.endpointUrl;

    client = opcua.OPCUAClient.create({
        connectionStrategy,
        endpoint_must_exist: false,
        keepSessionAlive: true,
        requestedSessionTimeout: 60000
    });

    const nodeId = opcua.coerceNodeId("ns=1;s=MyCounter");

    await client.connect(endpointUrl);
    client.on("connection_reestablished", function () {
        console.log(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
    });
    client.on("backoff", function (number, delay) {
        console.log(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
    });

    session = await client.createSession();
    console.log("session timeout = ", session.timeout);
    session.on("keepalive", (state)  => {
        if (doDebug) {
            console.log(chalk.yellow("KeepAlive state="),
                state.toString(), " pending request on server = ",
                subscription.publish_engine.nbPendingPublishRequests);
        }
    });
    session.on("session_closed", (statusCode)  =>{
        console.log(chalk.yellow("Session has closed : statusCode = "), statusCode ? statusCode.toString() : "????");
    });
    const parameters = {
        requestedPublishingInterval: 100,
        requestedLifetimeCount: 1000,
        requestedMaxKeepAliveCount: 12,
        maxNotificationsPerPublish: 10,
        publishingEnabled: true,
        priority: 10
    };

    subscription = await opcua.ClientSubscription.create(session, parameters);

    subscription.on("initialized",()=> {
        console.log("started subscription :", subscription.subscriptionId);
        console.log(" revised parameters ");
        console.log("  revised maxKeepAliveCount  ", subscription.maxKeepAliveCount, " ( requested ", parameters.requestedMaxKeepAliveCount + ")");
        console.log("  revised lifetimeCount      ", subscription.lifetimeCount, " ( requested ", parameters.requestedLifetimeCount + ")");
        console.log("  revised publishingInterval ", subscription.publishingInterval, " ( requested ", parameters.requestedPublishingInterval + ")");
        console.log("  suggested timeout hint     ", subscription.publish_engine.timeoutHint);    
    });

    subscription.on("internal_error", function (err) {
        console.log(" received internal error", err.message);
    }).on("keepalive", function () {

        console.log(chalk.cyan("keepalive "),
         chalk.cyan(" pending request on server = "),
         subscription.publish_engine.nbPendingPublishRequests);

    }).on("terminated", function (err) {
        console.log("Session Terminated", err.message);
    });


    const result = [];
    const requestedParameters = {
        samplingInterval: 250,
        queueSize: 1,
        discardOldest: true
    };
    const item = { nodeId: nodeId, attributeId: opcua.AttributeIds.Value };

    monitoredItem = await opcua.ClientMonitoredItem.create(subscription, item, requestedParameters, opcua.TimestampsToReturn.Both);
    monitoredItem.on("err", function (errMessage) {
        throw new Error(errMessage);
    });
    monitoredItem.on("changed", function (dataValue) {
        if (doDebug) {
            console.log(chalk.cyan(" ||||||||||| VALUE CHANGED !!!!"), dataValue.statusCode.toString(), dataValue.value.toString());
        }
        result.push(dataValue);
    });
    monitoredItem.on("initialized", function () {
        if (doDebug) {
            console.log(" MonitoredItem initialized");
        }
    });


    let counter = 0;
    intervalId = setInterval(function () {
        if (doDebug) {

            console.log(" Session OK ? ", session.isChannelValid(),
                "session will expired in ", session.evaluateRemainingLifetime() / 1000, " seconds",
                chalk.red("subscription will expire in "), subscription.evaluateRemainingLifetime() / 1000, " seconds",
                chalk.red("subscription?"), session.subscriptionCount);
        }
        if (!session.isChannelValid() && false) {
            //xx console.log(the_session.toString());
            return; // ignore write as session is invalid for the time being
        }

        let nodeToWrite = {
            nodeId: nodeId,
            attributeId: opcua.AttributeIds.Value,
            value: /* DataValue */{
                statusCode: opcua.StatusCodes.Good,
                sourceTimestamp: new Date(),
                value: /* Variant */{
                    dataType: opcua.DataType.Int32,
                    value: counter
                }
            }
        };
        session.write([nodeToWrite], function (err, statusCode) {
            if (err) {
                if (doDebug) {
                    console.log(chalk.red("       writing Failed "), err.message);
                }
            } else {
                if (doDebug) {
                    console.log("       writing OK counter =", counter, statusCode.toString());
                }
                counter += 1;
            }
            //xx statusCode && statusCode.length===1) ? statusCode[0].toString():"");
        });

    }, 250);
    await new Promise((resolve) => setTimeout(resolve,1000));
}

async function terminate_active_client() {

    if (!client) {
        return ;
    }
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    await session.close();
    await client.disconnect();
    client = null;
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing client reconnection with crashing server that do not implement transferSubscription server (such as Siemens S7)", function () {

    this.timeout(100000);

    async function f(func) {
        await async function () {
            console.log("       * " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, chalk.green("**$1**")));
            await func();
        }();
    }

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

        let backoff_counter = 0;

        await new Promise((resolve) => {
            function backoff_detector() {
                backoff_counter += 1;
                if (backoff_counter === 2) {
                    if (doDebug) {
                        console.log("Bingo !  Client has detected disconnection and is currently trying to reconnect");
                    }
                    client.removeListener("backoff", backoff_detector);
                    resolve();
                }
            }
            client.on("backoff", backoff_detector);
    
        });

    }

    async function then_client_should_reconnect_and_restore_subscription() {

        let change_counter = 0;

        await new Promise((resolve) => {
            function on_value_changed(dataValue) {
                change_counter += 1;
                if (doDebug) {
                    console.log(" |||||||||||||||||||| DataValue changed again !!!", dataValue.toString());
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