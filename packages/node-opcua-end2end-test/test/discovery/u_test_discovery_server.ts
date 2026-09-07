import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import chalk from "chalk";
import {
    ApplicationType,
    findServers,
    findServersOnNetwork,
    MessageSecurityMode,
    makeApplicationUrn,
    OPCUAClient,
    type OPCUADiscoveryServer,
    OPCUAServer,
    RegisterServer2Request,
    RegisterServer2Response,
    RegisterServerRequest,
    RegisterServerResponse,
    type RegistrationRefusedInfo,
    SecurityPolicy,
    ServiceFault,
    StatusCodes
} from "node-opcua";
import { assert } from "node-opcua-assert";
import { exploreCertificate, readCertificate } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { createServerCertificateManager } from "../../test_helpers/createServerCertificateManager.js";
import { stepLog, waitUntilCondition } from "../../test_helpers/utils.js";
import {
    addServerCertificateToTrustedCertificateInDiscoveryServer,
    cleanUpmDNSandSanityCheck,
    createServerThatRegistersItselfToTheDiscoveryServer,
    ep,
    makeDiscoveryServer,
    pause,
    startAndWaitForRegisteredToLDS,
    startDiscovery,
    type TestHarness,
    tweak_registerServerManager_timeout
} from "./helpers/index.js";

// RegisterServer is sent over the client's secure channel directly, without a session,
// so performMessageTransaction here is deliberately outside the public OPCUAClient surface.
type RegisterRequest = RegisterServerRequest | RegisterServer2Request;
type RegisterResponse = RegisterServerResponse | RegisterServer2Response;
type RegisteredServerOptions = NonNullable<NonNullable<ConstructorParameters<typeof RegisterServerRequest>[0]>["server"]>;
interface ClientWithTransaction {
    performMessageTransaction(request: RegisterRequest, callback: (err: Error | null, response?: RegisterResponse) => void): void;
}

interface ErrorWithServiceFaultResponse extends Error {
    response?: ServiceFault;
}

const { green } = chalk;
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
            await server?.shutdown();
            server = undefined;
        });

        async function startDiscoveryServer(options?: { allowUnsecuredRegistration?: boolean }) {
            discovery_server = await makeDiscoveryServer(port_discovery, test, options);
            await discovery_server.start();
            discoveryServerEndpointUrl = discovery_server.getEndpointUrl();
            debugLog(" discovery_server_endpointUrl = ", discoveryServerEndpointUrl);
            // the LDS only accepts registrations from applications it trusts (OPC UA Part 4 §5.5.5)
            await addServerCertificateToTrustedCertificateInDiscoveryServer(server!, discovery_server);
        }

        beforeEach(async () => {
            await cleanUpmDNSandSanityCheck();
            await startDiscoveryServer();
        });

        afterEach(async () => {
            await discovery_server?.shutdown();
            discovery_server = undefined;
        });

        interface RegistrantIdentity {
            certificateFile: string;
            privateKeyFile: string;
            applicationUri: string;
        }
        /** the identity of the (trusted) OPCUAServer created in `before` */
        function trustedIdentity(): RegistrantIdentity {
            return {
                certificateFile: server!.certificateFile,
                privateKeyFile: server!.privateKeyFile,
                applicationUri: server!.serverInfo.applicationUri!
            };
        }

        interface SendOptions {
            securityMode?: MessageSecurityMode;
            securityPolicy?: SecurityPolicy;
            identity?: RegistrantIdentity;
        }

        /**
         * open a SecureChannel to the LDS and send a raw RegisterServer(2) request on it.
         * By default the channel is SignAndEncrypt with the trusted server identity.
         */
        async function send_registered_server_request(
            discoveryServerEndpointUrl: string,
            registerServerRequest: RegisterRequest,
            externalFunc: (err: Error | null, response?: RegisterResponse) => void,
            options?: SendOptions
        ): Promise<void> {
            const securityMode = options?.securityMode ?? MessageSecurityMode.SignAndEncrypt;
            const securityPolicy = options?.securityPolicy ?? SecurityPolicy.Basic256Sha256;
            const identity = options?.identity ?? trustedIdentity();

            // a dedicated store that auto-accepts the LDS certificate; the identity is passed explicitly
            const clientCertificateManager = await createServerCertificateManager(port0);

            const client = OPCUAClient.create({
                endpointMustExist: false,
                clientName: "u_test_discovery_server",
                securityMode,
                securityPolicy,
                clientCertificateManager,
                // a refused OpenSecureChannel must surface immediately, not retry forever
                connectionStrategy: { maxRetry: 0 },
                ...identity
            });
            client.on("backoff", () => {
                debugLog(`cannot connect to ${discoveryServerEndpointUrl}`);
            });

            await client.connect(discoveryServerEndpointUrl);
            try {
                await new Promise<void>((resolve, reject) => {
                    (client as unknown as ClientWithTransaction).performMessageTransaction(
                        registerServerRequest,
                        (err, response) => {
                            // an assertion failure inside the callback must fail the test, not hang it
                            try {
                                if (!err) {
                                    assert(
                                        response instanceof RegisterServerResponse || response instanceof RegisterServer2Response
                                    );
                                }
                                externalFunc(err, response);
                                resolve();
                            } catch (assertionError) {
                                reject(assertionError as Error);
                            }
                        }
                    );
                });
            } finally {
                await client.disconnect();
            }
        }

        function expectServiceFault(expected: (typeof StatusCodes)[keyof typeof StatusCodes]) {
            return (err: Error | null, response?: RegisterResponse) => {
                should.exist(err);
                should.not.exist(response);
                should((err as ErrorWithServiceFaultResponse).response).be.instanceOf(ServiceFault);
                should((err as ErrorWithServiceFaultResponse).response?.responseHeader.serviceResult).eql(expected);
            };
        }

        /** a well-formed registration for the trusted identity */
        function validRegisteredServer(): RegisteredServerOptions {
            return {
                serverUri: trustedIdentity().applicationUri,
                productUri: "productUri",
                serverNames: [{ text: "some name" }],
                serverType: ApplicationType.Server,
                gatewayServerUri: null,
                discoveryUrls: ["opc.tcp://localhost:2500"],
                semaphoreFilePath: null,
                isOnline: false
            };
        }

        it("DISCO1-1 should fail to register server if discovery url is not specified (Bad_DiscoveryUrlMissing)", async () => {
            const request = new RegisterServerRequest({
                server: {
                    // The globally unique identifier for the Server instance. The serverUri matches
                    // the applicationUri from the ApplicationDescription defined in 7.1.
                    serverUri: trustedIdentity().applicationUri,

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

            function check_error_response(err: Error | null, response?: RegisterResponse): void {
                should.exist(err);
                should.not.exist(response);
                should((err as ErrorWithServiceFaultResponse).response).be.instanceOf(ServiceFault);
                should((err as ErrorWithServiceFaultResponse).response?.responseHeader.serviceResult).eql(
                    StatusCodes.BadDiscoveryUrlMissing
                );
            }

            await send_registered_server_request(discoveryServerEndpointUrl, request, check_error_response);
        });

        it("DISCO1-2 should fail to register server to the discover server if server type is Client (BadInvalidArgument)", async () => {
            const request = new RegisterServerRequest({
                server: {
                    // The globally unique identifier for the Server instance. The serverUri matches
                    // the applicationUri from the ApplicationDescription defined in 7.1.
                    serverUri: trustedIdentity().applicationUri,

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

            function check_error_response(err: Error | null, response?: RegisterResponse) {
                should.exist(err);
                should.not.exist(response);
                //xx debugLog(response.toString());
                should((err as ErrorWithServiceFaultResponse).response).be.instanceOf(ServiceFault);
                should((err as ErrorWithServiceFaultResponse).response?.responseHeader.serviceResult).eql(
                    StatusCodes.BadInvalidArgument
                );
            }

            await send_registered_server_request(discoveryServerEndpointUrl, request, check_error_response);
        });

        it("DISCO1-3 should fail to register server to the discover server if server name array is empty (BadServerNameMissing)", async () => {
            const request = new RegisterServerRequest({
                server: {
                    // The globally unique identifier for the Server instance. The serverUri matches
                    // the applicationUri from the ApplicationDescription defined in 7.1.
                    serverUri: trustedIdentity().applicationUri,

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

            function check_error_response(err: Error | null, response?: RegisterResponse) {
                should.exist(err);
                should.not.exist(response);
                should((err as ErrorWithServiceFaultResponse).response).be.instanceOf(ServiceFault);
                should((err as ErrorWithServiceFaultResponse).response?.responseHeader.serviceResult).eql(
                    StatusCodes.BadServerNameMissing
                );
            }

            await send_registered_server_request(discoveryServerEndpointUrl, request, check_error_response);
        });

        // ---------------------------------------------------------------------------------------------------
        // RegisterServer(2) must only be accepted from an authenticated SecureChannel
        // whose certificate ApplicationUri matches serverUri (OPC UA Part 4 §5.5.5 / §5.5.6)
        // ---------------------------------------------------------------------------------------------------

        it("DISCO1-4 should accept a well-formed RegisterServer over an authenticated SecureChannel", async () => {
            const request = new RegisterServerRequest({ server: { ...validRegisteredServer(), isOnline: true } });

            const refused: RegistrationRefusedInfo[] = [];
            discovery_server!.on("onRegistrationRefused", (_server, info) => refused.push(info));

            await send_registered_server_request(discoveryServerEndpointUrl, request, (err, response) => {
                should.not.exist(err);
                should(response).be.instanceOf(RegisterServerResponse);
            });
            refused.length.should.eql(0);
            should(discovery_server?.registeredServerCount).eql(1);
        });

        it("DISCO1-5 should refuse RegisterServer over a MessageSecurityMode.None channel (BadSecurityModeInsufficient)", async () => {
            const request = new RegisterServerRequest({ server: { ...validRegisteredServer(), isOnline: true } });

            const refused: RegistrationRefusedInfo[] = [];
            discovery_server!.on("onRegistrationRefused", (_server, info) => refused.push(info));

            await send_registered_server_request(
                discoveryServerEndpointUrl,
                request,
                expectServiceFault(StatusCodes.BadSecurityModeInsufficient),
                { securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None }
            );

            should(discovery_server?.registeredServerCount).eql(0);
            refused.length.should.eql(1);
            refused[0].statusCode.should.eql(StatusCodes.BadSecurityModeInsufficient);
            refused[0].securityMode.should.eql(MessageSecurityMode.None);
            refused[0].certificateApplicationUris.should.eql([]);
            refused[0].remoteAddress.should.be.a.String();
        });

        it("DISCO1-6 should refuse RegisterServer2 over a MessageSecurityMode.None channel (BadSecurityModeInsufficient)", async () => {
            const request = new RegisterServer2Request({
                server: { ...validRegisteredServer(), isOnline: true },
                discoveryConfiguration: []
            });

            await send_registered_server_request(
                discoveryServerEndpointUrl,
                request,
                expectServiceFault(StatusCodes.BadSecurityModeInsufficient),
                { securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None }
            );
            should(discovery_server?.registeredServerCount).eql(0);
        });

        it("DISCO1-7 should accept an unsecured RegisterServer when allowUnsecuredRegistration is explicitly enabled", async () => {
            await discovery_server!.shutdown();
            await startDiscoveryServer({ allowUnsecuredRegistration: true });

            const request = new RegisterServerRequest({ server: { ...validRegisteredServer(), isOnline: true } });
            await send_registered_server_request(
                discoveryServerEndpointUrl,
                request,
                (err, response) => {
                    should.not.exist(err);
                    should(response).be.instanceOf(RegisterServerResponse);
                },
                { securityMode: MessageSecurityMode.None, securityPolicy: SecurityPolicy.None }
            );
            should(discovery_server?.registeredServerCount).eql(1);
        });

        it("DISCO1-8 should refuse a registration whose serverUri does not match the certificate ApplicationUri (BadServerUriInvalid)", async () => {
            const request = new RegisterServerRequest({
                server: { ...validRegisteredServer(), serverUri: "urn:some:other:server", isOnline: true }
            });

            const refused: RegistrationRefusedInfo[] = [];
            discovery_server!.on("onRegistrationRefused", (_server, info) => refused.push(info));

            await send_registered_server_request(
                discoveryServerEndpointUrl,
                request,
                expectServiceFault(StatusCodes.BadServerUriInvalid)
            );

            should(discovery_server?.registeredServerCount).eql(0);
            refused.length.should.eql(1);
            refused[0].statusCode.should.eql(StatusCodes.BadServerUriInvalid);
            refused[0].securityMode.should.eql(MessageSecurityMode.SignAndEncrypt);
            refused[0].certificateApplicationUris.should.eql([trustedIdentity().applicationUri]);
        });

        it("DISCO1-9 should refuse a registrant with an unknown certificate at OpenSecureChannel, and accept it once trusted", async () => {
            // an application the LDS has never seen, with a certificate whose ApplicationUri matches its serverUri
            const unknownCertificateManager = await createServerCertificateManager(port5);
            const unknownApplicationUri = makeApplicationUrn(os.hostname(), "UnknownRegistrant");
            const unknownCertificateFile = path.join(unknownCertificateManager.rootDir, "certificate_unknown_registrant.pem");
            if (!fs.existsSync(unknownCertificateFile)) {
                await unknownCertificateManager.createSelfSignedCertificate({
                    applicationUri: unknownApplicationUri,
                    dns: [os.hostname(), "localhost"],
                    outputFile: unknownCertificateFile,
                    subject: "/CN=UnknownRegistrant",
                    startDate: new Date(),
                    validity: 365
                });
            }
            const unknownCertificate = readCertificate(unknownCertificateFile);
            const unknownIdentity: RegistrantIdentity = {
                certificateFile: unknownCertificateFile,
                privateKeyFile: unknownCertificateManager.privateKey as string,
                applicationUri: unknownApplicationUri
            };
            // make sure a previous run has not left it trusted
            await test.discoveryServerCertificateManager.rejectCertificate(unknownCertificate);

            const request = new RegisterServerRequest({
                server: { ...validRegisteredServer(), serverUri: unknownApplicationUri, isOnline: true }
            });

            stepLog("1. the unknown registrant cannot even open a SecureChannel to the LDS");
            let connectError: Error | null = null;
            try {
                await send_registered_server_request(discoveryServerEndpointUrl, request, () => {}, {
                    identity: unknownIdentity
                });
            } catch (err) {
                connectError = err as Error;
            }
            should.exist(connectError, "expecting OpenSecureChannel to be refused");
            // the LDS answers BadSecurityChecksFailed and closes the socket; depending on timing the
            // client sees either the status code or only the dropped connection
            should(connectError?.message).match(/BadSecurityChecksFailed|BadCertificateUntrusted|rejected by server/);
            should(discovery_server?.registeredServerCount).eql(0);

            stepLog("2. its certificate has been placed in the rejected folder");
            (await test.discoveryServerCertificateManager.getTrustStatus(unknownCertificate)).should.eql(
                StatusCodes.BadCertificateUntrusted
            );
            const rejectedFolder = path.join(test.discoveryServerCertificateManager.rootDir, "rejected");
            fs.readdirSync(rejectedFolder).length.should.be.greaterThan(0);

            stepLog("3. once the administrator trusts the certificate, the registration succeeds");
            await test.discoveryServerCertificateManager.trustCertificate(unknownCertificate);

            const registered: Array<{ serverUri: string | null; firstTime: boolean }> = [];
            discovery_server!.on("onRegisterServer", (s, firstTime) => registered.push({ serverUri: s.serverUri, firstTime }));

            await send_registered_server_request(
                discoveryServerEndpointUrl,
                request,
                (err, response) => {
                    should.not.exist(err);
                    should(response).be.instanceOf(RegisterServerResponse);
                },
                { identity: unknownIdentity }
            );
            should(discovery_server?.registeredServerCount).eql(1);
            registered.should.eql([{ serverUri: unknownApplicationUri, firstTime: true }]);

            // leave the store as we found it
            await test.discoveryServerCertificateManager.rejectCertificate(unknownCertificate);
            await unknownCertificateManager.dispose();
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
            stepLog(`1. Given a server that registers itself to the LDS = ${discoveryServerEndpointUrl}`);
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(
                discoveryServerEndpointUrl,
                port2,
                "for outage"
            );
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
            const { servers } = data;
            should(servers[0].discoveryUrls?.length).eql(1);
            debugLog("servers[0].discoveryUrls", servers[0].discoveryUrls?.join("\n"));
            const initialServerCount = servers.length;
            debugLog(" initialServerCount = ", initialServerCount);
            // reminder: the number of returned servers by find server is always +1
            // as the discovery server itslef is in the list but is not considered
            // as a registered server.
            discoveryServer.registeredServerCount.should.eql(initialServerCount - 1);

            stepLog("2 - given a server that registers itself to the LDS");
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(
                discoveryServerEndpointUrl,
                port2,
                "for outage"
            );
            addServerCertificateToTrustedCertificateInDiscoveryServer(server, discoveryServer);

            // fast reregistering
            tweak_registerServerManager_timeout(server, 2000);

            stepLog("3 - When the server starts and notifes that it has registered");
            await startAndWaitForRegisteredToLDS(server);
            const applicationUri = server.serverInfo.applicationUri;
            debugLog("server.applicationUri =", applicationUri);

            stepLog("4 - Then I should verify that the discovery server has an incremented registeredServerCount");
            discoveryServer.registeredServerCount.should.equal(1);

            stepLog(
                "4.1 - And Then I should verify that the server application applicationUri can be found in the list of registered server"
            );
            {
                const data = await findServers(discoveryServerEndpointUrl);
                const { servers } = data;
                servers.length.should.eql(initialServerCount + 1);
                should(servers[1].applicationUri).eql(applicationUri);
            }

            stepLog("5. When the server shut down");
            await server.shutdown();

            stepLog("6. then I should verify that the the server has been unregistered");
            {
                const { servers } = await findServers(discoveryServerEndpointUrl);
                servers.length.should.eql(initialServerCount);
            }
            await pause(1000);
        });

        it("DISCO2-2 should re-register after discovery server outage", async () => {
            stepLog("1. Given a server that registers itself to the LDS");
            // #region
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl, port2, "DISCO2-2");
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
                foundServers.servers
                    .filter((s) => s.applicationUri === applicationUri)
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
                discoveryServer = await await makeDiscoveryServer(port_discovery, test);

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
                };

                stepLog("5. Wait for the server to automatically re-register");
                await waitUntilServerRenewRegistration();

                await waitUntilServerRenewRegistration();

                stepLog("6. Assert that the server is now discoverable again");
                foundServers = await findServers(discoveryServerEndpointUrl);
                foundServers.servers
                    .filter((s) => s.applicationUri === applicationUri)
                    .length.should.equal(1, "Server should have been be re-registered after outage");
            } finally {
                // Clean up
                await server.shutdown();
            }
            //
            await waitUntilCondition(
                async () => {
                    return discoveryServer.registeredServerCount === 0;
                },
                200000,
                ""
            );

            await pause(1000);

            await discoveryServer.shutdown();
        });

        it("DISCO2-3 should handle discovery server shutting down while server is trying to register", async () => {
            // 1. Given a Server that starts
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(
                discoveryServerEndpointUrl,
                port2,
                "for outage"
            );
            addServerCertificateToTrustedCertificateInDiscoveryServer(server, discoveryServer);

            // fast re-registering
            tweak_registerServerManager_timeout(server, 100);

            const promise = new Promise<void>((resolve, reject) => {
                server
                    .start()
                    .then(() => {
                        server.shutdown().finally(() => {
                            resolve();
                        });
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
            await pause(10);
            await discoveryServer.shutdown();
            await pause(1000);
            await promise; // ensure server is shut down
        });
        it("DISCO2-4 discovery server shutting down before registered server does should not cause issues", async () => {
            // 1. Given a server that registers itself to the LDS
            const server = await createServerThatRegistersItselfToTheDiscoveryServer(
                discoveryServerEndpointUrl,
                port2,
                "for outage"
            );
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

    describe("DISCO3 - DiscoveryServer3 - many server", function (this: Mocha.Suite) {
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
        });
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
                startAndWaitForRegisteredToLDS(server5)
            ];
            await Promise.all(tasks);
            registeredServerCount = 5;
        }

        async function stop_all_servers() {
            const tasks = [server1.shutdown(), server2.shutdown(), server3.shutdown(), server4.shutdown(), server5.shutdown()];
            await Promise.all(tasks);
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
            const { servers: serversBefore } = await findServers(discoveryServerEndpointUrl);
            const before = serversBefore.length;

            await start_all_servers();

            await wait_until_all_servers_registered(5);

            discoveryServer.registeredServerCount.should.equal(5);

            await pause(3000);

            const { servers } = await findServers(discoveryServerEndpointUrl);
            if (doDebug) {
                debugLog(
                    "------- findServersOnNetwork on ",
                    discoveryServerEndpointUrl,
                    "returned ",
                    servers.length,
                    "servers: here they are:"
                );
                for (const s of servers) {
                    debugLog(s.applicationUri, s.productUri, ApplicationType[s.applicationType], s.discoveryUrls?.[0]);
                }
            }
            servers.length.should.eql(5 + before); // 5 server + 1 discovery server

            // servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server");
            await pause(3000);
            {
                const servers = await findServersOnNetwork(discoveryServerEndpointUrl);
                if (servers?.length !== 6) {
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
                should(servers?.length).eql(
                    6,
                    "found " +
                        servers?.length +
                        " server running instead of 6: may be you have a LDS running on your system. please make sure to shut it down before running the tests"
                ); // 5 server + 1 discovery server
                // servers[1].applicationUri.should.eql("urn:NodeOPCUA-Server");
            }

            await stop_all_servers();
        });
    });
}
