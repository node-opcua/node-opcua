import "should";
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
import { createServerThatRegistersItselfToTheDiscoveryServer, f, pause, startDiscovery, tweak_registerServerManager_timeout } from "./_helper";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");
const doDebug1 = false;

const port2 = 12400;
const port1 = 12401;
const discovery_port = 12402;

export function t(test: any) {
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

        const startDiscoveryServer = f(async function start_the_discovery_server() {
            // note : only one discovery server shall be run per machine
            discoveryServer = await startDiscovery(discovery_port);
            discoveryServerEndpointUrl = discoveryServer.getEndpointUrl();
        });

        const stopDiscoveryServer = f(async function stop_the_discovery_server() {
            if (!discoveryServer) return;
            await discoveryServer.shutdown();
            discoveryServer = undefined;
            debugLog("discovery server stopped!");
        });

        let endpointUrl = "";

        const createServer = f(async function start_an_opcua_server_that_registers_to_the_lds() {
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port1, "AZ");
            g_server = server;
            await server.start();
            server.endpoints.length.should.be.greaterThan(0);
            endpointUrl = server.getEndpointUrl();
        });

        const shutdownServer = f(async function shutdown_the_opcua_server() {
            await g_server.shutdown();
            if (doDebug) {
                debugLog("Server has been shut down");
            }
            await wait_a_few_seconds();
        });


        interface ClientData {
            client: OPCUAClient;
            session: ClientSession;
            subscription: ClientSubscription;
            monitoredItem: ClientMonitoredItem;
        }
        const clients: ClientData[] = [];

        const connectManyClient = f(async function connect_many_opcua_clients() {
            let clientCount = 0;
            async function addClient() {
                if (doDebug) {
                    debugLog(" creating client");
                }
                const client = OPCUAClient.create({
                    requestedSessionTimeout: 10000,
                    clientName: "Client-" + clientCount + "__" + __filename
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
                await client.connect(endpointUrl);

                const session = await client.createSession();

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
                        debugLog("subscription keepalive", client.clientName);
                    })
                    .on("terminated", function () {
                        /** */
                    });
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
                    if (doDebug1) {
                        debugLog(dataValue.toString());
                    }
                });
                clients.push({ client, session, subscription, monitoredItem });

            }

            const promises = [
                addClient(), addClient(), addClient(), addClient(), addClient(), addClient()
            ]
            await Promise.all(promises);
        });

        const shutdownClients = f(async function disconnect_the_opcua_clients() {
            async function removeClient() {
                if (!clients) {
                    return;
                }
                const { client, session, subscription, monitoredItem } = clients.pop()!;
                await subscription.terminate();
                await session.close();
                await client.disconnect();
                if (doDebug) {
                    debugLog("Client terminated");
                }
            }

            const removePromises = [
                removeClient(), removeClient(), removeClient(), removeClient(), removeClient(), removeClient()
            ];
            await Promise.all(removePromises);
            debugLog("------------------------------------------ clients terminated");
        });

        const wait_a_few_seconds = f(async function wait_a_few_seconds() {
            await pause(500);
        });

        const wait_a_minute = f(async function wait_a_minute() {
            await pause(2 * 1000);
        });

        before(async () => {
            await startDiscoveryServer();
        });

        after(async () => {
            await stopDiscoveryServer();
        });

        it("DISCO4-A - should perform start/stop cycle efficiently - wait ", async () => {
            await createServer();
            await wait_a_few_seconds();
            await shutdownServer();
        });


        it("DISCO4-Z - should perform start/stop cycle efficiently - long wait ", async function () {

            await createServer();
            await wait_a_minute();
            await wait_a_minute();
            await wait_a_minute();
            await shutdownServer();
        });

        it("DISCO4-B - should perform start/stop cycle efficiently - no wait ", async function () {
            await createServer();
            await shutdownServer();
        });

        it("DISCO4-C - disposing  cerficiation manager during initialization ", async () => {
            const cm = new OPCUACertificateManager({
                // rootFolder:
            });

            (await f(async function when_creating_a_opcua_certificate_manager() {
                cm.initialize().then(() => {

                }).catch((err) => {

                });
            }))();

            await f(async function disposing() {
                await cm.dispose();
            });
        });

        const makeResolver = (): [Promise<void>, () => void] => {
            let resolveLast: (() => void) | undefined;
            const promise = new Promise<void>((resolve) => {
                resolveLast = resolve;
            });
            return [promise, resolveLast as () => void];
        }

        it("DISCO4-D - should cancel a client that is attempting a connection on an existing server", async () => {
            const client = OPCUAClient.create({
                clientName: "DISCO4-D " + __filename
            });

            const [promise, resolveLast] = makeResolver();

            const endpoint = discoveryServerEndpointUrl;

            await f(async function when_we_create_a_client_but_do_not_wait_for_connection() {
                client.connect(endpoint).then(() => {
                    resolveLast();
                }).catch((err) => {
                    /* nothing here */
                    // console.log("Connect err = ", err ? err.message: null);
                    resolveLast();
                });
            })();

            await f(async function when_we_close_client_while_connection_is_in_progress() {
                await client.disconnect();
            })();

            await f(async function then_client_should_cancel_initial_connection() {
                await wait_a_few_seconds();
            })();


            await promise;


        });


        it("DISCO4-E - should cancel a client that cannot connect - on standard LocalDiscoveryServer", async () => {
            const server = new OPCUAServer({
                port: port1,
                registerServerMethod: RegisterServerMethod.LDS,
                discoveryServerEndpointUrl: "opc.tcp://localhost:4840" //<< standard server
            });
            tweak_registerServerManager_timeout(server, 100);
            await server.start();
            await server.shutdown();
        });

        it("DISCO4-F - should cancel a client that cannot connect - on specific LocalDiscoveryServer", async () => {
            const server = new OPCUAServer({
                port: port1,
                registerServerMethod: RegisterServerMethod.LDS,
                discoveryServerEndpointUrl
            });
            await server.start();
            tweak_registerServerManager_timeout(server, 100);
            await server.shutdown();
        });

        it("DISCO4-G - registration manager as a standalone object 2/2 on a none existant discoveryServerEndpointUrl", async function () {

            // it should be possible to start and stop immediately when the registration process 
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

            await registrationManager.start();
            console.log(" Stopping");
            await registrationManager.stop();

        });
        it("DISCO4-H - registration manager as a standalone object 2/2", async () => {
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
            await registrationManager.start();
            await registrationManager.stop();
        });

        it("DISCO4-I - should perform start/stop cycle efficiently ", async () => {

            await createServer();
            await wait_a_few_seconds();
            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();
            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();
            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();
            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();
            await shutdownServer()

        });

        it("DISCO4-J - should perform start/stop cycle efficiently even with many connected clients and server close before clients", async () => {

            await createServer();

            await connectManyClient();
            await wait_a_few_seconds();
            await wait_a_few_seconds();

            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();

            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();

            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();

            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();

            await shutdownServer();

            await shutdownClients();
            await wait_a_few_seconds();

        });

        it("DISCO4-K - should perform start/stop cycle efficiently even with many connected clients and clients close before server", async () => {

            await createServer();

            await connectManyClient();
            await wait_a_few_seconds();

            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();
            await shutdownServer();

            await createServer();
            await wait_a_few_seconds();

            await shutdownClients();
            await wait_a_few_seconds();

            await shutdownServer();
            await wait_a_few_seconds();
            await wait_a_few_seconds();


        });

        it("DISCO4-L - should perform start/stop long cycle efficiently even with many connected clients and clients close before server", async () => {

            await createServer();
            await wait_a_few_seconds();

            await connectManyClient();
            await wait_a_few_seconds();
            await wait_a_few_seconds();

            await shutdownServer();
            await wait_a_minute();

            await createServer();
            await wait_a_minute();

            await shutdownClients();
            await wait_a_few_seconds();

            await shutdownServer();
            await wait_a_few_seconds();


        });

        it("DISCO4-M - NR2 should not crash when a server that failed to start is shot down", async () => {
            const server1 = new OPCUAServer({ port: port1 });
            await server1.start();

            // we start a second server on the same port !
            // this server will fail to start
            let secondServerFailedToStart = false;
            let server2;
            try {
                server2 = new OPCUAServer({ port: port1 /* yes port 1*/ });
                await server2.start();
                console.log("expecting a error here");
            } catch (err) {
                secondServerFailedToStart = true;
            }
            // shutdown_server_1(callback: ErrorCallback) {
            await server1.shutdown();

            // shutdown_server_2(callback: ErrorCallback) {
            !secondServerFailedToStart && server2 && (await server2.shutdown());

            secondServerFailedToStart.should.eql(true);
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
}
