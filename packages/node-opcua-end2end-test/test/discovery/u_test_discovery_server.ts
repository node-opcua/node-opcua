    // tslint:disable: no-console

import * as should from "should";
import * as async from "async";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
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
    RegisterServerMethod,
    makeApplicationUrn,
    OPCUACertificateManager,
    FindServerResults,
    OPCUADiscoveryServer
} from "node-opcua";
import { readCertificate, exploreCertificate } from "node-opcua-crypto";
import { createServerThatRegistersItselfToTheDiscoveryServer, ep, startDiscovery } from "./_helper";

const configFolder = path.join(__dirname, "../../tmp");

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port0 = 2500;
const port1 = 2501;
const port2 = 2502;
const port3 = 2503;
const port4 = 2504;
const port5 = 2505;
const port_discovery = 1235;
// add the tcp/ip endpoint with no security

process.on("uncaughtException",  (err) => {
    console.log(err);
});

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
export function t(test: any) {
    describe("DS1 - DiscoveryServer1", function (this: any) {
        this.timeout(30 * 1000);

        let discovery_server: OPCUADiscoveryServer | undefined;
        let discoveryServerEndpointUrl: string;
        let server: OPCUAServer | undefined;

        before(() => {
            server = new OPCUAServer({
                port: port0
            });
        });

        after(async () => {
            await server!.shutdown();
            server = undefined;
        });

        beforeEach(async () => {
            const serverCertificateManager = new OPCUACertificateManager({
                rootFolder: path.join(configFolder, "PKI-Discovery")
            });
            await serverCertificateManager.initialize();

            discovery_server = new OPCUADiscoveryServer({
                port: port_discovery,
                serverCertificateManager
            });
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
                endpointMustExist: false
            });
            client.on("backoff", () => {
                console.log("cannot connect to " + discoveryServerEndpointUrl);
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

        it("should fail to register server if discovery url is not specified (Bad_DiscoveryUrlMissing)", async () => {
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

            function check_response(err: Error | null, response: any): void {
                should.not.exist(err);
                //xx console.log(response.toString());
                response.responseHeader.serviceResult.should.eql(StatusCodes.BadDiscoveryUrlMissing);
            }

            await send_registered_server_request(discoveryServerEndpointUrl, request, check_response);
        });

        it("should fail to register server to the discover server if server type is Client (BadInvalidArgument)", async () => {
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

            function check_response(err: Error | null, response: any) {
                should.not.exist(err);
                //xx debugLog(response.toString());
                response.responseHeader.serviceResult.should.eql(StatusCodes.BadInvalidArgument);
            }

            await send_registered_server_request(discoveryServerEndpointUrl, request, check_response);
        });

        it("should fail to register server to the discover server if server name array is empty (BadServerNameMissing)", async () => {
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

            function check_response(err: Error | null, response: any) {
                should.not.exist(err);
                response.responseHeader.serviceResult.should.eql(StatusCodes.BadServerNameMissing);
            }

            await send_registered_server_request(discoveryServerEndpointUrl, request, check_response);
        });
    });

    describe("DS2 - DiscoveryServer2", function (this: any) {
        this.timeout(20000);

        let discoveryServer: OPCUADiscoveryServer;
        let discoveryServerEndpointUrl: string;
        let server: OPCUAServer;

        before(() => {
            OPCUAServer.registry.count().should.eql(0);
        });

        after(() => {
            OPCUAServer.registry.count().should.eql(0);
        });
        beforeEach(async () => {
            const serverCertificateManager = new OPCUACertificateManager({
                rootFolder: path.join(configFolder, "PKI-Discovery")
            });
            await serverCertificateManager.initialize();
            discoveryServer = new OPCUADiscoveryServer({
                port: port_discovery,
                serverCertificateManager
            });
            await discoveryServer.start();
            discoveryServerEndpointUrl = discoveryServer.getEndpointUrl()!;
            if (doDebug) {
                console.log(discoveryServerEndpointUrl);
            }
        });

        afterEach(async () => {
            await discoveryServer.shutdown();
        });

        async function addServerCertificateToTrustedCertificateInDiscoveryServer(server: OPCUAServer) {
            const filename = server.certificateFile;
            fs.existsSync(filename).should.eql(true);
            const certificate = readCertificate(filename);
            await discoveryServer.serverCertificateManager.trustCertificate(certificate);
        }

        it("DS2-A should register server to the discover server 2", async () => {
            const applicationUri = makeApplicationUrn(os.hostname(), "NodeOPCUA-Server");

            // there should be no endpoint exposed by an blank discovery server
            discoveryServer.registeredServerCount.should.equal(0);
            let initialServerCount = 0;

            // ----------------------------------------------------------------------------
            const data = await findServers(discoveryServerEndpointUrl);
            debugLog("data = ", data);
            const { servers, endpoints } = data;
            initialServerCount = servers.length;
            servers[0].discoveryUrls!.length.should.eql(1);

            debugLog(" initialServerCount = ", initialServerCount);
            debugLog("servers[0].discoveryUrls", servers[0].discoveryUrls!.join("\n"));

            // ----------------------------------------------------------------------------
            server = new OPCUAServer({
                port: port1,
                registerServerMethod: RegisterServerMethod.LDS,
                discoveryServerEndpointUrl,
                serverInfo: {
                    applicationName: { text: "NodeOPCUA", locale: "en" },
                    applicationUri,
                    productUri: "NodeOPCUA-Server",
                    discoveryProfileUri: null,
                    discoveryUrls: [],
                    gatewayServerUri: null
                }
            });

            await addServerCertificateToTrustedCertificateInDiscoveryServer(server);

            await server.start();

            // server registration takes place in parallel and should be checked independently
            await new Promise<void>((resolve) => {
                server.once("serverRegistered", () => {
                    resolve();
                });
            });

            // ----------------------------------------------------------------------------
            discoveryServer.registeredServerCount.should.equal(1);

            {
                const data = await findServers(discoveryServerEndpointUrl);
                const { servers, endpoints } = data;
                //xx debugLog(servers[0].toString());
                servers.length.should.eql(initialServerCount + 1);
                servers[1].applicationUri!.should.eql(applicationUri);
            }

            // ----------------------------------------------------------------------------
            await server.shutdown();

            // ----------------------------------------------------------------------------
            {
                const { servers, endpoints } = await findServers(discoveryServerEndpointUrl);
                servers.length.should.eql(initialServerCount);
            }
        });
    });

    describe("DS3 - DiscoveryServer3 - many server", function (this: any) {
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

        beforeEach(async () => {
            discoveryServer = await startDiscovery(port_discovery);
            discoveryServerEndpointUrl = ep(discoveryServer);
        });

        afterEach(async () => {
            await discoveryServer.shutdown();
        });

        let registeredServerCount = 0;

        async function checkServerCertificateAgainsLDS(server: OPCUAServer) {
            const certificate = await server.getCertificate();
            const certIngo = await exploreCertificate(certificate);
            if (doDebug) {
                console.log(certIngo);
            }
            const status = await discoveryServer.serverCertificateManager.verifyCertificate(certificate);
            if (doDebug) {
                console.log(status);
            }
        }

        function start_all_servers(done: () => void) {
            registeredServerCount = 0;

            async.parallel(
                [
                    function (callback: () => void) {
                        debugLog("Starting  server1");
                        server1.start(callback);
                        server1.once("serverRegistered", () => {
                            debugLog("server1 registered");
                            registeredServerCount += 1;
                        });
                    },
                    function (callback: () => void) {
                        debugLog("Starting  server2");
                        server2.start(callback);
                        server2.once("serverRegistered", () => {
                            debugLog("server2 registered");
                            registeredServerCount += 1;
                        });
                    },
                    function (callback: () => void) {
                        debugLog("Starting  server3");
                        server3.start(callback);
                        server3.once("serverRegistered", () => {
                            debugLog("server3 registered");
                            registeredServerCount += 1;
                        });
                    },
                    function (callback: () => void) {
                        debugLog("Starting  server4");
                        server4.start(callback);
                        server4.once("serverRegistered", () => {
                            debugLog("server4 registered");
                            registeredServerCount += 1;
                        });
                    },
                    function (callback: () => void) {
                        debugLog("Starting  server5");
                        server5.start(callback);
                        server5.once("serverRegistered", () => {
                            debugLog("server5 registered");
                            registeredServerCount += 1;
                        });
                    }
                ],
                done
            );
        }

        function stop_all_servers(done: () => void) {
            async.parallel(
                [
                    function (callback: () => void) {
                        server1.shutdown(callback);
                    },
                    function (callback: () => void) {
                        server2.shutdown(callback);
                    },
                    function (callback: () => void) {
                        server3.shutdown(callback);
                    },
                    function (callback: () => void) {
                        server4.shutdown(callback);
                    },
                    function (callback: () => void) {
                        server5.shutdown(callback);
                    }
                ],
                done
            );
        }

        it("DS3-0 checking certificates", async () => {
            await checkServerCertificateAgainsLDS(server1);
            await checkServerCertificateAgainsLDS(server2);
            await checkServerCertificateAgainsLDS(server3);
            await checkServerCertificateAgainsLDS(server4);
        });

        it("DS3-1 a discovery server shall be able to expose many registered servers", function (done) {
            async.series(
                [
                    function (callback: () => void) {
                        start_all_servers(callback);
                    },
                    function (callback: () => void) {
                        function wait_until_all_servers_registered() {
                            if (registeredServerCount === 5) {
                                return callback();
                            }
                            setTimeout(wait_until_all_servers_registered, 500);
                        }

                        wait_until_all_servers_registered();
                    },
                    function (callback: () => void) {
                        discoveryServer.registeredServerCount.should.equal(5);
                        callback();
                    },

                    function wait_a_little_bit_to_let_bonjour_propagate_data(callback: () => void) {
                        setTimeout(callback, 2000);
                    },

                    function query_discovery_server_for_available_servers(callback: (err: Error | null) => void) {
                        findServers(discoveryServerEndpointUrl, (err: Error | null, data?: FindServerResults) => {
                            const { servers, endpoints } = data!;

                            if (doDebug) {
                                for (const s of servers) {
                                    debugLog(
                                        s.applicationUri,
                                        s.productUri,
                                        ApplicationType[s.applicationType],
                                        s.discoveryUrls![0]
                                    );
                                }
                            }
                            servers.length.should.eql(6); // 5 server + 1 discovery server

                            // servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server");
                            callback(err);
                        });
                    },

                    function query_discovery_server_for_available_servers_on_network(callback: (err: Error | null) => void) {
                        findServersOnNetwork(discoveryServerEndpointUrl, (err, servers) => {
                            if (doDebug || servers!.length !== 6) {
                                for (const s of servers!) {
                                    console.log(s.toString());
                                }
                            }
                            servers!.length.should.eql(
                                6,
                                "may be you have a LDS running on your system. please make sure to shut it down before running the tests"
                            ); // 5 server + 1 discovery server
                            // servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server");
                            callback(err);
                        });
                    },
                    function (callback: () => void) {
                        stop_all_servers(callback);
                    }
                ],
                done
            );
        });
    });
}
