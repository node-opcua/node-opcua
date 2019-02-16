"use strict";
/* global require, process, __filename, it, before, beforeEach, after, afterEach */
const should = require("should");
const async = require("async");
const _ = require("underscore");
const os = require("os");
const opcua = require("node-opcua");
const RegisterServerManager = require("node-opcua-server").RegisterServerManager;

const debugLog = require("node-opcua-debug").make_debugLog(__filename);
const doDebug = require("node-opcua-debug").checkDebugFlag(__filename);

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("NodeRed -  testing frequent server restart within same process", function () {
    /**
     * This test simulates the way node-red will frequently start and restart
     * a opcua server and a opcua client when the user is modifying and redeploying its project
     * This test verifies that server can be restarted easily and help the nodered-iot-opcua team
     * to elaborate its module
     */

    let g_server = null;


    const discoveryServerPort = 1240;
    const serverPort = 1050;

    let discoveryServer;
    let discoveryServerEndpointUrl;

    function startDiscoveryServer(callback) {
        // note : only one discovery server shall be run per machine
        discoveryServer = new opcua.OPCUADiscoveryServer({port: discoveryServerPort});
        discoveryServerEndpointUrl = discoveryServer._get_endpoints()[0].endpointUrl;
        discoveryServer.start(function (err) {
            debugLog(" Discovery server listening on ", discoveryServerEndpointUrl);
            callback(err);
        });
    }

    function stopDiscoveryServer(callback) {
        if (!discoveryServer) return callback();
        discoveryServer.shutdown(function (err) {
            debugLog("discovery server stopped!", err);
            callback(err);
        });
    }

    let endpointUrl = "";

    function createServer(callback) {

        const server = new opcua.OPCUAServer({
            port: serverPort,
            registerServerMethod: opcua.RegisterServerMethod.LDS,
            discoveryServerEndpointUrl: discoveryServerEndpointUrl
        });
        // start server with many node
        server.on("serverRegistrationPending", function () {
            debugLog("serverRegistrationPending");
        });
        server.on("serverRegistrationRenewed", function () {
            debugLog("serverRegistrationRenewed");
        });
        server.on("serverRegistered", function () {
            debugLog("serverRegistered");
        });
        server.on("serverUnregistered", function () {
            debugLog("serverUnregistered");
        });
        server.on("serverUnregistered", function () {
            debugLog("serverUnregistered");
        });

        server.start(function (err) {
            if (err) {
                return callback(err);
            }
            g_server = server;

            server.endpoints.length.should.be.greaterThan(0);
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

            if (doDebug) {
                debugLog("Server started");
            }
            callback(err);
        });

    }

    function shutdownServer(callback) {
        g_server.shutdown(function () {
            g_server = null;
            if (doDebug) {
                debugLog("Server has been shot down");
            }
            callback();
        });
    }

    let clients = [];

    function connectManyClient(callback) {


        function addClient(callback) {
            if (doDebug) {
                debugLog(" creating client");
            }
            let client = opcua.OPCUAClient.create();
            client.connect(endpointUrl, function (err) {
                if (err) return callback(err);
                client.createSession(function (err, session) {
                    if (err) return callback(err);
                    client.session = session;
                    clients.push(client);

                    client.subscription = opcua.ClientSubscription.create(session, {
                        requestedPublishingInterval: 1000,
                        requestedLifetimeCount: 100,
                        requestedMaxKeepAliveCount: 20,
                        maxNotificationsPerPublish: 100,
                        publishingEnabled: true,
                        priority: 10
                    });
                    client.subscription.on("started", function () {
                        if (doDebug) {
                            debugLog("subscription started for 2 seconds - subscriptionId=", client.subscription.subscriptionId);
                        }
                    }).on("keepalive", function () {
                        debugLog("keepalive");
                    }).on("terminated", function () {
                    });

                    client.monitoredItem = opcua.ClientMonitoredItem.create(client.subscription,{
                            nodeId: opcua.resolveNodeId("ns=0;i=2258"),
                            attributeId: opcua.AttributeIds.Value
                        },
                        {
                            samplingInterval: 100,
                            discardOldest: true,
                            queueSize: 10
                        },
                        opcua.TimestampsToReturn.Both
                    );
                    client.monitoredItem.on("changed", function (dataValue) {
                        if (doDebug) {
                            debugLog(dataValue.toString());
                        }
                    });

                    callback(null);
                });
            });
        }

        async.parallel([
            addClient,
            addClient,
            addClient,
            addClient,
            addClient,
            addClient
        ], callback);
    }

    function shutdownClients(callback) {
        function removeClient(callback) {
            const client = clients.pop();

            client.subscription.terminate(function (err) {

                client.session.close(function (err) {
                    if (err) return callback(err);
                    setImmediate(function () {
                        client.disconnect(function (err) {
                            if (err) return callback(err);

                            if (doDebug) {
                                debugLog("Client terminated");
                            }
                            callback();
                        });
                    });
                });
            });
        }

        async.parallel([
            removeClient,
            removeClient,
            removeClient,
            removeClient,
            removeClient,
            removeClient
        ], callback);

    }

    function wait_a_few_seconds(callback) {
        setTimeout(callback, 2000);
    }

    function wait_a_minute(callback) {
        setTimeout(callback, 6000);
    }

    before(function (done) {
        startDiscoveryServer(done);
    });

    after(function (done) {
        stopDiscoveryServer(done);
    });

    it("T0a- should perform start/stop cycle efficiently ", function (done) {

        async.series([

            createServer,
            wait_a_few_seconds,
            shutdownServer,
        ], done);
    });

    it("T0b- should perform start/stop cycle efficiently ", function (done) {

        async.series([
            createServer,
            shutdownServer,
        ], done);
    });

    it("T0c- should cancel a client that is attempting a connection on an existing server", function (done) {

        let client = opcua.OPCUAClient.create();
        const endpoint = discoveryServerEndpointUrl;
        async.series([
            function create_client_do_not_wait(callback) {
                client.connect(endpoint, function () {
                });
                setImmediate(callback);
            },

            function close_client_while_connect_in_progress(callback) {
                client.disconnect(callback);
            },
            wait_a_few_seconds
        ], done);
    });

    xit("T0d- should cancel a client that cannot connect - on standard LocalDiscoveryServer", function (done) {

        let server = new opcua.OPCUAServer({
            port: serverPort,
            registerServerMethod: opcua.RegisterServerMethod.LDS,
            discoveryServerEndpointUrl: "opc.tcp://localhost:4840", //<< standard server
        });
        server.registerServerManager.timeout = 100;
        async.series([
            function create_Server(callback) {
                server.start(callback);
            },

            function close_client_while_connect_in_progress(callback) {
                server.shutdown(callback);
            }
        ], done);
    });

    it("T0f- should cancel a client that cannot connect - on specific LocalDiscoveryServer", function (done) {


        let server;
        async.series([
            //Xx startDiscoveryServer,

            function create_Server(callback) {

                debugLog("discoveryServerEndpointUrl =", discoveryServerEndpointUrl);
                server = new opcua.OPCUAServer({
                    port: serverPort,
                    registerServerMethod: opcua.RegisterServerMethod.LDS,
                    discoveryServerEndpointUrl: discoveryServerEndpointUrl
                });
                server.start(callback);
                server.registerServerManager.timeout = 100;
            },

            function close_client_while_connect_in_progress(callback) {
                server.shutdown(callback);
            },

            //Xx stopDiscoveryServer
        ], done);
    });

    it("T0g- registration manager as a standalone object", function (done) {

        const registrationManager = new RegisterServerManager(
            {
                timeout: 1000,
                discoveryServerEndpointUrl: "opc.tcp://localhost:48481", //<< not existing
                server: {
                    certificateFile: "",
                    serverType: "Server",
                }
            }
        );
        async.series([
            function (callback) {
                registrationManager.start(function () {
                });
                callback();// setImmediate(callback);
            },
            function (callback) {
                registrationManager.stop(callback);
            }
        ], done);
    });
    it("T0h- registration manager as a standalone object", function (done) {

        const registrationManager = new RegisterServerManager(
            {
                timeout: 1000,
                discoveryServerEndpointUrl: discoveryServerEndpointUrl,
                server: {
                    certificateFile: "",
                    serverType: "Server",
                }
            }
        );
        async.series([
            function (callback) {
                registrationManager.start(function () {
                });
                callback();// setImmediate(callback);
            },
            function (callback) {
                registrationManager.stop(callback);
            }
        ], done);
    });


    it("T1- should perform start/stop cycle efficiently ", function (done) {

        async.series([

            createServer,
            wait_a_few_seconds,
            shutdownServer,

            createServer,
            wait_a_few_seconds,
            shutdownServer,

            createServer,
            wait_a_few_seconds,
            shutdownServer,

            createServer,
            wait_a_few_seconds,
            shutdownServer,

            createServer,
            wait_a_few_seconds,
            shutdownServer,
        ], done);
    });


    it("T2- should perform start/stop cycle efficiently even with many connected clients and server close before clients", function (done) {

        async.series([

            createServer,

            connectManyClient,
            wait_a_few_seconds,
            wait_a_few_seconds,

            shutdownServer,

            createServer,
            wait_a_few_seconds,

            shutdownServer,

            createServer,
            wait_a_few_seconds,

            shutdownServer,

            createServer,
            wait_a_few_seconds,

            shutdownServer,

            createServer,
            wait_a_few_seconds,

            shutdownServer,

            shutdownClients,
            wait_a_few_seconds,
        ], done);
    });

    it("T3- should perform start/stop cycle efficiently even with many connected clients and clients close before server", function (done) {

        async.series([

            createServer,

            connectManyClient,
            wait_a_few_seconds,

            shutdownServer,

            createServer,
            wait_a_few_seconds,
            shutdownServer,

            createServer,
            wait_a_few_seconds,

            shutdownClients,
            wait_a_few_seconds,

            shutdownServer,
            wait_a_few_seconds,

        ], done);
    });

    it("T4- should perform start/stop long cycle efficiently even with many connected clients and clients close before server", function (done) {

        async.series([

            createServer,
            wait_a_few_seconds,

            connectManyClient,
            wait_a_few_seconds,
            wait_a_few_seconds,

            shutdownServer,
            wait_a_minute,

            createServer,
            wait_a_minute,

            shutdownClients,
            wait_a_few_seconds,

            shutdownServer,
            wait_a_few_seconds,

        ], done);
    });

    it("T5- NR2 should not crash when a server that failed to start is shot down", function (done) {

        let server1, server2;

        async.series([

            function create_server_1(callback) {
                server1 = new opcua.OPCUAServer({port: 2222});
                server1.start(function (err) {
                    callback(err);
                });
            },
            function create_server_2(callback) {
                // we start a second server on the same port !
                // this server will fail to start
                server2 = new opcua.OPCUAServer({port: 2222});
                server2.start(function (err) {
                    if (!err) {
                        debugLog(" expecting a error here !");
                    }
                    //should.exist(err," server2 must fail to start !( but we ignore the error)");
                    callback();
                });
            },
            function shutdown_server_1(callback) {
                server1.shutdown(callback);
            },
            function shutdown_server_2(callback) {
                server2.shutdown(function (err) {
                    if (!err) {
                        debugLog("expecting a error here as well");
                    }
                    //xx should.exist(err,"we expect an error here because server2 failed to start, therefore cannot be shot down");
                    callback();
                });
            }
        ], done);
    });

    it("T6- should not crash when we start two servers and stop the second server first", function (done) {

        let server1, server2;

        async.series([

            function create_server_1(callback) {
                server1 = new opcua.OPCUAServer({port: 2004});
                server1.start(callback);
            },
            function create_server_2(callback) {
                server2 = new opcua.OPCUAServer({port: 2018});
                server2.start(callback);
            },
            function shutdown_server_2(callback) {
                server2.shutdown(callback);
            },
            function shutdown_server_1(callback) {
                server1.shutdown(callback);
            }
        ], done);
    });

    it("T7- should not crash when we start two servers and stop at the same order as we started", function (done) {

        let server1, server2;

        async.series([

            function create_server_1(callback) {
                server1 = new opcua.OPCUAServer({port: 2014});
                server1.start(callback);
            },
            function create_server_2(callback) {
                server2 = new opcua.OPCUAServer({port: 2016});
                server2.start(callback);
            },
            function shutdown_server_1(callback) {
                server1.shutdown(callback);
            },
            function shutdown_server_2(callback) {
                server2.shutdown(callback);
            }
        ], done);
    });
});

