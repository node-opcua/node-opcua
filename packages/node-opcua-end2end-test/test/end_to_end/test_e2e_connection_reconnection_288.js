const async = require("async");
require("colors");
const path = require("path");
const start_simple_server = require("../../test_helpers/external_server_fixture").start_simple_server;
const stop_simple_server = require("../../test_helpers/external_server_fixture").stop_simple_server;

const doDebug = false;

let server_data = null;

function start_external_opcua_server(callback) {

    const options = {
        server_sourcefile: path.join(__dirname, "../../test_helpers/bin/simple_server_with_custom_extension_objects.js"),
        port: 2223
    };

    start_simple_server(options, function (err, data) {
        console.log("data", data.endpointUrl);
        console.log("certificate", data.serverCertificate.toString("base64").substring(0, 32) + "...");
        console.log("pid", data.pid_collected);

        server_data = data;
        callback(err);
    });

}

function crash_external_opcua_server(callback) {

    if (!server_data) {
        return callback();
    }
    server_data.process.once("exit", function (err) {
        console.log("process killed");
        callback();
    });
    server_data.process.kill("SIGTERM");
    server_data = null;

}

const opcua = require("node-opcua");
// ---------------------------------------------------------------------------------------------------------------------
let client, the_session, the_subscription, intervalId, monitoredItem;

function start_active_client(callback) {

    const endpointUrl = server_data.endpointUrl;

    client = opcua.OPCUAClient.create({
        endpoint_must_exist: false,
        keepSessionAlive: true,
        requestedSessionTimeout: 60000,
    });

    const nodeId = opcua.coerceNodeId("ns=1;s=MyCounter");

    async.series([

            function client_connect(callback) {
                client.connect(endpointUrl, function (err) {
                    if (err) {
                        console.log(" cannot connect to endpoint :", endpointUrl);
                    } else {
                        console.log("connected !");
                    }
                    callback(err);
                });
                client.on("connection_reestablished", function () {
                    console.log(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!".bgWhite.red);
                });
                client.on("backoff", function (number, delay) {
                    console.log("backoff  attempt #".bgWhite.yellow, number, " retrying in ", delay / 1000.0, " seconds");
                });
            },

            function client_recreate_session(callback) {
                client.createSession(function (err, session) {
                    if (!err) {
                        the_session = session;
                    }
                    console.log("session timeout = ", session.timeout);
                    the_session.on("keepalive", function (state) {
                        if (doDebug) {
                            console.log("KeepAlive state=".yellow, state.toString(), " pending request on server = ".yellow, the_subscription.publish_engine.nbPendingPublishRequests);
                        }
                    });
                    the_session.on("session_closed", function (statusCode) {
                        console.log("Session has closed : statusCode = ".yellow, statusCode ? statusCode.toString() : "????");
                    });
                    callback(err);
                });
            },

            function client_create_subscription(callback) {
                // create a subscription
                const parameters = {
                    requestedPublishingInterval: 100,
                    requestedLifetimeCount: 1000,
                    requestedMaxKeepAliveCount: 12,
                    maxNotificationsPerPublish: 10,
                    publishingEnabled: true,
                    priority: 10
                };

                the_subscription = opcua.ClientSubscription.create(the_session, parameters);

                the_subscription.on("started", function () {

                    if (doDebug) {

                        console.log("started subscription :", the_subscription.subscriptionId);

                        console.log(" revised parameters ");
                        console.log("  revised maxKeepAliveCount  ", the_subscription.maxKeepAliveCount, " ( requested ", parameters.requestedMaxKeepAliveCount + ")");
                        console.log("  revised lifetimeCount      ", the_subscription.lifetimeCount, " ( requested ", parameters.requestedLifetimeCount + ")");
                        console.log("  revised publishingInterval ", the_subscription.publishingInterval, " ( requested ", parameters.requestedPublishingInterval + ")");
                        console.log("  suggested timeout hint     ", the_subscription.publish_engine.timeoutHint);

                    }
                    callback();

                }).on("internal_error", function (err) {
                    console.log(" received internal error", err.message);

                }).on("keepalive", function () {

                    console.log("keepalive ".cyan, " pending request on server = ".cyan, the_subscription.publish_engine.nbPendingPublishRequests);

                }).on("terminated", function (err) {
                    console.log("Session Terminated", err.message);
                });

            },

            function client_create_monitoredItem(callback) {

                const result = [];
                const requestedParameters= {
                    samplingInterval: 250,
                    queueSize: 1,
                    discardOldest: true
                };
                const item ={nodeId:nodeId, attributeId: opcua.AttributeIds.Value};

                monitoredItem = opcua.ClientMonitoredItem.create( the_subscription, item,requestedParameters,opcua.TimestampsToReturn.Both);
                monitoredItem.on("err",function(errMessage) {
                    callback(new Error(errMessage));
                 });
                monitoredItem.on("changed",function(dataValue){
                    if (doDebug) {
                        console.log(" ||||||||||| VALUE CHANGED !!!!".cyan,dataValue.statusCode.toString(),dataValue.value.toString());
                    }
                    result.push(dataValue);
                });
                monitoredItem.on("initialized", function () {
                    if (doDebug) {
                        console.log(" MonitoredItem initialized");
                    }
                    callback();
                });

            },
            function client_install_regular_activity(callback) {

                let counter = 0;
                intervalId = setInterval(function () {
                    if (doDebug) {

                        console.log(" Session OK ? ", the_session.isChannelValid(),
                            "session will expired in ", the_session.evaluateRemainingLifetime() / 1000, " seconds",
                            "subscription will expire in ".red, the_subscription.evaluateRemainingLifetime() / 1000, " seconds",
                            "subscription?".red, the_session.subscriptionCount);
                    }
                    if (!the_session.isChannelValid() && false) {
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
                    the_session.write([nodeToWrite], function (err, statusCode) {
                        if (err) {
                            if (doDebug) {
                                console.log("       writing Failed ".red, err.message);
                            }
                        } else {
                            if (doDebug) {
                                console.log("       writing OK counter =", counter,statusCode.toString());
                            }
                            counter += 1;
                        }
                        //xx statusCode && statusCode.length===1) ? statusCode[0].toString():"");
                    });

                }, 250);

                callback();
            },

            function wait_for_activity_to_settle(callback) {
                setTimeout(callback, 1000);
            }
        ], function (err) {
            if (doDebug){
                console.log("  --------------------------------------------------\n\n\n");
            }
            callback(err);
        });
}

function terminate_active_client(callback) {

    if (!client) {
        return callback();
    }

    async.series([
        // close session
        function client_close_session(callback) {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }

            the_session.close(function (err) {
                if (err) {
                    console.log("session closed failed ?");
                }
                callback();
            });
        },

        function client_disconnect(callback) {
            client.disconnect(function () {
                client = null;
                callback();
            });
        }

    ], callback);
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing client reconnection with crashing server", function () {

    this.timeout(100000);

    function f(func) {
        return function (callback) {
            console.log("       * " + func.name.replace(/_/g, " ").replace(/(given|when|then)/, "**$1**".green));
            return func(callback);
        };
    }

    after(function (done) {

        terminate_active_client(function () {
            crash_external_opcua_server(done);
        });
    });

    it("should reconnection and restore subscriptions when server becomes available again", function (done) {


        function given_a_running_opcua_server(callback) {

            start_external_opcua_server(function (err) {
                callback();
            });
        }

        function when_the_server_crash(callback) {
            crash_external_opcua_server(function (err) {
                callback();
            });
        }

        function when_the_server_restart(callback) {

            start_external_opcua_server(function (err) {
                callback();
            });
        }

        function given_a_active_client_with_subscription_and_monitored_items(callback) {
            start_active_client(callback);
        }

        function then_client_should_detect_failure_and_enter_reconnection_mode(callback) {

            let backoff_counter = 0;
            function backoff_detector() {
                backoff_counter +=1;
                if (backoff_counter === 2) {
                    if (doDebug) {
                        console.log("Bingo !  Client has detected disconnection and is currently trying to reconnect");
                    }
                    client.removeListener("backoff",backoff_detector);
                    callback();
                }
            }
            client.on("backoff",backoff_detector);

        }

        function then_client_should_reconnect_and_restore_subscription(callback) {

            let change_counter = 0;
            function on_value_changed(dataValue) {
                change_counter +=1;
                if (doDebug) {
                    console.log(" |||||||||||||||||||| DataValue changed again !!!",dataValue.toString());
                }
                if (change_counter === 3) {
                    monitoredItem.removeListener("value_changed",on_value_changed);
                    callback();
                }
            }
            monitoredItem.on("changed",on_value_changed);
        }

        async.series([
            f(given_a_running_opcua_server),
            f(given_a_active_client_with_subscription_and_monitored_items),
            f(when_the_server_crash),
            f(then_client_should_detect_failure_and_enter_reconnection_mode),
            f(when_the_server_restart),
            f(then_client_should_reconnect_and_restore_subscription),
        ], done);
    });
});