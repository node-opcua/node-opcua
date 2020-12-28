import "should";
import * as async from "async";
import * as chalk from "chalk";
import * as path from "path";
import * as os from "os";

import {
    OPCUAServer,
    OPCUADiscoveryServer,
    RegisterServerMethod,
    makeApplicationUrn,
    OPCUACertificateManager,
    assert
} from "node-opcua";
import { createAndStartServer, createDiscovery, createServerThatRegisterWithDiscoveryServer, f, fa } from "./_helper";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port = 1435;
const port_discovery = 1436;

export function t(test: any) {
    const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
    describe("DS6- Discovery server", function (this: any) {
        this.timeout(50000);

        let discoveryServer: OPCUADiscoveryServer;
        let discoveryServerEndpointUrl: string = `opc.tcp://localhost:${port_discovery}`;

        let server: OPCUAServer;

        async function start_discovery_server() {
            await discoveryServer.start();
            discoveryServerEndpointUrl = discoveryServer.getEndpointUrl();
            debugLog("discovery server started   : ", discoveryServerEndpointUrl);
        }

        async function stop_discovery_server() {
            await discoveryServer.shutdown();
        }

        before(async () => {
            OPCUAServer.registry.count().should.eql(0);
            discoveryServer = await createDiscovery(port_discovery);
        });

        after(async () => {
            await stop_discovery_server();
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    OPCUAServer.registry.count().should.eql(0);
                    resolve();
                }, 100);
            });
        });

        it("DS6-1 a server shall register itself to the LDS when the LDS comes online", async () => {
            let server: OPCUAServer;

            await fa("given a server that has started before the discovery server is online", async () => {
                server = await createServerThatRegisterWithDiscoveryServer(discoveryServerEndpointUrl, port, "AA");

                await server.start();
                (server.registerServerManager as any).timeout = 100;
                debugLog("discoveryServerEndpointUrl = ", discoveryServerEndpointUrl);
            });

            await fa("when the discovery server starts", async () => {
                await start_discovery_server();
            });

            await fa("then server should end up registering itself to the LDS", async () => {
                await new Promise<void>((resolve) => {
                    // waiting for server to be registered
                    debugLog("Waiting for server to be registered");
                    server.once("serverRegistered", () => {
                        debugLog("server serverRegistered");
                        resolve();
                    });
                });
            });

            let serverUnregisteredCount = 0;
            await fa("and when the server shuts down", async () => {
                // it should unregistered itself from the LDS
                server.on("serverUnregistered", function () {
                    debugLog("server serverUnregistered");
                    serverUnregisteredCount += 1;
                });

                //
                await server.shutdown();
            });
            await fa("then server must have unregistered itself from the LDS", async () => {
                serverUnregisteredCount.should.eql(1);
            });

            await stop_discovery_server();
        });

        it("DS6-2 a server shall register itself on a regular basic to the LDS", async () => {
            await fa("given a running local discovery server", async () => {
                await start_discovery_server();
            });

            let server: OPCUAServer;
            await fa("given a server that registers itself to the local discovery server", async () => {
                server = await createServerThatRegisterWithDiscoveryServer(discoveryServerEndpointUrl, port, "B");
                (server.registerServerManager as any).timeout = 100;
            });

            await fa("when the server starts", async () => {
                await server.start();
            });

            await fa("then the server registered itself to the LDS", async () => {
                await new Promise<void>((resolve) => {
                    server.once("serverRegistered", function () {
                        ("");
                        resolve();
                    });
                });

                await fa("when the server registration is renewed", async () => {
                    await new Promise<void>((resolve) => {
                        server.once("serverRegistrationRenewed", function () {
                            //xx console.log("server serverRegistrationRenewed");
                            resolve();
                        });
                    });
                });
            });

            await fa("then later, the server should renew the registration and register itself again", async () => {
                await new Promise<void>((resolve) => {
                    server.once("serverRegistrationRenewed", function () {
                        //xx console.log("server serverRegistrationRenewed");
                        resolve();
                    });
                });
            });

            let serverUnregisteredCount = 0;
            await fa("and when the server shuts down", async () => {
                // it should unregistered itself from the LDS
                server.on("serverUnregistered", function () {
                    debugLog("server serverUnregistered");
                    serverUnregisteredCount += 1;
                });

                //
                await server.shutdown();
            });
            await fa("then server must  unregister itself from the LDS", async () => {
                serverUnregisteredCount.should.eql(1);
            });

            await stop_discovery_server();
        });

        it("DS6-3 a server shall try to register itself even if discovery server is not available", function (done) {
            async.series(
                [
                    // given a server that starts before the LDS
                    f(function given_a_opcua_server_trying_to_connect_to_an_not_started_LDS(callback) {
                        server = new OPCUAServer({
                            port,
                            registerServerMethod: RegisterServerMethod.LDS,
                            discoveryServerEndpointUrl,
                            serverInfo: {
                                applicationUri: makeApplicationUrn(os.hostname(), "Node-OPCUA-Server")
                            }
                        });
                        (server.registerServerManager as any).timeout = 100;
                        // when server starts
                        // it should end up registering itself to the LDS
                        server.start(function () {
                            callback();
                        });
                    }),
                    f(function then_it_should_try_to_connect_to_LDS_and_raise_serverRegistrationPending(callback) {
                        server.once("serverRegistrationPending", function () {
                            //xx console.log("server serverRegistrationPending");
                            callback();
                        });
                    }),
                    f(function then_it_should_try_to_connect_to_LDS_and_raise_serverRegistrationPending(callback) {
                        server.once("serverRegistrationPending", function () {
                            //xx console.log("server serverRegistrationPending");
                            callback();
                        });
                    }),
                    f(function when_the_lds_is_started(callback) {
                        // when discovery server starts ....
                        start_discovery_server().then(() => {
                            callback();
                        });
                    }),
                    f(function then_server_should_finally_manage_to_connect_to_LDS_and_raise_serverRegistered_event(callback) {
                        server.once("serverRegistered", function () {
                            //xx console.log("server serverRegistered");
                            callback();
                        });
                    }),
                    f(function then_later_on_server_should_renew_registration_and_raise_serverRegistrationRenewed_event(callback) {
                        server.once("serverRegistrationRenewed", function () {
                            //xx console.log("server serverRegistrationRenewed");
                            callback();
                        });
                    }),
                    f(function then_later_on_server_should_renew_registration_and_raise_serverRegistrationRenewed_event(callback) {
                        server.once("serverRegistrationRenewed", function () {
                            //xx console.log("server serverRegistrationRenewed");
                            callback();
                        });
                    }),
                    f(function when_server_shutdown_it_should_unregister_itself_from_the_LDS(callback) {
                        // when the server shuts down
                        // it should unregistered itself from the LDS
                        server.once("serverUnregistered", function () {
                            //xx console.log("server serverUnregistered");
                        });
                        server.shutdown(function () {
                            callback();
                        });
                    }),
                    function (callback) {
                        stop_discovery_server().then(() => callback());
                    }
                ],
                done
            );
        });

        it("DS6-4 a server shall be able not to register itself to the LDS if needed to be hidden", function (done) {
            async.series(
                [
                    f(function given_a_server_hidden_from_local_discovery(callback) {
                        server = new OPCUAServer({
                            port,
                            registerServerMethod: RegisterServerMethod.HIDDEN,
                            serverInfo: {
                                applicationUri: makeApplicationUrn(os.hostname(), "Node-OPCUA-Server")
                            }
                        });
                        (server.registerServerManager as any).timeout = 100;
                        server.start(function () {
                            callback();
                        });
                    }),
                    function (callback) {
                        server.shutdown(function () {
                            callback();
                        });
                    }
                ],
                done
            );
        });

        it("DS6-5 a server (that want to register itself to the LDS) shall be able to start promptly even if the LDS is no available", function (done) {
            this.timeout(5000);
            async.series(
                [
                    function given_a_server_that_register_itself_to_local_discovery(callback) {
                        server = new OPCUAServer({
                            port,
                            registerServerMethod: RegisterServerMethod.LDS,
                            discoveryServerEndpointUrl,
                            serverInfo: {
                                applicationUri: makeApplicationUrn(os.hostname(), "Node-OPCUA-Server")
                            }
                        });
                        (server.registerServerManager as any).timeout = 100;
                        server.start(function () {
                            callback();
                        });
                    },
                    function (callback) {
                        server.shutdown(function () {
                            callback();
                        });
                    }
                ],
                done
            );
        });
    });

    describe("DS7- Discovery Server 2", function (this: any) {
        this.timeout(50000);

        it("DS7-1 server shall not struggle to start if discovery server is not available", function (done) {
            let discoveryServerEndpointUrl = `opc.tcp://localhost:${port_discovery}`;
            let server: OPCUAServer;
            async.series(
                [
                    // in this test, there is no discovery server available
                    // no discovery ...

                    function (callback) {
                        server = new OPCUAServer({
                            port,
                            registerServerMethod: RegisterServerMethod.LDS,
                            discoveryServerEndpointUrl,
                            serverInfo: {
                                applicationUri: makeApplicationUrn(os.hostname(), "Node-OPCUA-Server")
                            }
                        });

                        (server.registerServerManager as any).timeout = 100;

                        // when server starts
                        // it should end up registering itself to the LDS
                        server.once("serverRegistered", function () {
                            console.log("server serverRegistered ?! this is not what we expect !");
                        });
                        server.start(function () {
                            callback();
                        });
                    },
                    function (callback) {
                        server.shutdown(callback);
                    }
                ],
                done
            );
        });
    });
}
