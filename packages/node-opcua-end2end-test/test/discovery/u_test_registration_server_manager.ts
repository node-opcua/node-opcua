import "should";
import * as async from "async";
import * as os from "os";

import { OPCUAServer, OPCUADiscoveryServer, RegisterServerMethod, makeApplicationUrn } from "node-opcua";
import { createDiscovery, createServerThatRegistersItselfToTheDiscoveryServer, f, fa, pause } from "./_helper";
import { make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");

const port = 1435;
const port_discovery = 1436;

export function t() {
    const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
    describe("DS6- Discovery server", function (this: any) {
        this.timeout(50000);

        let discoveryServerEndpointUrl: string = `opc.tcp://localhost:${port_discovery}`;

        let discoveryServer: OPCUADiscoveryServer | undefined;

        async function start_discovery_server() {
            if (discoveryServer !== undefined) {
                throw new Error("discoveryServer already started");
            }
            discoveryServer = await createDiscovery(port_discovery);
            debugLog("starting discoveryServer");
            await discoveryServer.start();
            debugLog("discoveryServer started");
            discoveryServerEndpointUrl = discoveryServer.getEndpointUrl();
            debugLog("discovery server started   : ", discoveryServerEndpointUrl);
        }

        async function stop_discovery_server() {
            if (discoveryServer) {
                debugLog("stopping discoveryServer");
                await discoveryServer.shutdown();
                debugLog("discoveryServer stopped");
                discoveryServer = undefined;
            }
        }

        before(async () => {
            OPCUAServer.registry.count().should.eql(0);
        });

        after(async () => {
            await stop_discovery_server();
            await pause(100);
            OPCUAServer.registry.count().should.eql(0);
        });

        it("DS6-1 a server shall register itself to the LDS when the LDS comes online", async () => {
            let server: OPCUAServer;

            await fa("given a server that has started before the discovery server is online", async () => {
                server = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port, "AA");

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
                server.on("serverUnregistered", () => {
                    debugLog("server serverUnregistered");
                    serverUnregisteredCount += 1;
                });

                //
                await server.shutdown();
            });
            await fa("then server must have unregistered itself from the LDS", async () => {
                serverUnregisteredCount.should.eql(1);
            });

            await fa("stopping discovery server", stop_discovery_server);
        });

        it("DS6-2 a server shall register itself on a regular basic to the LDS", async () => {
            await fa("given a running local discovery server", async () => {
                await start_discovery_server();
            });

            let server: OPCUAServer;
            await fa("given a server that registers itself to the local discovery server", async () => {
                server = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port, "B");
                (server.registerServerManager as any).timeout = 100;
            });

            await fa("when the server starts", async () => {
                await server.start();
            });

            await fa("then the server registered itself to the LDS", async () => {
                await new Promise<void>((resolve) => {
                    server.once("serverRegistered", () => {
                        debugLog("");
                        resolve();
                    });
                });

                await fa("when the server registration is renewed", async () => {
                    await new Promise<void>((resolve) => {
                        server.once("serverRegistrationRenewed", () => {
                            // xx debugLog("server serverRegistrationRenewed");
                            resolve();
                        });
                    });
                });
            });

            await fa("then later, the server should renew the registration and register itself again", async () => {
                await new Promise<void>((resolve) => {
                    server.once("serverRegistrationRenewed", () => {
                        //xx debugLog("server serverRegistrationRenewed");
                        resolve();
                    });
                });
            });

            let serverUnregisteredCount = 0;
            await fa("and when the server shuts down", async () => {
                // it should unregistered itself from the LDS
                server.on("serverUnregistered", () => {
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
            let server: OPCUAServer;

            async.series(
                [
                    // given a server that starts before the LDS
                    f(function given_a_opcua_server_trying_to_connect_to_an_not_started_LDS(callback) {
                        server = new OPCUAServer({
                            port,
                            registerServerMethod: RegisterServerMethod.LDS,
                            discoveryServerEndpointUrl,
                            serverInfo: {
                                applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-Server")
                            }
                        });
                        (server.registerServerManager as any).timeout = 100;
                        // when server starts
                        // it should end up registering itself to the LDS
                        server.start(() => {
                            callback();
                        });
                    }),
                    f(function then_it_should_try_to_connect_to_LDS_and_raise_serverRegistrationPending(callback) {
                        server.once("serverRegistrationPending", () => {
                            //xx debugLog("server serverRegistrationPending");
                            callback();
                        });
                    }),
                    f(function then_it_should_try_to_connect_to_LDS_and_raise_serverRegistrationPending(callback) {
                        server.once("serverRegistrationPending", () => {
                            //xx debugLog("server serverRegistrationPending");
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
                        server.once("serverRegistered", () => {
                            //xx debugLog("server serverRegistered");
                            callback();
                        });
                    }),
                    f(function then_later_on_server_should_renew_registration_and_raise_serverRegistrationRenewed_event(callback) {
                        server.once("serverRegistrationRenewed", () => {
                            //xx debugLog("server serverRegistrationRenewed");
                            callback();
                        });
                    }),
                    f(function then_later_on_server_should_renew_registration_and_raise_serverRegistrationRenewed_event(callback) {
                        server.once("serverRegistrationRenewed", () => {
                            //xx debugLog("server serverRegistrationRenewed");
                            callback();
                        });
                    }),
                    f(function when_server_shutdown_it_should_unregister_itself_from_the_LDS(callback) {
                        // when the server shuts down
                        // it should unregistered itself from the LDS
                        server.once("serverUnregistered", () => {
                            //xx debugLog("server serverUnregistered");
                        });
                        server.shutdown(() => {
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
            let server: OPCUAServer;
            async.series(
                [
                    f(function given_a_server_hidden_from_local_discovery(callback) {
                        server = new OPCUAServer({
                            port,
                            registerServerMethod: RegisterServerMethod.HIDDEN,
                            serverInfo: {
                                applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-Server")
                            }
                        });
                        (server.registerServerManager as any).timeout = 100;
                        server.start(() => {
                            callback();
                        });
                    }),
                    (callback) => {
                        server.shutdown(() => {
                            callback();
                        });
                    }
                ],
                done
            );
        });

        it("DS6-5 a server (that want to register itself to the LDS) shall be able to start promptly even if the LDS is no available", function (done) {
            let server: OPCUAServer;

            async.series(
                [
                    function given_a_server_that_registers_itself_to_local_discovery(callback) {
                        server = new OPCUAServer({
                            port,
                            registerServerMethod: RegisterServerMethod.LDS,

                            discoveryServerEndpointUrl
                        });
                        (server.registerServerManager as any).timeout = 100;
                        server.start(() => {
                            // at this stage the server is initiating a connection to the LDS....
                            callback();
                        });
                    },
                    function the_server_shall_shutdown(callback) {
                        server.shutdown(() => {
                            setTimeout(callback, 1000);
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
            const discoveryServerEndpointUrl = `opc.tcp://localhost:${port_discovery}`;
            let server: OPCUAServer;
            async.series(
                [
                    // in this test, there is no discovery server available
                    // no discovery ...

                    (callback) => {
                        server = new OPCUAServer({
                            port,
                            registerServerMethod: RegisterServerMethod.LDS,

                            discoveryServerEndpointUrl,
                            serverInfo: {
                                applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-Server")
                            }
                        });

                        (server.registerServerManager as any).timeout = 100;

                        // when server starts
                        // it should end up registering itself to the LDS
                        server.once("serverRegistered", () => {
                            debugLog("server serverRegistered ?! this is not what we expect !");
                        });
                        server.start(() => {
                            callback();
                        });
                    },
                    (callback) => {
                        server.shutdown(callback);
                    }
                ],
                done
            );
        });
    });
}
