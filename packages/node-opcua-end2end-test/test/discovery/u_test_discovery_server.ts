import should from "should";

import { assert } from "node-opcua-assert";

import {
    OPCUAServer,
    OPCUAClient,
    ApplicationType,
    findServers,
    findServersOnNetwork,
    RegisterServerResponse,
    RegisterServerRequest,
    StatusCodes,
    OPCUADiscoveryServer,
    ServiceFault
} from "node-opcua";
import { exploreCertificate } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import {
    stepLog,
    waitUntilCondition,
} from "../../test_helpers/utils";
import {
    cleanUpmDNSandSanityCheck,
    createServerThatRegistersItselfToTheDiscoveryServer,
    ep,
    pause,
    startAndWaitForRegisteredToLDS,
    startDiscovery,
    tweak_registerServerManager_timeout,
    TestHarness,
    makeDiscoveryServer,
    addServerCertificateToTrustedCertificateInDiscoveryServer
} from "./helpers/index";

import chalk from "chalk";
const { green, red, cyan, yellow } = chalk;
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port0 = 2500;
const port1 = 2501;
const port2 = 2502;
const port3 = 2503;
const port4 = 2504;
const port5 = 2505;
const port_discovery = 2516;
// add the tcp/ip endpoint with no security

process.on("uncaughtException", (err) => {
    console.log(err);
});




export function t(test: TestHarness) {
    describe("DISCO1 - DiscoveryServer1", function (this: Mocha.Runnable) {
        this.timeout(30 * 1000);

        let discovery_server: OPCUADiscoveryServer | undefined;
        let discoveryServerEndpointUrl: string;
        let server: OPCUAServer | undefined;

        before(async () => {
            server = new OPCUAServer({
                port: port0,
                serverCertificateManager: test.serverCertificateManager
            });

            await server.initialize();
            await server.initializeCM();
        });

        after(async () => {
            await server!.shutdown();
            server = undefined;
        });

        beforeEach(async () => {
            await cleanUpmDNSandSanityCheck();
            discovery_server = await makeDiscoveryServer(port_discovery, test);
            await discovery_server.start();
            discoveryServerEndpointUrl = discovery_server.getEndpointUrl();
            debugLog(" discovery_server_endpointUrl = ", discoveryServerEndpointUrl);
        });

        afterEach(async () => {
            await discovery_server!.shutdown();
            discovery_server = undefined;
        });

        async function send_registered_server_request(
            discoveryServerEndpointUrl: string,
            registerServerRequest: any,
            externalFunc: any
        ): Promise<void> {
            const client = OPCUAClient.create({
                endpointMustExist: false,
                clientName: __filename
            });
            client.on("backoff", () => {
                debugLog("cannot connect to " + discoveryServerEndpointUrl);
            });

            await client.connect(discoveryServerEndpointUrl);

            await new Promise<void>((resolve) => {
                (client as any).performMessageTransaction(
                    registerServerRequest,
                    (err: Error | null, response: RegisterServerResponse) => {
                        if (!err) {
                            // RegisterServerResponse
                            assert(response instanceof RegisterServerResponse);
                        }
                        externalFunc(err, response);
                        resolve();
                    }
                );
            });
            await client.disconnect();
        }

        it("DISCO1-1 should fail to register server if discovery url is not specified (Bad_DiscoveryUrlMissing)", async () => {
            const request = new RegisterServerRequest({
                server: {
                    // The globally unique identifier for the Server instance. The serverUri matches
                    // the applicationUri from the ApplicationDescription defined in 7.1.
                    serverUri: "uri:MyServerURI",

                    // The globally unique identifier for the Server product.
                    productUri: "productUri",

                    serverNames: [{ text: "some name" }],

                    serverType: ApplicationType.Server,
                    gatewayServerUri: null,
                    discoveryUrls: [], // INTENTIONALLY EMPTY
                    semaphoreFilePath: null,
                    isOnline: false
                }
            });

            function check_error_response(err: Error | null, response: any): void {
                should.exist(err);
                should.not.exist(response);
                (err as any).response.should.be.instanceOf(ServiceFault);
                (err as any).response.responseHeader.serviceResult.should.eql(StatusCodes.BadDiscoveryUrlMissing);
            }

            await send_registered_server_request(discoveryServerEndpointUrl, request, check_error_response);
        });

        it("DISCO1-2 should fail to register server to the discover server if server type is Client (BadInvalidArgument)", async () => {
            const request = new RegisterServerRequest({
                server: {
                    // The globally unique identifier for the Server instance. The serverUri matches
                    // the applicationUri from the ApplicationDescription defined in 7.1.
                    serverUri: "uri:MyServerURI",

                    // The globally unique identifier for the Server product.
                    productUri: "productUri",

                    serverNames: [{ text: "some name" }],

                    serverType: ApplicationType.Client, /// CLIENT HERE !!!
                    gatewayServerUri: null,
                    discoveryUrls: [],
                    semaphoreFilePath: null,
                    isOnline: false
                }
            });

            function check_error_response(err: Error | null, response: any) {
                should.exist(err);
                should.not.exist(response);
                //xx debugLog(response.toString());
                (err as any).response.should.be.instanceOf(ServiceFault);
                (err as any).response.responseHeader.serviceResult.should.eql(StatusCodes.BadInvalidArgument);
            }

            await send_registered_server_request(discoveryServerEndpointUrl, request, check_error_response);
        });

        it("DISCO1-3 should fail to register server to the discover server if server name array is empty (BadServerNameMissing)", async () => {
            const request = new RegisterServerRequest({
                server: {
                    // The globally unique identifier for the Server instance. The serverUri matches
                    // the applicationUri from the ApplicationDescription defined in 7.1.
                    serverUri: "uri:MyServerURI",

                    // The globally unique identifier for the Server product.
                    productUri: "productUri",

                    serverNames: [], /// <<<<< INTENTIONALLY EMPTY

                    serverType: ApplicationType.Server,
                    gatewayServerUri: null,
                    discoveryUrls: [],
                    semaphoreFilePath: null,
                    isOnline: false
                }
            });

            function check_error_response(err: Error | null, response: any) {
                should.exist(err);
                should.not.exist(response);
                (err as any).response.should.be.instanceOf(ServiceFault);
                (err as any).response.responseHeader.serviceResult.should.eql(StatusCodes.BadServerNameMissing);
            }

            await send_registered_server_request(discoveryServerEndpointUrl, request, check_error_response);
        });
    });

    describe("DISCO2 - DiscoveryServer2", function (this: Mocha.Runnable) {
        this.timeout(Math.max(60 * 1000, this.timeout()));

        let discoveryServer: OPCUADiscoveryServer;
        let discoveryServerEndpointUrl: string;

        beforeEach(async () => {
            OPCUAServer.registry.count().should.eql(0);
            discoveryServer = await makeDiscoveryServer(port_discovery, test);
            await discoveryServer.start();
            discoveryServerEndpointUrl = discoveryServer.getEndpointUrl()!;
            debugLog("Discovery server started", discoveryServerEndpointUrl);
        });

        afterEach(async () => {
            if (discoveryServer) {
                await discoveryServer.shutdown();
                debugLog("Discovery server stopped");
            }
            OPCUAServer.registry.count().should.eql(0);
        });

        it("DISCO2-0 a registered server is shutting down (and unregistering) before the discovery server shutdwn should not cause issues", async () => {

            stepLog("1. Given a server that registers itself to the LDS = " + discoveryServerEndpointUrl);
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(
                discoveryServerEndpointUrl, port2, "for outage");
            addServerCertificateToTrustedCertificateInDiscoveryServer(server, discoveryServer);

            // fast re-registering
            tweak_registerServerManager_timeout(server, 100);
            await startAndWaitForRegisteredToLDS(server);

            stepLog("2. When the registered server is shutdown before the discovery server");
            await server.shutdown();

            stepLog("3. Then the discovery server should not encounter issues when it eventually shuts down");
            await discoveryServer.shutdown();
            await pause(1000);
            true.should.be.eql(true, "Discovery server should shut down cleanly even if registered server was already shut down");
        });

        it("DISCO2-1 should register server to the discover server 2", async () => {


            stepLog("1 - checking precondition : there should be no endpoint exposed by an blank discovery server");
            discoveryServer.registeredServerCount.should.equal(0);

            const data = await findServers(discoveryServerEndpointUrl);
            debugLog("data = ", data);
            const { servers, endpoints } = data;
            servers[0].discoveryUrls!.length.should.eql(1);
            debugLog("servers[0].discoveryUrls", servers[0].discoveryUrls!.join("\n"));
            let initialServerCount = servers.length;
            debugLog(" initialServerCount = ", initialServerCount);
            // reminder: the number of returned servers by find server is always +1 
            // as the discovery server itslef is in the list but is not considered
            // as a registered server.
            discoveryServer.registeredServerCount.should.eql(initialServerCount - 1);


            stepLog("2 - given a server that registers itself to the LDS");
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port2, "for outage");
            addServerCertificateToTrustedCertificateInDiscoveryServer(server, discoveryServer);

            // fast reregistering
            tweak_registerServerManager_timeout(server, 2000);

            stepLog("3 - When the server starts and notifes that it has registered");
            await startAndWaitForRegisteredToLDS(server);
            const applicationUri = server.serverInfo.applicationUri;
            debugLog("server.applicationUri =", applicationUri);

            stepLog("4 - Then I should verify that the discovery server has an incremented registeredServerCount");
            discoveryServer.registeredServerCount.should.equal(1);

            stepLog("4.1 - And Then I should verify that the server application applicationUri can be found in the list of registered server");
            {
                const data = await findServers(discoveryServerEndpointUrl);
                const { servers, endpoints } = data;
                servers.length.should.eql(initialServerCount + 1);
                servers[1].applicationUri!.should.eql(applicationUri);
            }

            stepLog("5. When the server shut down");
            await server.shutdown();

            stepLog("6. then I should verify that the the server has been unregistered");
            {
                const { servers, endpoints } = await findServers(discoveryServerEndpointUrl);
                servers.length.should.eql(initialServerCount);
            }
            await pause(1000);

        });

        it("DISCO2-2 should re-register after discovery server outage", async () => {

            stepLog("1. Given a server that registers itself to the LDS");
            // #region
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(
                discoveryServerEndpointUrl, port2, "DISCO2-2");
            addServerCertificateToTrustedCertificateInDiscoveryServer(server, discoveryServer);

            // fast re-registering
            tweak_registerServerManager_timeout(server, 1000);
            await startAndWaitForRegisteredToLDS(server);
            //#endregion


            try {


                stepLog("2. we should verify that the server appears in the list of administered servers in the LDS");
                // #region
                const applicationUri = server.serverInfo.applicationUri;

                // Ensure it's registered
                let foundServers = await findServers(discoveryServerEndpointUrl);
                foundServers.servers.filter(
                    s => s.applicationUri === applicationUri)
                    .length.should.equal(1, "Server should be registered");
                // #endregion

                // 3. Shut down the discovery server
                debugLog("Shutting down discovery server to simulate an outage...");
                await discoveryServer.shutdown();
                debugLog("Discovery server shut down.");

                // 3. Wait for the server to detect the outage and go into a pending state (backoff)
                await new Promise<void>((resolve, reject) => {
                    const timerId = setTimeout(() => reject(new Error("Server did not enter pending state.")), 15000);
                    server.once("serverRegistrationPending", () => {
                        clearTimeout(timerId);
                        resolve();
                    });
                });
                stepLog("Server detected outage and is in a pending state.");


                // 4. Restart the discovery server
                stepLog("Restarting discovery server...");
                discoveryServer = await await makeDiscoveryServer(port_discovery, test)

                await discoveryServer.start();
                stepLog("Discovery server restarted");


                const waitUntilServerRenewRegistration = async () => {
                    // 5. Wait for the server to automatically re-register
                    await new Promise<void>((resolve, reject) => {
                        const timerId = setTimeout(() => reject(new Error("Server failed to re-register.")), 15000);
                        server.once("serverRegistrationRenewed", () => {
                            stepLog(green("Server successfully re-registered!"));
                            clearTimeout(timerId);
                            resolve();
                        });
                    });
                }


                stepLog("5. Wait for the server to automatically re-register");
                await waitUntilServerRenewRegistration();

                await waitUntilServerRenewRegistration();

                stepLog("6. Assert that the server is now discoverable again");
                foundServers = await findServers(discoveryServerEndpointUrl);
                foundServers.servers.filter(s => s.applicationUri === applicationUri)
                    .length.should.equal(1, "Server should have been be re-registered after outage");


            } finally {

                // Clean up
                await server.shutdown();
            }
            // 
            await waitUntilCondition(async () => {
                return discoveryServer.registeredServerCount == 0 ? true : false;
            }, 200000, "");

            await pause(1000);

            await discoveryServer.shutdown();

        });

        it("DISCO2-3 should handle discovery server shutting down while server is trying to register", async () => {

            // 1. Given a Server that starts
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(
                discoveryServerEndpointUrl, port2, "for outage");
            addServerCertificateToTrustedCertificateInDiscoveryServer(server, discoveryServer);

            // fast re-registering
            tweak_registerServerManager_timeout(server, 100);

            const promise = new Promise<void>((resolve, reject) => {

                server.start().then(() => {
                    server.shutdown().finally(() => {
                        resolve();
                    });
                }).catch((err) => {
                    reject(err);
                });
            })
            await pause(10);
            await discoveryServer.shutdown();
            await pause(1000);
            await promise; // ensure server is shut down

        });
        it("DISCO2-4 discovery server shutting down before registered server does should not cause issues", async () => {

            // 1. Given a server that registers itself to the LDS
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(
                discoveryServerEndpointUrl, port2, "for outage");
            addServerCertificateToTrustedCertificateInDiscoveryServer(server, discoveryServer);

            // fast re-registering
            tweak_registerServerManager_timeout(server, 100);

            await startAndWaitForRegisteredToLDS(server);

            await pause(1000);
            // 2. When the discovery server is shutdown before the registered server
            await discoveryServer.shutdown();

            await pause(2000);
            // 3. Then the registered server should not encounter issues when it eventually shuts down
            await server.shutdown();

            // allow some time for any async operations to complete
            await pause(1000);

            // If we reach this point without errors, the test passes
            true.should.be.eql(true, "Registered server should shut down cleanly even if discovery server was already shut down");

        });
    });

    describe("DISCO3 - DiscoveryServer3 - many server", function (this: any) {
        this.timeout(200000);

        let discoveryServer: OPCUADiscoveryServer;
        let discoveryServerEndpointUrl: string;

        let server1: OPCUAServer;
        let server2: OPCUAServer;
        let server3: OPCUAServer;
        let server4: OPCUAServer;
        let server5: OPCUAServer;

        discoveryServerEndpointUrl = `opc.tcp://localhost:${port_discovery}`; // discovery_server.endpoint[0].endpointUrl;

        before(async () => {
            OPCUAServer.registry.count().should.eql(0);
            server1 = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port1, "AA");
            server2 = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port2, "BB");
            server3 = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port3, "CC");
            server4 = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port4, "DD");
            server5 = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port5, "EE");
        });

        after(() => {
            OPCUAServer.registry.count().should.eql(0);
        });

        before(async () => {
            discoveryServer = await startDiscovery(port_discovery);
            discoveryServerEndpointUrl = ep(discoveryServer);
        });

        after(async () => {
            await discoveryServer.shutdown();
        });

        beforeEach(async () => {
            await cleanUpmDNSandSanityCheck();
        })
        let registeredServerCount = 0;

        async function checkServerCertificateAgainstLDS(server: OPCUAServer) {
            const certificate = await server.getCertificate();
            const certificateInfo = await exploreCertificate(certificate);
            if (doDebug) {
                debugLog(certificateInfo);
            }
            const statusBefore = await discoveryServer.serverCertificateManager.verifyCertificate(certificate);
            if (doDebug) {
                debugLog("statusBefore = ", statusBefore);
            }

            await discoveryServer.serverCertificateManager.trustCertificate(certificate);

            const statusAfter = await discoveryServer.serverCertificateManager.verifyCertificate(certificate);
            if (doDebug) {
                debugLog("statusAfter = ", statusAfter);
            }
            statusAfter.should.eql("Good");
        }


        async function start_all_servers() {
            registeredServerCount = 0;


            const tasks = [
                startAndWaitForRegisteredToLDS(server1),
                startAndWaitForRegisteredToLDS(server2),
                startAndWaitForRegisteredToLDS(server3),
                startAndWaitForRegisteredToLDS(server4),
                startAndWaitForRegisteredToLDS(server5),
            ];
            await Promise.all(tasks);
            registeredServerCount = 5;
        }

        async function stop_all_servers() {

            const tasks = [
                server1.shutdown(),
                server2.shutdown(),
                server3.shutdown(),
                server4.shutdown(),
                server5.shutdown(),

            ];
            await Promise.all(tasks)
        }

        it("DISCO3-1 checking certificates", async () => {
            await checkServerCertificateAgainstLDS(server1);
            await checkServerCertificateAgainstLDS(server2);
            await checkServerCertificateAgainstLDS(server3);
            await checkServerCertificateAgainstLDS(server4);
        });


        async function wait_until_all_servers_registered(expectedCount: number): Promise<void> {
            stepLog(`waiting for all servers to be registered ${registeredServerCount} expected ${expectedCount}`);
            const maxTime = 20 * 1000;
            const timeIncrement = 200;
            for (let t = 0; t < maxTime; t += timeIncrement) {
                if (registeredServerCount === expectedCount) {
                    debugLog("waited ", t, "ms");
                    break;
                }
                await pause(timeIncrement);
            }
        }

        it("DISCO3-2 a discovery server shall be able to expose many registered servers", async () => {


            // ensure that no servers have been regiester yet
            // we may have dangling opcua reservers still pending in the air
            const { servers: serversBefore, endpoints: endPointsBefore } = await findServers(discoveryServerEndpointUrl);
            const before = serversBefore.length;

            await start_all_servers();

            await wait_until_all_servers_registered(5);

            discoveryServer.registeredServerCount.should.equal(5);

            await pause(3000);

            const { servers, endpoints } = await findServers(discoveryServerEndpointUrl);
            if (doDebug) {
                debugLog(
                    "------- findServersOnNetwork on ",
                    discoveryServerEndpointUrl,
                    "returned ",
                    servers.length,
                    "servers: here they are:"
                );
                for (const s of servers) {
                    debugLog(s.applicationUri, s.productUri, ApplicationType[s.applicationType], s.discoveryUrls![0]);
                }
            }
            servers.length.should.eql(5 + before); // 5 server + 1 discovery server

            // servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server");
            await pause(3000);
            {
                const servers = await findServersOnNetwork(discoveryServerEndpointUrl);
                if (servers!.length !== 6) {
                    debugLog(
                        "------- findServersOnNetwork on ",
                        discoveryServerEndpointUrl,
                        "returned ",
                        servers.length,
                        "servers: here they are:"
                    );
                    for (const s of servers!) {
                        debugLog(s.toString());
                    }
                }
                servers!.length.should.eql(
                    6,
                    "found " +
                    servers!.length +
                    " server running instead of 6: may be you have a LDS running on your system. please make sure to shut it down before running the tests"
                ); // 5 server + 1 discovery server
                // servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server");
            }

            await stop_all_servers();
        });
    });
}
