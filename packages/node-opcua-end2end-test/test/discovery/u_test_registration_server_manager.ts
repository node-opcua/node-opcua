import os from "os";
import "should";
import { make_debugLog } from "node-opcua-debug";
import { OPCUAServer, OPCUADiscoveryServer, RegisterServerMethod, makeApplicationUrn } from "node-opcua";

import {
    createDiscovery, 
    createServerThatRegistersItselfToTheDiscoveryServer,
     f, 
     fa, 
     pause, 
     stepLog } from "./helpers/_helper";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { TestHarness } from "./helpers/harness";
const debugLog = make_debugLog("TEST");

const port = 1435;

// a non-existing discovery server
const port_discovery = 1436;

export function t(test: TestHarness) {
    describe("DISCO7 - Discovery server", function (this: any) {
        this.timeout(Math.max(50000, this.timeout()));

        let discoveryServerEndpointUrl = `opc.tcp://localhost:${port_discovery}`;

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

        it("DISCO7-A -  a server shall register itself to the LDS when the LDS comes online", async () => {
            let server: OPCUAServer;

            await fa("given a server that has started before the discovery server is online", async () => {
                server = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port, "FF");

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
                        debugLog("on serverRegistered event received:  server has registered itself to the LDS");
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
                await server.shutdown();
                debugLog("server has shut down");
            });
            await fa("then server must have unregistered itself from the LDS", async () => {
                serverUnregisteredCount.should.eql(1);
            });

            await fa("stopping discovery server", stop_discovery_server);
        });

        it("DISCO7-B a server shall register itself on a regular basic to the LDS", async () => {
            await fa("given a running local discovery server", async () => {
                await start_discovery_server();
            });

            let server: OPCUAServer;
            await fa("given a server that registers itself to the local discovery server", async () => {
                server = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port, "GG");
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


        it("DISCO7-C a server shall try to register itself even if discovery server is not available", async () => {

            // #region given a opcua server trying to connect to an not started LDS
            stepLog("given a opcua server trying to connect to an not started LDS");
            const server = new OPCUAServer({
                port,
                registerServerMethod: RegisterServerMethod.LDS,
                discoveryServerEndpointUrl,
                serverInfo: {
                    applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-Server")
                }
            });

            (server.registerServerManager as any).timeout = 100;
            // when server starts
            stepLog("when server starts");
            await server.start();

            // #endregion


            // #region then it should try to connect to LDS and raise serverRegistrationPending
            stepLog("then it should try to connect to LDS and raise serverRegistrationPending");
            await new Promise<void>((resolve) => {
                server.once("serverRegistrationPending", () => {
                    //xx debugLog("server serverRegistrationPending");
                    resolve();
                });
            });
            // #endregion

            // #region then it should try to connect to LDS and raise serverRegistrationPending
            stepLog("then it should try to connect to LDS and raise serverRegistrationPending");
            await new Promise<void>((resolve) => {
                server.once("serverRegistrationPending", () => {
                    //xx debugLog("server serverRegistrationPending");
                    resolve();
                });
            });
            // #endregion

            // #region when the LDS starts
            stepLog("when the LDS starts");
            await start_discovery_server();
            stepLog("discovery server started");
            // #endregion

            // #region then server should finally manage to connect to LDS and raise a serverRegistered event
            stepLog("then server should finally manage to connect to LDS and raise a serverRegistered event");
            await new Promise<void>((resolve) => {
                server.once("serverRegistered", () => {
                    //xx debugLog("server serverRegistered");
                    resolve();
                });
            });
            stepLog("server has registered itself to the LDS");
            // #endregion

            // #region then later on server should renew registration and raise serverRegistrationRenewed event
            stepLog("then later on server should renew registration and raise serverRegistrationRenewed event");
            await new Promise<void>((resolve) => {
                server.once("serverRegistrationRenewed", () => {
                    //xx debugLog("server serverRegistrationRenewed");
                    resolve();
                });
            });
            stepLog("server has renewed its registration");
            // #endregion

            // #region then later on server should renew registration and raise_ serverRegistrationRenewed_ event
            stepLog("then later on server should renew registration and raise serverRegistrationRenewed event");
            await new Promise<void>((resolve) => {
                server.once("serverRegistrationRenewed", () => {
                    //xx debugLog("server serverRegistrationRenewed");
                    resolve();
                });
            });
            stepLog("server has renewed its registration");
            // #endregion



            // #region when the server shuts down it should unregistered itself from the LDS
            stepLog("when the server shuts down it should unregistered itself from the LDS");
            const promiseReceiveUnRegisted = new Promise<void>((resolve) =>
                server.once("serverUnregistered", () => resolve())
            );

            await server.shutdown();
            stepLog("server has shut down");
            // 
            await promiseReceiveUnRegisted;
            stepLog("the server has   unregister itself from the LDS !");
            // #endregion

            await stop_discovery_server();

        });

        it("DISCO7-D a server shall be able not to register itself to the LDS if needed to be hidden", async () => {

            // #region given a server hidden from the local discovery
            const server = new OPCUAServer({
                port,
                registerServerMethod: RegisterServerMethod.HIDDEN,
                serverInfo: {
                    applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-Server")
                }
            });
            (server.registerServerManager as any).timeout = 100;
            await server.start();
            // #endregion


            await server.shutdown();
        });

        it("DISCO7-E a server (that want to register itself to the LDS) shall be able to start promptly even if the LDS is no available", async () => {
            // given_a_server_that_registers_itself_to_local_discovery(callback) {
            const server = new OPCUAServer({
                port,
                registerServerMethod: RegisterServerMethod.LDS,

                discoveryServerEndpointUrl
            });
            (server.registerServerManager as any).timeout = 100;
            await server.start();


            // when server s
            //  the_server_shall_shutdown(callback) {
            await server.shutdown();

            await pause(500);
        });
    });

    describe("DISCO8 - Discovery Server 2", function (this: any) {
        this.timeout(Math.max(50000, this.timeout()));

        it("DISCO8-A server shall not struggle to start if discovery server is not available", async () => {
            const discoveryServerEndpointUrl = `opc.tcp://localhost:${port_discovery}`;

            // no discovery ...
            const doTest = async (index: number, waitTime: number) => {
                const server = new OPCUAServer({
                    port: port + 10000,
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
                await server.start();
                await pause(waitTime);
                // no wait, but immpediate shutdown, so we are likely shutting donw while the registration is in progress
                await server.shutdown();
            }
            const promises: Promise<void>[] = [];
            for (let i = 0; i < 5; i += 4) {
                // in this test, there is no discovery server available
                promises.push(doTest(i, i * 500));

                await Promise.all(promises);
            }
        });
    });
}
