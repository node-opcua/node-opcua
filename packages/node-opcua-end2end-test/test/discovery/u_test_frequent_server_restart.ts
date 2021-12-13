import "should";
import * as async from "async";
import {
    OPCUAClient,
    ClientSubscription,
    OPCUADiscoveryServer,
    RegisterServerManager,
    RegisterServerMethod,
    OPCUAServer,
    ClientMonitoredItem,
    resolveNodeId,
    AttributeIds,
    TimestampsToReturn,
    ErrorCallback,
    ApplicationType,
    ClientSession,
    OPCUACertificateManager
} from "node-opcua";

import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { createServerThatRegistersItselfToTheDiscoveryServer, f, startDiscovery } from "./_helper";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port2 = 1240;
const port1 = 1241;
const discovery_port = 1244;

export function t(test: any) {
    const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
    describe("DISCO4 - NodeRed -  testing frequent server restart within same process", function () {
        /**
         * This test simulates the way node-red will frequently start and restart
         * a opcua server and a opcua client when the user is modifying and redeploying its project
         * This test verifies that server can be restarted easily and help the nodered-iot-opcua team
         * to elaborate its module
         */

        let g_server: OPCUAServer;

        let discoveryServer: OPCUADiscoveryServer | undefined = undefined;
        let discoveryServerEndpointUrl: string;

        const startDiscoveryServer = f(function start_the_discovery_server(callback: ErrorCallback) {
            // note : only one discovery server shall be run per machine
            startDiscovery(discovery_port)
                .then((_discoveryServer: OPCUADiscoveryServer) => {
                    discoveryServer = _discoveryServer;
                    discoveryServerEndpointUrl = discoveryServer.getEndpointUrl();
                    callback();
                })
                .catch((err) => callback(err));
        });

        const stopDiscoveryServer = f(function stop_the_discovery_server(callback: ErrorCallback) {
            if (!discoveryServer) return callback();
            discoveryServer.shutdown((err?: Error) => {
                discoveryServer = undefined;
                debugLog("discovery server stopped!", err);
                callback(err);
            });
        });

        let endpointUrl = "";

        const createServer = f(function start_an_opcua_server_that_registers_to_the_lds(callback: ErrorCallback) {
            createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port1, "AZ")
                .then(async (server: OPCUAServer) => {
                    g_server = server;
                    await server.start();
                    server.endpoints.length.should.be.greaterThan(0);
                    endpointUrl = server.getEndpointUrl();
                    callback();
                })
                .catch((err) => callback(err));
        });

        const shutdownServer = f(function shutdown_the_opcua_server(callback: ErrorCallback) {
            g_server.shutdown(function () {
                if (doDebug) {
                    debugLog("Server has been shot down");
                }
                callback();
            });
        });

        interface ClientData {
            client: OPCUAClient;
            session: ClientSession;
            subscription: ClientSubscription;
            monitoredItem: ClientMonitoredItem;
        }
        const clients: ClientData[] = [];

        const connectManyClient = f(function connect_many_opcua_clients(callback: ErrorCallback) {
            let clientCount = 0;
            function addClient(callback: ErrorCallback) {
                if (doDebug) {
                    debugLog(" creating client");
                }
                const client = OPCUAClient.create({
                    requestedSessionTimeout: 10000,
                    clientName: "Client-" + clientCount
                });
                clientCount += 1;

                client.on("connection_lost", () => {
                    debugLog("connection lost", client.clientName);
                });
                client.on("connection_reestablished", () => {
                    debugLog("connection reestablished", client.clientName);
                });
                client.on("reconnection_canceled", () => {
                    debugLog("reconnection canceled ", client.clientName);
                });
                client.on("after_reconnection", () => {
                    debugLog("after_reconnection ", client.clientName);
                });
                client.connect(endpointUrl, (err?: Error) => {
                    if (err) return callback(err);
                    client.createSession(function (err, _session) {
                        if (err) return callback(err);
                        const session = _session!;

                        session.on("session_closed", () => {
                            debugLog("session closed - client", client.clientName);
                        });
                        session.on("session_restored", () => {
                            debugLog("session restored - client", client.clientName);
                        });

                        const subscription = ClientSubscription.create(session, {
                            requestedPublishingInterval: 100,
                            requestedLifetimeCount: 1000,
                            requestedMaxKeepAliveCount: 6,
                            maxNotificationsPerPublish: 100,
                            publishingEnabled: true,
                            priority: 10
                        });
                        subscription
                            .on("started", function () {
                                if (doDebug) {
                                    debugLog("subscription started for 2 seconds - subscriptionId=", subscription.subscriptionId);
                                }
                            })
                            .on("keepalive", function () {
                                debugLog("keepalive");
                            })
                            .on("terminated", function () {/** */});
                        const monitoredItem = ClientMonitoredItem.create(
                            subscription,
                            {
                                nodeId: resolveNodeId("ns=0;i=2258"),
                                attributeId: AttributeIds.Value
                            },
                            {
                                samplingInterval: 100,
                                discardOldest: true,
                                queueSize: 10
                            },
                            TimestampsToReturn.Both
                        );
                        monitoredItem.on("changed", function (dataValue) {
                            if (doDebug) {
                                debugLog(dataValue.toString());
                            }
                        });
                        clients.push({ client, session, subscription, monitoredItem });

                        callback();
                    });
                });
            }

            async.parallel([addClient, addClient, addClient, addClient, addClient, addClient], () => callback());
        });

        const shutdownClients = f(function disconnect_the_opcua_clients(callback: ErrorCallback) {
            function removeClient(callback: ErrorCallback) {
                if (!clients) { return callback();}
                const { client, session, subscription, monitoredItem } = clients.pop()!;

                subscription.terminate((err?: Error) => {
                    session.close((err?: Error) => {
                        if (err) return callback(err);
                        setImmediate(function () {
                            client.disconnect((err?: Error) => {
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

            async.parallel([removeClient, removeClient, removeClient, removeClient, removeClient, removeClient], () => {
                callback();
                debugLog("------------------------------------------ clients terminated");
            });
        });

        const wait_a_few_seconds = f(function wait_a_few_seconds(callback: ErrorCallback) {
            setTimeout(callback, 1100);
        });

        const wait_a_minute = f(function wait_a_minute(callback: ErrorCallback) {
            setTimeout(callback, 10* 1000);
        });

        before((done) => {
            startDiscoveryServer(done);
        });

        after((done) => {
            stopDiscoveryServer(done);
        });

        it("DISCO4-A - should perform start/stop cycle efficiently ", function (done) {
            async.series([createServer, wait_a_few_seconds, shutdownServer], done);
        });

        it("DISCO4-B - should perform start/stop cycle efficiently ", function (done) {
            async.series([createServer, shutdownServer], done);
        });

        it("DISCO4-C - disposing  cerficiation manager during initialization ", function (done) {
            const cm = new OPCUACertificateManager({
                // rootFolder:
            });

            async.series(
                [
                    f(function when_creating_a_opcua_certificate_manager(callback: ErrorCallback) {
                        cm.initialize((err) => {
                            done();
                        });
                        callback();
                    }),
                    f(function disposing(callback: ErrorCallback) {
                        cm.dispose();
                    })
                ],
                () => {
                    /* empty */
                }
            );
        });

        it("DISCO4-D - should cancel a client that is attempting a connection on an existing server", function (done) {
            const client = OPCUAClient.create({});
            const endpoint = discoveryServerEndpointUrl;
            async.series(
                [
                    f(function when_we_create_a_client_but_do_not_wait_for_connection(callback: ErrorCallback) {
                        client.connect(endpoint, (err) => {
                            /* nothing here */
                            // console.log("Connect err = ", err ? err.message: null);
                            done();
                        });
                        setImmediate(callback);
                    }),

                    f(function when_we_close_client_while_connection_is_in_progress(callback: ErrorCallback) {
                        client.disconnect(callback);
                    }),
                    f(function then_client_should_cancel_initial_connection(callback: ErrorCallback) {
                        wait_a_few_seconds(callback);
                    })
                ],
                () => {
                    /* nothing here => connect wil call done */
                }
            );
        });

        it("DISCO4-E - should cancel a client that cannot connect - on standard LocalDiscoveryServer", function (done) {
            const server = new OPCUAServer({
                port: port1,
                registerServerMethod: RegisterServerMethod.LDS,
                discoveryServerEndpointUrl: "opc.tcp://localhost:4840" //<< standard server
            });
            (server.registerServerManager as any).timeout = 100;
            async.series(
                [
                    f(function create_Server(callback: ErrorCallback) {
                        server.start(callback);
                    }),

                    f(function close_client_while_connect_in_progress(callback: ErrorCallback) {
                        server.shutdown(callback);
                    })
                ],
                done
            );
        });

        it("DISCO4-F - should cancel a client that cannot connect - on specific LocalDiscoveryServer", function (done) {
            let server: OPCUAServer;
            async.series(
                [
                    //Xx startDiscoveryServer,

                    function create_Server(callback: ErrorCallback) {
                        debugLog("discoveryServerEndpointUrl =", discoveryServerEndpointUrl);
                        server = new OPCUAServer({
                            port: port1,
                            registerServerMethod: RegisterServerMethod.LDS,
                            discoveryServerEndpointUrl
                        });
                        server.start(callback);
                        (server.registerServerManager as any).timeout = 100;
                    },

                    function close_client_while_connect_in_progress(callback: ErrorCallback) {
                        server.shutdown(callback);
                    }

                    //Xx stopDiscoveryServer
                ],
                done
            );
        });

        it("DISCO4-G - registration manager as a standalone object 2/2", function (done) {
            const registrationManager = new RegisterServerManager({
                discoveryServerEndpointUrl: "opc.tcp://localhost:48481", // << not existing
                server: {
                    serverCertificateManager: new OPCUACertificateManager({}),
                    certificateFile: "",
                    privateKeyFile: "",
                    capabilitiesForMDNS: [],
                    getCertificate(): Buffer {
                        return Buffer.alloc(0);
                    },
                    getDiscoveryUrls(): string[] {
                        return [];
                    },
                    serverInfo: {
                        applicationName: { text: "" },
                        applicationUri: "SomeURI",
                        productUri: null
                    },
                    serverType: ApplicationType.Server
                }
            });
            async.series(
                [
                    function (callback: ErrorCallback) {
                        registrationManager.start(function () {
                            /**/
                        });
                        callback(); // setImmediate(callback);
                    },
                    function (callback: ErrorCallback) {
                        registrationManager.stop(callback);
                    }
                ],
                done
            );
        });
        it("DISCO4-H - registration manager as a standalone object 2/2", function (done) {
            const registrationManager = new RegisterServerManager({
                discoveryServerEndpointUrl,
                server: {
                    serverCertificateManager: new OPCUACertificateManager({}),
                    certificateFile: "",
                    privateKeyFile: "",
                    capabilitiesForMDNS: [],
                    getCertificate(): Buffer {
                        return Buffer.alloc(0);
                    },
                    getDiscoveryUrls(): string[] {
                        return [];
                    },
                    serverInfo: {
                        applicationName: { text: "" },
                        applicationUri: "SomeUri",
                        productUri: null
                    },
                    serverType: ApplicationType.Server
                }
            });
            async.series(
                [
                    function (callback: ErrorCallback) {
                        registrationManager.start(function () {
                            /** */
                        });
                        callback(); // setImmediate(callback);
                    },
                    function (callback: ErrorCallback) {
                        registrationManager.stop(callback);
                    }
                ],
                done
            );
        });

        it("DISCO4-I - should perform start/stop cycle efficiently ", function (done) {
            async.series(
                [
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
                    shutdownServer
                ],
                done
            );
        });

        it("DISCO4-J - should perform start/stop cycle efficiently even with many connected clients and server close before clients", function (done) {
            async.series(
                [
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
                    wait_a_few_seconds
                ],
                done
            );
        });

        it("DISCO4-K - should perform start/stop cycle efficiently even with many connected clients and clients close before server", function (done) {
            async.series(
                [
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
                    wait_a_few_seconds
                ],
                done
            );
        });

        it("DISCO4-L - should perform start/stop long cycle efficiently even with many connected clients and clients close before server", function (done) {
            async.series(
                [
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
                    wait_a_few_seconds
                ],
                done
            );
        });

        it("DISCO4-M - NR2 should not crash when a server that failed to start is shot down", function (done) {
            let server1: OPCUAServer;
            let server2: OPCUAServer;

            async.series(
                [
                    f(function create_server_1(callback: ErrorCallback) {
                        server1 = new OPCUAServer({ port: port1 });
                        server1.start((err?: Error) => {
                            callback(err);
                        });
                    }),
                    f(function create_server_2(callback: ErrorCallback) {
                        // we start a second server on the same port !
                        // this server will fail to start
                        server2 = new OPCUAServer({ port: port1 /* yes port 1*/ });
                        server2.start((err?: Error) => {
                            if (!err) {
                                debugLog(" expecting a error here !");
                            }
                            //should.exist(err," server2 must fail to start !( but we ignore the error)");
                            callback();
                        });
                    }),
                    f(function shutdown_server_1(callback: ErrorCallback) {
                        server1.shutdown(callback);
                    }),
                    f(function shutdown_server_2(callback: ErrorCallback) {
                        server2.shutdown((err?: Error) => {
                            if (!err) {
                                debugLog("expecting a error here as well");
                            }
                            //xx should.exist(err,"we expect an error here because server2 failed to start, therefore cannot be shot down");
                            callback();
                        });
                    })
                ],
                done
            );
        });

        it("DISCO4-N - should not crash when we start two servers and stop the second server first", async () => {
            const server1 = new OPCUAServer({ port: port1 });
            await server1.start();

            const server2 = new OPCUAServer({ port: port2 });
            await server2.start();

            await server2.shutdown();
            await server1.shutdown();
        });

        it("DISCO4-O - should not crash when we start two servers and stop using the same order as we started them", async () => {
            const server1 = new OPCUAServer({ port: port1 });
            await server1.start();

            const server2 = new OPCUAServer({ port: port2 });
            await server2.start();

            await server1.shutdown();
            await server2.shutdown();
        });
    });
};
