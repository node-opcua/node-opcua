/* eslint-disable max-statements */
"use strict";
const should = require("should");
const async = require("async");
const fs = require("fs");
const {
    DataType,
    MessageSecurityMode,
    SecurityPolicy,
    ClientSubscription,
    AttributeIds,
    OPCUAClient,
    StatusCodes,
    ClientMonitoredItem,
    Variant
} = require("node-opcua");
const chalk = require("chalk");

const { readCertificate } = require("node-opcua-crypto");

const { make_debugLog, checkDebugFlag, make_errorLog} = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const errorLog = make_errorLog("TEST")
const doDebug = checkDebugFlag("TEST");

const port = 2014;

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");

const fail_fast_connectivity_strategy = {
    maxRetry: 1,
    initialDelay: 10,
    maxDelay: 20,
    randomisationFactor: 0
};
const robust_connectivity_strategy = {
    maxRetry: 100,
    initialDelay: 10,
    maxDelay: 200,
    randomisationFactor: 0
};
const custom_connectivity_strategy = {
    maxRetry: 100,
    initialDelay: 80,
    maxDelay: 100,
    randomisationFactor: 0
};

const infinite_connectivity_strategy = {
    maxRetry: 1000000,
    initialDelay: 10,
    maxDelay: 200,
    randomisationFactor: 0
};

const f = require("../../test_helpers/display_function_name").f.bind(null, doDebug);

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("KJH1 testing basic Client-Server communication", function () {
    let server, client, temperatureVariableId, endpointUrl;

    this.timeout(Math.max(20000, this.timeout()));

    before(function (done) {
        server = build_server_with_temperature_device({ port }, function (err) {
            endpointUrl = server.getEndpointUrl();
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function (done) {
        // use fail fast connectionStrategy
        const options = {
            connectionStrategy: fail_fast_connectivity_strategy,
            endpointMustExist: false
        };
        client = OPCUAClient.create(options);
        client.on("connection_reestablished", function () {
            debugLog(chalk.bgWhite.black(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
        });
        client.on("backoff", function (number, delay) {
            debugLog(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
        });
        client.on("start_reconnection", function () {
            debugLog(chalk.bgWhite.black(" !!!!!!!!!!!!!!!!!!!!!!!!  Starting Reconnection !!!!!!!!!!!!!!!!!!!"));
        });
        done();
    });

    afterEach(function (done) {
        client.disconnect(function (err) {
            client = null;
            done(err);
        });
    });

    after(function (done) {
        should.not.exist(client, "client still running");
        server.shutdown(function (err) {
            done(err);
        });
    });

    it("TR01 - a client should connect to a server and disconnect ", function (done) {
        server.currentChannelCount.should.equal(0);

        client.protocolVersion = 0;

        async.series(
            [
                function (callback) {
                    client.connect(endpointUrl, callback);
                },
                function (callback) {
                    server.currentChannelCount.should.equal(1);
                    client.disconnect(callback);
                }
            ],
            function (err) {
                setImmediate(() => {
                    server.currentChannelCount.should.equal(0);
                    done(err);
                });
            }
        );
    });

    it("TR02 - a server should not accept a connection when the protocol version is incompatible", function (done) {
        client.protocolVersion = 0xdeadbeef; // set a invalid protocol version
        server.currentChannelCount.should.equal(0);

        async.series(
            [
                function (callback) {
                    debugLog(" connect");

                    client.connect(endpointUrl, function (err) {
                        debugLog(chalk.yellow.bold(" Error ="), err);

                        callback(err ? null : new Error("Expecting an error here"));
                    });
                }
            ],
            function (err) {
                if (err) {
                    return done(err);
                }
                setTimeout(()=>{
                    server.currentChannelCount.should.equal(0);
                    done(err);    
                }, 10);
            }
        );
    });

    it("TR03 - a client shall be able to create a session with a anonymous token", function (done) {
        server.currentChannelCount.should.equal(0);

        let g_session;
        async.series(
            [
                function (callback) {
                    debugLog(" connect");
                    client.connect(endpointUrl, function (err) {
                        debugLog(chalk.yellow.bold(" Error ="), err);
                        callback(err);
                    });
                },
                function (callback) {
                    debugLog(" createSession");
                    client.createSession(function (err, session) {
                        g_session = session;
                        debugLog(chalk.yellow.bold(" Error ="), err);
                        callback(err);
                    });
                },
                function (callback) {
                    debugLog("closing session");
                    g_session.close(callback);
                },
                function (callback) {
                    debugLog("Disconnecting client");
                    client.disconnect(callback);
                },
                function (callback) {
                    // relax a little bit so that server can complete pending operations
                    setImmediate(callback);
                },
                function (callback) {
                    // relax a little bit so that server can complete pending operations
                    setImmediate(callback);
                }
            ],
            function (err) {
                debugLog("finally");
                server.currentChannelCount.should.equal(0);
                debugLog(" error : ", err);
                done();
            }
        );
    });

    it("TR04 - a client shall be able to reconnect if the first connection has failed", function (done) {
        server.currentChannelCount.should.equal(0);

        client.protocolVersion = 0;

        const unused_port = 8909;
        const bad_endpointUrl = "opc.tcp://" + "localhost" + ":" + unused_port;

        async.series(
            [
                function (callback) {
                    client.connect(bad_endpointUrl, function (err) {
                        err.message.should.match(/connect ECONNREFUSED/);
                        callback();
                    });
                },
                function (callback) {
                    client.connect(endpointUrl, function (err) {
                        //xx assert(!err);
                        callback(err);
                    });
                },
                function (callback) {
                    client.disconnect(callback);
                }
            ],
            done
        );
    });

    it("TR05 - a client shall be able to connect & disconnect many times", function (done) {
        server.currentChannelCount.should.equal(0);

        function relax_for_a_little_while(callback) {
            setTimeout(callback, 20);
        }

        async.series(
            [
                function (callback) {
                    client.connect(endpointUrl, callback);
                },
                function (callback) {
                    server.currentChannelCount.should.equal(1);
                    callback();
                },
                function (callback) {
                    client.disconnect(callback);
                },
                relax_for_a_little_while,
                function (callback) {
                    server.currentChannelCount.should.equal(0);
                    callback();
                },

                function (callback) {
                    client.connect(endpointUrl, callback);
                },
                function (callback) {
                    server.currentChannelCount.should.equal(1);
                    callback();
                },
                function (callback) {
                    client.disconnect(callback);
                },
                relax_for_a_little_while,
                function (callback) {
                    server.currentChannelCount.should.equal(0);
                    callback();
                },

                function (callback) {
                    client.connect(endpointUrl, callback);
                },
                function (callback) {
                    server.currentChannelCount.should.equal(1);
                    callback();
                },
                function (callback) {
                    client.disconnect(callback);
                },
                relax_for_a_little_while,
                function (callback) {
                    server.currentChannelCount.should.equal(0);
                    callback();
                }
            ],
            done
        );
    });

    it("TR06 - a client shall raise an error when trying to create a session on an invalid endpoint", function (done) {
        // this is explained here : see OPCUA Part 4 Version 1.02 $5.4.1 page 12:
        //   A  Client  shall verify the  HostName  specified in the  Server Certificate  is the same as the  HostName
        //   contained in the  endpointUrl  provided in the  EndpointDescription. If there is a difference  then  the
        //   Client  shall report the difference and may close the  SecureChannel.
        async.series(
            [
                function (callback) {
                    client.endpointMustExist = true;
                    client.connect(endpointUrl + "/someCrap", callback);
                },

                function (callback) {
                    client.createSession(function (err, session) {
                        should.not.exist(session);
                        should.exist(err);
                        callback(err ? null : new Error("Expecting a failure"));
                    });
                },

                function (callback) {
                    client.disconnect(callback);
                }
            ],
            done
        );
    });
    it("TR07 - calling connect on the client twice shall return a error the second time", function (done) {
        server.currentChannelCount.should.equal(0);

        client.protocolVersion = 0;

        async.series(
            [
                function (callback) {
                    client.connect(endpointUrl, callback);
                },
                function (callback) {
                    client.connect(endpointUrl, function (err) {
                        err.should.be.instanceOf(Error);

                        callback();
                    });
                },
                function (callback) {
                    client.disconnect(callback);
                }
            ],
            done
        );
    });
});

describe("KJH2 testing ability for client to reconnect when server close connection", function () {
    this.timeout(Math.max(60000, this.timeout()));

    let server = null;
    let endpointUrl = null;
    let temperatureVariableId = null;

    let counterNode = null;
    let timerId;
    // -----------------------------------------------------------------------------------------------------------------
    // Common Steps
    // -----------------------------------------------------------------------------------------------------------------

    function trustClientCertificateOnServer(client, server, callback) {
        if (!server) {
            return callback();
        }
        const clientCertificateFilename = client.certificateFile;
        fs.existsSync(clientCertificateFilename).should.eql(true, " certificate must exist");
        const certificate = readCertificate(clientCertificateFilename);
        server.serverCertificateManager.trustCertificate(certificate, callback);
    }

    function start_demo_server(done) {
        server = build_server_with_temperature_device({ port }, function (err) {
            if (err) {
                debugLog(err.message);
            }
            endpointUrl = server.getEndpointUrl();
            temperatureVariableId = server.temperatureVariableId;

            const namespace = server.engine.addressSpace.getOwnNamespace();

            if (!err) {
                let c = 0;

                counterNode = namespace.addVariable({
                    browseName: "Counter",
                    organizedBy: server.engine.addressSpace.rootFolder.objects,
                    dataType: "UInt32",
                    value: new Variant({ dataType: DataType.UInt32, value: c })
                });
                timerId = setInterval(function () {
                    c = c + 1;
                    counterNode.setValueFromSource(new Variant({ dataType: "UInt32", value: c }), StatusCodes.Good);
                }, 100);
            }
            done(err);
        });
    }

    function shutdown_server(done) {
        should(server).not.eql(null, "server not started ?");
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
        server.shutdown(function (err) {
            server = null;
            done(err);
        });
    }

    function suspend_demo_server(callback) {
        server.suspendEndPoints(callback);
    }

    function resume_demo_server(callback) {
        server.resumeEndPoints(callback);
    }

    function restart_server(done) {
        should(server).eql(null, "server already started ?");
        start_demo_server(done);
    }

    function verify_that_server_has_no_active_channel(callback) {
        server.currentChannelCount.should.equal(0);
        callback();
    }

    function wait_for(duration, done) {
        setTimeout(function () {
            done();
        }, duration);
    }

    function wait_a_little_while(done) {
        wait_for(800, done);
    }

    let client = null;
    let client_has_received_close_event;
    let client_has_received_start_reconnection_event;
    let client_has_received_connection_reestablished_event = 0;
    let client_has_received_connection_lost_event = 0;

    let backoff_counter = 0;
    let requestedSessionTimeout = 30000;

    beforeEach(function () {
        requestedSessionTimeout = 30000;
    });
    afterEach(function (done) {
        should.not.exist(client, "client must have been disposed");
        done();
    });

    function create_client_and_create_a_connection_to_server(_options, connectionStrategy, done) {
        done.should.be.instanceOf(Function);

        should.not.exist(client, "expecting no client");

        should.not.exist(client, "Already have a client ");

        client = OPCUAClient.create({
            securityMode: _options.securityMode || MessageSecurityMode.None,
            securityPolicy: _options.securityPolicy || SecurityPolicy.None,
            keepSessionAlive: true,
            // requestedSessionTimeout: _options.requestedSessionTimeout || requestedSessionTimeout,
            connectionStrategy: connectionStrategy,
            requestedSessionTimeout: 120 * 60 * 1000 // 2 hours
        });

        client.on("keepalive", function () {
            debugLog("keep alive");
        });
        client_has_received_close_event = 0;
        client_has_received_start_reconnection_event = 0;
        client_has_received_connection_reestablished_event = 0;
        client_has_received_connection_lost_event = 0;

        client.on("close", function (err) {
            if (err) {
                //xx console.log("err=", err.message);
            }
            client_has_received_close_event += 1;
        });

        client.on("start_reconnection", function () {
            client_has_received_start_reconnection_event += 1;
            debugLog(chalk.whiteBright(" !!!!!!!!!!!!!!!!!!!!!!!!  Starting Reconnection !!!!!!!!!!!!!!!!!!!"));
            debugLog("starting reconnection");
        });
        client.on("backoff", function (number, delay) {
            debugLog(chalk.bgWhite.yellow("backoff  attempt #"), number, " retrying in ", delay / 1000.0, " seconds");
            backoff_counter += 1;
        });
        client.on("connection_reestablished", function () {
            client_has_received_connection_reestablished_event += 1;
            debugLog(chalk.whiteBright(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
        });
        client.on("connection_lost", function () {
            client_has_received_connection_lost_event += 1;
            debugLog(chalk.whiteBright(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION LOST !!!!!!!!!!!!!!!!!!!"));
        });

        trustClientCertificateOnServer(client, server, function () {
            client.connect(endpointUrl, function (err) {
                if (!_options.doNotWaitForConnection) {
                    done(err);
                }
            });
            if (_options.doNotWaitForConnection) {
                done();
            }
        });
    }

    function disconnect_client(done) {
        client.disconnect(done);
        client = null;
    }
    function disconnect_client_while_reconnecting(done) {
        client.disconnect(done);
    }

    function reset_backoff_counter(done) {
        backoff_counter = 0;
        done();
    }

    function assert_NO_backoff_event_since_last_reset(done) {
        backoff_counter.should.eql(0);
        done();
    }

    function assert_has_received_some_backoff_event_since_last_reset(done) {
        backoff_counter.should.be.greaterThan(0);
        done();
    }

    function verify_that_client_fails_to_connect(connectivity_strategy, done) {
        create_client_and_create_a_connection_to_server({}, connectivity_strategy, function (err) {
            disconnect_client(function () {
                done(err ? null : new Error("Expecting an error here"));
            });
        });
    }

    function verify_that_client_has_received_a_single_start_reconnection_event(done) {
        try {
            client_has_received_start_reconnection_event.should.eql(
                1,
                "expecting 'start_reconnection' event to be emitted only once"
            );
        } catch (err) {
            done(err);
        }
        done();
    }

    function verify_that_client_has_received_a_single_close_event(done) {
        try {
            client_has_received_close_event.should.eql(1, "expecting close event to be emitted only once");
        } catch (err) {
            done(err);
        }
        done();
    }

    function verify_that_client_is_connected(done) {
        // to do : do something useful here
        done();
    }

    function verify_that_client_is_trying_to_connect(done) {
        // wait a little bit and check that client has started the reconnection process
        setTimeout(function () {
            try {
                client.isReconnecting.should.eql(true, "verify_that_client_is_trying_to_reconnect");
            } catch (err) {
                done(err);
            }
            done();
        }, 1000);
    }

    function verify_that_client_is_trying_to_reconnect(done) {
        client_has_received_connection_lost_event.should.be.above(0);
        verify_that_client_is_trying_to_connect(done);
    }

    function verify_that_client_is_NOT_trying_to_reconnect(done) {
        if (!client) {
            return done();
        }
        setImmediate(function () {
            try {
                client.isReconnecting.should.eql(false, "verify_that_client_is_NOT_trying_to_reconnect");
            } catch (err) {
                return done(err);
            }
            done();
        });
    }

    function wait_for_reconnection_to_be_completed(done) {
        client.once("after_reconnection", function () {
            done();
        });
    }

    function verify_that_client_has_NOT_received_a_close_event(done) {
        try {
            client_has_received_close_event.should.eql(0, "expecting close event NOT to be emitted");
        } catch (err) {
            done(err);
        }
        done();
    }

    it("TR10 - should be possible to reconnect client after the server closed the connection", function (done) {
        // steps:
        //  -     Given a running demo server
        //  - and Given a client that has been configured  with a fail fast reconnection strategy
        //  - and Given that the client is  connected to the server
        //
        //  -     When the server shuts down
        //  - and When the reconnection time has been exhausted.
        //
        //  -     Then I should verify that client has received a "close" notification, only once
        //
        //  -     Given that the server has been restarted
        //  -     When  we reuse the same client to reconnect to server
        // -      Then I should verify that client can connect successfully
        // cleanup:
        //   - disconnect client
        //   - disconnect server
        //---------------------------------------------------------------

        function reuse_same_client_to_reconnect_to_server(done) {
            client.connect(endpointUrl, done);
        }

        async.series(
            [
                f(start_demo_server),
                // use fail fast connectionStrategy
                f(create_client_and_create_a_connection_to_server.bind(null, {}, fail_fast_connectivity_strategy)),
                f(shutdown_server),
                //f(wait_a_little_while),
                f(verify_that_client_is_trying_to_reconnect),
                f(disconnect_client_while_reconnecting),
                f(wait_a_little_while),
                f(verify_that_client_has_received_a_single_close_event),
                f(restart_server),
                f(reuse_same_client_to_reconnect_to_server),
                f(verify_that_client_is_connected),
                f(disconnect_client),
                f(verify_that_server_has_no_active_channel),
                f(shutdown_server)
            ],
            function (err) {
                done(err);
            }
        );
    });

    it("TR11 - a client should be able to reconnect automatically to the server when the server restarts after a server failure", function (done) {
        // steps:
        //  -     Given a running demo server
        //  - and Given a client that has been configured  with a robust reconnection strategy
        //  - and Given that the client is  connected to the server
        //
        //  -     When the server shuts down
        //  - and When the server restarts after a little while
        //
        //  -     Then I should verify that client has *NOT* received a "close" notification
        //  -     and that the client can still communicate with server
        //
        // cleanup:
        //   - disconnect client
        //   - disconnect server

        async.series(
            [
                f(start_demo_server),
                // use robust  connectionStrategy
                f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy)),
                f(shutdown_server),
                f(wait_a_little_while),
                f(verify_that_client_is_trying_to_reconnect),
                f(wait_a_little_while),
                f(verify_that_client_has_NOT_received_a_close_event),
                f(verify_that_client_is_trying_to_reconnect),
                f(verify_that_client_has_received_a_single_start_reconnection_event),
                f(restart_server),
                f(wait_a_little_while),
                f(wait_a_little_while),
                f(verify_that_client_is_connected),
                f(verify_that_client_is_NOT_trying_to_reconnect),
                f(verify_that_client_has_received_a_single_start_reconnection_event),
                f(disconnect_client),
                f(verify_that_server_has_no_active_channel),
                f(shutdown_server)
            ],
            function (err) {
                done(err);
            }
        );
    });

    it("TR12 - a client should be able to reconnect automatically to the server when the server restarts after a server failure", function (done) {
        async.series(
            [
                f(start_demo_server),
                // use robust  connectionStrategy
                f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy)),

                f(shutdown_server),
                f(wait_a_little_while),
                f(verify_that_client_is_trying_to_reconnect),
                f(wait_a_little_while),
                f(verify_that_client_has_NOT_received_a_close_event),
                f(verify_that_client_is_trying_to_reconnect),
                f(verify_that_client_has_received_a_single_start_reconnection_event),
                f(restart_server),
                f(wait_a_little_while),
                f(wait_a_little_while),
                f(verify_that_client_is_connected),
                f(verify_that_client_is_NOT_trying_to_reconnect),
                f(verify_that_client_has_received_a_single_start_reconnection_event),

                // reset client reconnection event counter
                function (callback) {
                    client_has_received_start_reconnection_event = 0;
                    callback();
                },

                // Shutdown the server again
                f(shutdown_server),
                f(wait_a_little_while),
                f(verify_that_client_is_trying_to_reconnect),
                f(wait_a_little_while),
                f(verify_that_client_has_NOT_received_a_close_event),
                f(verify_that_client_is_trying_to_reconnect),
                f(verify_that_client_has_received_a_single_start_reconnection_event),
                f(restart_server),
                f(wait_a_little_while),
                f(wait_a_little_while),
                f(verify_that_client_is_connected),
                f(verify_that_client_is_NOT_trying_to_reconnect),
                f(verify_that_client_has_received_a_single_start_reconnection_event),

                f(disconnect_client),
                f(verify_that_server_has_no_active_channel),
                f(shutdown_server)
            ],
            function (err) {
                done(err);
            }
        );
    });

    it("TR13 - it should be possible to disconnect a client which is in the middle a reconnection sequence", function (done) {
        async.series(
            [
                f(start_demo_server),
                // use robust connectionStrategy
                f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy)),
                f(shutdown_server),
                f(wait_a_little_while),
                f(verify_that_client_is_trying_to_reconnect),
                f(wait_a_little_while),
                f(disconnect_client),
                f(wait_a_little_while),
                f(verify_that_client_is_NOT_trying_to_reconnect),
                f(wait_a_little_while),
                f(verify_that_client_is_NOT_trying_to_reconnect)
            ],
            function (err) {
                done(err);
            }
        );
    });

    it("TR14 - it should be possible to disconnect a client which is attempting to establish it's first connection to a unavailable server", function (done) {
        async.series(
            [
                function (callback) {
                    endpointUrl = "opc.tcp://localhost:11111"; // uri of an unavailable opcua server
                    callback();
                },
                // use robust connectionStrategy
                f(
                    create_client_and_create_a_connection_to_server.bind(
                        null,
                        { doNotWaitForConnection: true },
                        robust_connectivity_strategy
                    )
                ),
                f(wait_a_little_while),
                f(verify_that_client_is_trying_to_connect),
                f(wait_a_little_while),
                f(disconnect_client),
                f(wait_a_little_while),
                f(verify_that_client_is_NOT_trying_to_reconnect),
                f(wait_a_little_while),
                f(verify_that_client_is_NOT_trying_to_reconnect)
            ],
            function (err) {
                done(err);
            }
        );
    });

    let the_session = null;

    function client_create_and_activate_session(callback) {
        client.createSession(function (err, session) {
            if (!err) {
                the_session = session;
                ///xx console.log("session timeout = ",the_session.timeout," ms");
            }
            callback(err);
        });
    }

    let subscription = null;

    function create_subscription(callback) {
        subscription = ClientSubscription.create(the_session, {
            requestedPublishingInterval: 250,
            requestedLifetimeCount: 12000,
            requestedMaxKeepAliveCount: 4 * 60 * 2, // 4 x 250 ms * 60* 2 = 2 min
            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            priority: 6
        });
        subscription.once("started", function () {
            callback();
        });
    }

    function terminate_subscription(callback) {
        //xx console.log(" subscription.publish_engine.subscriptionCount", subscription.publish_engine.subscriptionCount);
        subscription.on("terminated", function () {
            //xx console.log(" subscription.publish_engine.subscriptionCount", subscription.publish_engine.subscriptionCount);
        });
        subscription.terminate(callback);
    }

    let values_to_check = [];

    let monitoredItem = null;

    function monitor_monotonous_counter(callback) {
        if (monitoredItem) {
            errorLog(" warning = already monitoring");
            monitoredItem.removeAllListeners();
            monitoredItem = null;
            // return callback(new Error("Already monitoring"));
        }

        monitoredItem = ClientMonitoredItem.create(
            subscription,
            {
                // nodeId: makeNodeId(VariableIds.Server_ServerStatus_CurrentTime),
                nodeId: counterNode.nodeId,
                attributeId: AttributeIds.Value
            },
            {
                samplingInterval: 0, // 0 : event base => whenever value changes
                discardOldest: true,
                queueSize: 1000
            }
        );

        monitoredItem.once("initialized", function () {
            //xx console.log("monitoredItem.monitoringParameters.samplingInterval",monitoredItem.monitoringParameters.samplingInterval);//);
            callback();
        });

        monitoredItem.on("changed", function (dataValue) {
            if (doDebug) {
                debugLog(" client ", " received value change ", dataValue.value.toString());
            }
            values_to_check.push(dataValue.value.value);
        });
    }

    function wait_until_next_notification(done) {
        monitoredItem.once("changed", function (dataValue) {
            setTimeout(done, 1);
        });
    }

    let previous_value_count = 0;

    afterEach(function () {
        if (monitoredItem) {
            monitoredItem.removeAllListeners();
            monitoredItem = null;
        }
    });

    function reset_continuous(callback) {
        //xx console.log(" resetting value to check");
        values_to_check = [];
        previous_value_count = 0;
        callback();
    }

    function ensure_continuous(callback) {
        // ensure we have more value than previous call
        wait_until_next_notification(function () {
            // ensure that series is continuous
            if (doDebug) {
                console.log(values_to_check.join(" "));
            }

            // let check that new values have been received
            // when the following test fails, this probably means that the publish mechanism is not working as expected
            values_to_check.length.should.be.greaterThan(
                previous_value_count + 1,
                " expecting that new values have been received since last check : values_to_check = " +
                    values_to_check +
                    " != " +
                    (previous_value_count + 1)
            );

            if (values_to_check.length > 0) {
                const lastValue = values_to_check[values_to_check.length - 1];
                const expectedLastValue = values_to_check[0] + values_to_check.length - 1;
                if (lastValue > expectedLastValue) {
                    console.log(" Warning ", values_to_check.join(" "));
                }
                // lastValue.should.be.belowOrEqual(expectedLastValue);
            }
            previous_value_count = values_to_check.length;
            callback();
        });
    }

    function break_connection(socketError, callback) {
        const clientSocket = client._secureChannel._transport._socket;
        clientSocket.end();
        clientSocket.destroy();
        clientSocket.emit("error", new Error(socketError));

        /*
         server.endpoints.forEach(function(endpoint){
             endpoint.killClientSockets(function() {
             });
         });
          */

        setImmediate(callback);
    }

    function simulate_connection_break(breakage_duration, socketError, callback) {
        debugLog("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! Breaking connection for ", breakage_duration, " ms");

        async.series(
            [
                suspend_demo_server,

                break_connection.bind(null, socketError),

                wait_for.bind(null, breakage_duration),

                resume_demo_server
            ],
            callback
        );
    }

    function get_server_side_subscription() {
        const channels = server.endpoints[0]._channels;
        debugLog("channels keys = ", Object.keys(channels).join(" "));

        //xxx var channelKey = Object.keys(channels)[0];
        //xx var channel = channels[channelKey];
        //xx assert(Object.keys(server.engine._sessions).length === 1);

        const sessionKey = Object.keys(server.engine._sessions)[0];
        const session = server.engine._sessions[sessionKey];

        const subscriptionKeys = Object.keys(session.publishEngine._subscriptions);
        subscriptionKeys.length.should.eql(1);
        return session.publishEngine._subscriptions[subscriptionKeys[0]];
    }

    // let make sure it will timeout almost immediately
    function accelerate_subscription_timeout(subscription, callback) {
        debugLog(
            "accelerate_subscription_timeout",
            subscription.id,
            " =>  _life_time_counter = ",
            subscription._life_time_counter,
            subscription.lifeTimeCount
        );
        subscription._life_time_counter = subscription.lifeTimeCount - 1;

        subscription.once("terminated", function () {
            setImmediate(callback);
        });
    }

    function wait_until_server_subscription_has_timed_out(callback) {
        const server_subscription = get_server_side_subscription();
        // let's cheat a little bit => we don't really want to wait until subscriptions times out
        accelerate_subscription_timeout(server_subscription, callback);
    }

    function simulate_very_long_connection_break_until_subscription_times_out(socketError, callback) {
        async.series(
            [
                f(suspend_demo_server),

                f(break_connection.bind(null, socketError)),

                f(wait_until_server_subscription_has_timed_out),

                f(wait_for.bind(null, 40 * 100)),

                f(resume_demo_server)
            ],
            callback
        );
        // in this case, the server drops all Subscriptions due to max lifetime count exhausted.
    }

    it("TR15 - verify that server can suspend socket connection - useful for testing purposes", function (done) {
        async.series(
            [
                f(start_demo_server),
                f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy)),
                f(disconnect_client),

                f(suspend_demo_server),

                // verify that client cannot connect anymore
                f(verify_that_client_fails_to_connect.bind(null, fail_fast_connectivity_strategy)),

                f(resume_demo_server),

                // verify that client can connect again
                f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy)),
                f(disconnect_client),

                f(shutdown_server)
            ],
            function (err) {
                done(err);
            }
        );
    });

    it("TR16 - a client with some active monitoring items should be able to seamlessly reconnect after a connection break - and retrieve missed notification without lost ( Republish)", function (done) {
        async.series(
            [
                f(start_demo_server),
                f(reset_continuous),
                // use robust connectionStrategy
                f(create_client_and_create_a_connection_to_server.bind(null, {}, custom_connectivity_strategy)),
                f(client_create_and_activate_session),
                f(create_subscription),
                f(monitor_monotonous_counter),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_until_next_notification),
                f(ensure_continuous),

                // now drop connection  for 1.5 seconds
                f(simulate_connection_break.bind(null, 5000, "ECONNRESET")),
                // make sure that we have received all notifications
                // (thanks to republish )

                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_until_next_notification),
                f(wait_until_next_notification),
                f(ensure_continuous),

                f(terminate_subscription),
                f(disconnect_client),
                f(shutdown_server)
            ],
            function (err) {
                done(err);
            }
        );
    });

    it("TR17 - a client with some active monitoring items should be able to seamlessly reconnect after a very long connection break exceeding subscription lifetime", function (done) {
        // a client with some active monitoring items should be able to seamlessly reconnect
        // after a very long connection break exceeding subscription lifetime.
        // In this case, the subscription on the server side has been deleted, therefore the client shall
        // recreate the subscription and resubscribe to the monitored items

        async.series(
            [
                f(start_demo_server),
                f(reset_continuous),
                // use robust connectionStrategy
                f(create_client_and_create_a_connection_to_server.bind(null, {}, custom_connectivity_strategy)),
                f(client_create_and_activate_session),
                f(create_subscription),
                f(monitor_monotonous_counter),

                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),

                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),

                // now drop connection  for a long time, so that server
                // has to delete all pending subscriptions....
                f(simulate_very_long_connection_break_until_subscription_times_out.bind(null, "ECONNRESET")),

                f(reset_continuous),
                f(wait_a_little_while),
                f(wait_a_little_while),
                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),

                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),

                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),

                f(terminate_subscription),

                f(disconnect_client),
                f(shutdown_server)
            ],
            function (err) {
                done(err);
            }
        );
    });

    xit("TR18 - a client with some active monitored items should be able to reconnect seamlessly after a very long connection break exceeding session life time", function (done) {
        // to do
        async.series([], done);
    });

    it("TR19 -  disconnecting during connect", function (done) {
        // Given a client that has a infinite connection retry strategy,
        //   And that client#connect is call to connect to an non-existent server.
        //
        //  When client#disconnect is called
        //
        //  Then the client should complete the client#connect async call with and err;
        //   And the client should stop the automatic reconnection strategy (backoff)
        // to do

        // Given a client that has a infinite connection retry strategy,
        //   And that client#connect is call to connect to an non-existent server.
        //
        let client = null;
        let client_has_received_close_event = 0;
        let client_has_received_connected_event = 0;
        let client_has_received_start_reconnection_event;

        const options = { connectionStrategy: infinite_connectivity_strategy };
        client = OPCUAClient.create(options);

        client.on("close", function (err) {
            if (err) {
                console.log("err=", err.message);
            }
            client_has_received_close_event += 1;
        });
        client.on("connected", () => {
            client_has_received_connected_event += 1;
        });

        client.on("start_reconnection", function () {
            client_has_received_start_reconnection_event += 1;
        });

        let backoff_event_counter = 0;
        client.on("backoff", function () {
            backoff_event_counter += 1;
        });

        endpointUrl = "opc.tcp://somewhere-far-away.in.an.other.__galaxy__.com:4242";

        // let's call connect.
        // because the endpointUrl doesn't exist,  and the the infinite_connectivity_strategy
        // the client with indefinitely try to connect, causing the callback function
        // passed to the client#connect method not to be called.
        let connect_done = false;
        let connect_err = null;
        client.connect(endpointUrl, function (err) {
            connect_err = err;
            //xx console.log("client.connect(err) err = ",err);
            connect_done = true;
        });

        let count_ref = 0;

        async.series(
            [
                // Wait until backoff is raised several times
                function (callback) {
                    client.once("backoff", function (/*number,delay*/) {
                        callback();
                    });
                },
                function (callback) {
                    client.once("backoff", function (/*number,delay*/) {
                        callback();
                    });
                },
                function (callback) {
                    client.once("backoff", function (/*number,delay*/) {
                        callback();
                    });
                },
                function (callback) {
                    backoff_event_counter.should.be.greaterThan(2);
                    // client should be still trying to connect
                    connect_done.should.eql(false);

                    //  When client#disconnect is called
                    client_has_received_close_event.should.eql(0);

                    client.disconnect((err) => {
                        client_has_received_close_event.should.eql(client_has_received_connected_event);
                        client_has_received_connected_event.should.eql(0);

                        // connect callback should have been called...
                        connect_done.should.eql(true);

                        callback(err);
                        count_ref = backoff_event_counter;
                    });
                },
                f(wait_a_little_while),
                function (callback) {
                    client_has_received_close_event.should.eql(0);
                    // backoff must be terminated now
                    count_ref.should.eql(backoff_event_counter);
                    callback(null);
                }
            ],
            done
        );
    });

    it("TR20 -  disconnecting during reconnect", function (done) {
        // Given a client that has a infinite connection retry strategy,
        //   And the client has a lived connection with a server
        //   And that the connection has dropped ( backoff strategy taking place)
        //
        //  When client#disconnect is called
        //
        //   Then the client should stop the  automatic reconnection strategy (backoff)

        //xx  ccc client_has_received_close_event

        async.series(
            [
                f(start_demo_server),

                f(create_client_and_create_a_connection_to_server.bind(null, {}, infinite_connectivity_strategy)),
                f(wait_a_little_while),
                f(shutdown_server),
                f(reset_backoff_counter),
                f(wait_for.bind(null, 2000)),
                f(verify_that_client_is_trying_to_reconnect),
                f(verify_that_client_has_NOT_received_a_close_event),
                f(verify_that_client_has_received_a_single_start_reconnection_event),
                f(assert_has_received_some_backoff_event_since_last_reset),

                f(wait_for.bind(null, 2000)),
                f(disconnect_client),

                f(reset_backoff_counter),
                f(wait_for.bind(null, 5000)),

                f(assert_NO_backoff_event_since_last_reset),
                f(verify_that_client_is_NOT_trying_to_reconnect)
            ],
            done
        );
    });

    it("TR21 -  a client should notify that the reconnection attempt is taking place with an event", function (done) {
        // Given a client and a server with an established connection
        // When the connection link dropped
        // Then the client shall raise an event to indicate that the reconnection process is now taking place.
        async.series(
            [
                f(start_demo_server),

                f(create_client_and_create_a_connection_to_server.bind(null, {}, infinite_connectivity_strategy)),
                f(wait_a_little_while),
                f(shutdown_server),
                f(wait_a_little_while),
                f(verify_that_client_has_received_a_single_start_reconnection_event),

                f(reset_backoff_counter),
                f(wait_for.bind(null, 2000)),
                f(assert_has_received_some_backoff_event_since_last_reset),

                f(reset_backoff_counter),
                f(wait_for.bind(null, 2000)),
                f(assert_has_received_some_backoff_event_since_last_reset),

                f(disconnect_client)
            ],
            done
        );
    });

    function test_1(options, done) {
        async.series(
            [
                f(start_demo_server),
                f(reset_continuous),
                // use robust connectionStrategy
                f(create_client_and_create_a_connection_to_server.bind(null, options, custom_connectivity_strategy)),
                f(client_create_and_activate_session),
                f(create_subscription),
                f(monitor_monotonous_counter),
                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_a_little_while),

                // now drop connection  for 1.5 seconds
                f(simulate_connection_break.bind(null, 5000, "EPIPE")),
                // make sure that we have received all notifications
                // (thanks to republish )

                f(wait_a_little_while),
                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_a_little_while),
                f(wait_until_next_notification),
                f(ensure_continuous),

                f(terminate_subscription),

                f(disconnect_client),
                f(shutdown_server)
            ],
            function (err) {
                done(err);
            }
        );
    }

    it("TR22 -  a client with active monitoring should be able to reconnect after a EPIPE connection break cause local socket end has been shut down - no security ", function (done) {
        test_1({ securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.Node }, done);
    });
    it("TR23 -  a client with active monitoring should be able to reconnect after a EPIPE connection break cause local socket end has been shut down - with secure channel (#390)", function (done) {
        test_1(
            {
                securityMode: MessageSecurityMode.SignAndEncrypt,
                securityPolicy: SecurityPolicy.Basic256Sha256
            },
            done
        );
    });

    it("TR24 -  a client with active monitored item should be able to reconnect and transfer subscriptions when session timeout", function (done) {
        const requestedSessionTimeout = 5000;

        async.series(
            [
                f(start_demo_server),
                f(reset_continuous),
                // use robust connectionStrategy
                f(
                    create_client_and_create_a_connection_to_server.bind(
                        null,
                        {
                            requestedSessionTimeout: requestedSessionTimeout
                        },
                        custom_connectivity_strategy
                    )
                ),
                f(client_create_and_activate_session),
                f(create_subscription),
                f(monitor_monotonous_counter),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_until_next_notification),
                f(ensure_continuous),

                // now drop connection  for 1.5 times requestedSessionTimeout seconds
                f(simulate_connection_break.bind(null, 1.5 * requestedSessionTimeout, "EPIPE")),
                // make sure that we have received all notifications
                // (thanks to republish )

                f(wait_until_next_notification),
                f(ensure_continuous),
                f(wait_until_next_notification),
                f(ensure_continuous),

                f(terminate_subscription),

                f(disconnect_client),
                f(shutdown_server)
            ],
            function (err) {
                if (!err && server) {
                    server.engine.currentSessionCount.should.eql(0);
                }
                done(err);
            }
        );
    });

    it("TR25 - a connected client shall be able to detect when a server has shut down and shall reconnect when server restarts", function (done) {
        async.series(
            [
                f(start_demo_server),
                f(reset_continuous),
                f(create_client_and_create_a_connection_to_server.bind(null, {}, robust_connectivity_strategy)),
                f(wait_for.bind(null, 2000)),
                f(shutdown_server),
                f(verify_that_client_is_trying_to_reconnect),
                f(start_demo_server),
                f(wait_for_reconnection_to_be_completed),
                f(wait_a_little_while),
                f(disconnect_client),
                f(shutdown_server)
            ],
            done
        );
    });
});
