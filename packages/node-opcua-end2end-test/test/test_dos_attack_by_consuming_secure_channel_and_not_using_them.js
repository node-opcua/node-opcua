/*
 * attempt a DoS attack on Server by consuming SecureChannels and NOT using them.
 *
 */
"use strict";

Error.stackTraceLimit = Infinity;
const path = require("path");

const sinon = require("sinon");
const should = require("should");
const async = require("async");
const defer = require("delayed");
const chalk = require("chalk");

const {
    is_valid_endpointUrl,
    MessageSecurityMode,
    SecurityPolicy,
    OPCUAServer,
    OPCUAClient,
    ClientSecureChannelLayer
} = require("node-opcua");

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const { createServerCertificateManager } = require("../test_helpers/createServerCertificateManager");


const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const fail_fast_connectionStrategy = {
    maxRetry: 0 // << NO RETRY !!
};

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Server resilience to DDOS attacks", function () {
    let server;
    let endpointUrl;
    const maxConnectionsPerEndpoint = 3;
    const maxAllowedSessionNumber = 10000; // almost no limits

    let clients = [];
    let sessions = [];
    let rejected_connections = 0;

    const port = 2001;

    this.timeout(Math.max(30000, this.timeout()));

    beforeEach(async () => {
        console.log(" server port = ", port);
        clients = [];
        sessions = [];
        rejected_connections = 0;

        const serverCertificateManager = await createServerCertificateManager(port);

        server = new OPCUAServer({
            port,
            serverCertificateManager,
            maxConnectionsPerEndpoint: maxConnectionsPerEndpoint,
            maxAllowedSessionNumber: maxAllowedSessionNumber
            //xx nodeset_filename: empty_nodeset_filename
        });

        await server.start();
        // we will connect to first server end point
        endpointUrl = server.getEndpointUrl();
        debugLog("endpointUrl", endpointUrl);
        is_valid_endpointUrl(endpointUrl).should.equal(true);
    });

    afterEach(async () => {
        await server.shutdown();
        server = null;
    });

    it("ZAA1 should be possible to create many sessions per connection", function (done) {
        const client = OPCUAClient.create({
            connectionStrategy: fail_fast_connectionStrategy
        });

        const sessions = [];

        function create_session(callback) {
            client.createSession(function (err, session) {
                if (!err) {
                    sessions.push(session);
                }
                callback(err);
            });
        }

        async.series(
            [
                function (callback) {
                    client.connect(endpointUrl, (err) => {
                        callback();
                    });
                },
                create_session,
                create_session,
                create_session,
                create_session,

                function (callback) {
                    async.eachLimit(
                        sessions,
                        1,
                        function (session, callback) {
                            session.close(callback);
                        },
                        callback
                    );
                },
                function (callback) {
                    client.disconnect(callback);
                }
            ],
            done
        );
    });

    it("ZAA2 When creating a valid/real SecureChannel, prior unused channels should be recycled.", function (done) {
        // uncomment this line to run with external server
        //xx endpointUrl = "opc.tcp://" + os.hostname() + ":26543";

        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);

        const nbExtra = 5;
        const nbConnections = server.maxConnectionsPerEndpoint + nbExtra;

        const channels = [];

        function step1_construct_many_channels(callback) {
            const tasks = [];

            for (let i = 0; i < nbConnections; i++) {
                tasks.push({ index: i, endpointUrl: endpointUrl });
            }

            function createChannel(data, _inner_callback) {
                (typeof _inner_callback === "function").should.eql(true);
                const secureChannel = new ClientSecureChannelLayer({
                    defaultSecureTokenLifetime: 5000000,
                    securityMode: MessageSecurityMode.None,
                    securityPolicy: SecurityPolicy.None,
                    serverCertificate: null,
                    connectionStrategy: {
                        maxRetry: 0
                    }
                });
                secureChannel.create(data.endpointUrl, function (err) {
                    //xx    console.log(" err ",data.index,err);
                    channels.push(secureChannel);
                    _inner_callback(err);
                });
            }

            const defer = require("delayed");
            async.eachLimit(tasks, 1, createChannel, (err, results) => {
                callback(err);
            });
        }

        const results = [];
        let nbError = 0;

        function step2_close_all_channels(callback) {
            async.eachLimit(
                channels,
                1,
                function (channel, callback) {
                    channel.close(function (err) {
                        if (err) {
                            nbError++;
                        }
                        callback && callback();
                        callback = null;
                    });
                },
                callback
            );
        }

        function step3_verification(callback) {
            nbError.should.eql(nbExtra);
            callback();
        }

        async.series([step1_construct_many_channels, step2_close_all_channels, step3_verification], done);
    });

    let counter = 1;

    function createClientAndSession(data, _inner_callback) {
        const client = OPCUAClient.create({
            connectionStrategy: fail_fast_connectionStrategy
        });

        client.name = "client" + counter;
        counter += 1;

        client.connectionStrategy.maxRetry.should.eql(fail_fast_connectionStrategy.maxRetry);

        client.on("start_reconnection", (err) => {
            if (doDebug) {
                debugLog(chalk.bgWhite.yellow("start_reconnection"), data.index);
            }
            throw Error("Expecting automatic reconnection to be disabled");
        });
        client.on("backoff", (number, delay) => {
            if (doDebug) {
                debugLog(chalk.bgWhite.yellow("backoff"), number, delay);
            }
            throw Error("Expecting automatic reconnection to be disabled");
        });

        clients.push(client);

        async.series(
            [
                function (callback) {
                    setTimeout(callback, 10);
                },

                function (callback) {
                    if (doDebug) {
                        debugLog(chalk.bgWhite.yellow("about to start client"), client.name);
                    }
                    client.connect(endpointUrl, function (err) {
                        if (!err) {
                            if (doDebug) {
                                debugLog(chalk.bgWhite.yellow("client"), client.name, " connected");
                            }
                            client._secureChannel.connectionStrategy.maxRetry.should.eql(fail_fast_connectionStrategy.maxRetry);

                            client.createSession(function (err, session) {
                                if (!err) {
                                    sessions.push(session);
                                }
                                callback();
                            });
                        } else {
                            if (doDebug) {
                                debugLog("client ", client.name, " connection  has been rejected");
                            }
                            rejected_connections++;
                            // ignore err here
                            callback();
                        }
                    });
                }
            ],
            _inner_callback
        );
    }

    it("ZAA3 server should reject connections if all secure channels are used", function (done) {
        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);
        rejected_connections.should.eql(0);
        clients.length.should.eql(0);
        sessions.length.should.eql(0);
        const nbExtra = 5;
        const nbConnections = server.maxConnectionsPerEndpoint + nbExtra;

        function step1_construct_many_channels_with_session(callback) {
            const tasks = [];

            for (let i = 0; i < nbConnections; i++) {
                tasks.push({ index: i, endpointUrl: endpointUrl });
            }

            const defer = require("delayed");
            async.eachLimit(tasks, 1, defer.deferred(createClientAndSession), (err, results) => {
                callback(err);
            });
        }

        let nbError = 0;

        function step2_close_all_sessions(callback) {
            async.eachLimit(
                sessions,
                2,
                function (session, callback) {
                    // some channel have been forcibly closed by the server, closing them will cause server to generate an error
                    session.close(function (err) {
                        if (err) {
                            nbError++;
                        }
                        callback();
                    });
                },
                callback
            );
        }

        function step2_close_all_clients(callback) {
            async.eachLimit(
                clients,
                1,
                function (client, callback) {
                    // some channel have been forcibly closed by the server, closing them will cause server to generate an error
                    client.disconnect(function (err) {
                        if (err) {
                            nbError++;
                        }
                        callback();
                    });
                },
                callback
            );
        }

        function step3_verification(callback) {
            try {
                nbError.should.eql(0, "");

                rejected_connections.should.eql(5);
                sessions.length.should.eql(server.maxConnectionsPerEndpoint);
            } catch (err) {
                return callback(err);
            }
            callback();
        }

        async.series(
            [step1_construct_many_channels_with_session, step2_close_all_sessions, step2_close_all_clients, step3_verification],
            done
        );
    });

    it("ZAA4 Server shall not keep channel that have been disconnected abruptly", function (done) {
        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);
        rejected_connections.should.eql(0);
        clients.length.should.eql(0);
        sessions.length.should.eql(0);

        const nbExtra = 5;
        const nbConnections = server.maxConnectionsPerEndpoint + nbExtra;

        function step1_construct_many_channels_with_session_and_abruptly_terminate_them(callback) {
            debugLog("step1_construct_many_channels_with_session_and_abruptly_terminate_them");

            const tasks = [];

            for (let i = 0; i < nbConnections; i++) {
                tasks.push({ index: i, endpointUrl: endpointUrl });
            }
            async.eachLimit(tasks, 1, defer.deferred(createClientAndSession), (err, results) => {
                debugLog("step1_construct_many_channels_with_session_and_abruptly_terminate_them => done");
                callback(err);
            });
        }

        function step2_abruptly_disconnect_existing_channel_from_client_side(callback) {
            debugLog("step2_abruptly_disconnect_existing_channel_from_client_side");

            function terminate_client_abruptly(client, inner_callback) {
                debugLog("terminate abruptly ", client.name);
                if (client._secureChannel) {
                    const socket = client._secureChannel._transport._socket;
                    socket.end();
                    socket.destroy();
                    socket.emit("error", new Error("Terminate"));
                }
                inner_callback();
            }

            async.eachLimit(clients, 1, terminate_client_abruptly, (err, results) => {
                debugLog("step2_abruptly_disconnect_existing_channel_from_client_side => done");
                callback(err);
            });
        }

        async.series(
            [
                step1_construct_many_channels_with_session_and_abruptly_terminate_them,
                step2_abruptly_disconnect_existing_channel_from_client_side,
                function (callback) {
                    rejected_connections.should.eql(5);
                    callback();
                },
                step1_construct_many_channels_with_session_and_abruptly_terminate_them,
                function (callback) {
                    rejected_connections.should.eql(10);
                    callback();
                },
                function cleanup(callback) {
                    async.eachLimit(
                        clients,
                        1,
                        function (client, inner_done) {
                            client.disconnect(inner_done);
                        },
                        callback
                    );
                }
            ],
            done
        );
    });

    it("ZAA5 Server shall not keep channel that have been disconnected abruptly - version 2", function (done) {
        const serverEndpoint = server.endpoints[0];

        const spyCloseChannel = new sinon.spy();
        const spyNewChannel = new sinon.spy();

        serverEndpoint.on("closeChannel", spyCloseChannel);
        serverEndpoint.on("newChannel", spyNewChannel);

        let counter = 0;

        function create_crashing_client(callback) {
            counter++;
            console.log(" ------------------------------------------------------------ > create_a_faulty_client");
            const spawn = require("child_process").spawn;
            const server_script = path.join(__dirname, "../test_helpers/crashing_client");
            const options = {};
            const server_exec = spawn("node", [server_script, port], options);

            server_exec.on("close", function (code) {
                console.log("terminated with ", code);
                callback();
            });
            server_exec.stdout.on("data", function (data) {
                data = data.toString();
                data.split("\n").forEach(function (data) {
                    process.stdout.write("stdout:               " + chalk.yellow(data) + "\n");
                });
            });
        }

        server.maxConnectionsPerEndpoint.should.eql(maxConnectionsPerEndpoint);
        clients.length.should.eql(0);
        sessions.length.should.eql(0);

        function step1_launch_crashing_client(callback) {
            create_crashing_client(callback);
        }

        function verify_server_channel_count(callback) {
            setTimeout(function () {
                // verify that there are no channel opened on the server.
                console.log(" currentChannelCount = ", serverEndpoint.currentChannelCount);
                serverEndpoint.currentChannelCount.should.eql(0);

                spyNewChannel.callCount.should.eql(counter, "expecting spyNewChannel to have been called");
                spyCloseChannel.callCount.should.eql(counter, "expecting spyCloseChannel to have been called");
                callback();
            }, 250);
        }

        async.series(
            [
                verify_server_channel_count,
                step1_launch_crashing_client,
                verify_server_channel_count,
                step1_launch_crashing_client,
                verify_server_channel_count,
                step1_launch_crashing_client,
                verify_server_channel_count,
                step1_launch_crashing_client,
                verify_server_channel_count
            ],
            done
        );
    });
});
