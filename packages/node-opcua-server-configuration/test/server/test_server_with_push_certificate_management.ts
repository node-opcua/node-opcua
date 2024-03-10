// tslint:disable:no-console
import os from "os";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";
import { hostname } from "os";
import { types } from "util";
import chalk from "chalk";
import "should";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { ClientSession, makeApplicationUrn, OPCUAClient, UserIdentityInfoUserName } from "node-opcua-client";
import { makeRoles } from "node-opcua-address-space";
import {
    Certificate,
    convertPEMtoDER,
    exploreCertificate,
    exploreCertificateSigningRequest,
    makePrivateKeyThumbPrint,
    makeSHA1Thumbprint,
    PrivateKey,
    readCertificate,
    readPrivateKey,
    split_der,
    toPem2
} from "node-opcua-crypto";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import { OPCUAServer } from "node-opcua-server";
import { UserTokenType } from "node-opcua-types";
import { certificateMatchesPrivateKey } from "node-opcua-crypto";
import {
    initializeHelpers,
    produceCertificate,
    produceCertificateAndPrivateKey,
    _getFakeAuthorityCertificate
} from "../helpers/fake_certificate_authority";

import { installPushCertificateManagementOnServer } from "../..";
import { ClientPushCertificateManagement } from "../..";

import { OPCUAServerPartial } from "../../source";
const { readFile } = fs.promises;

const port = 20101;

const doDebug = checkDebugFlag("ServerConfiguration");
const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");

// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing server configured with push certificate management", () => {
    let _folder: string;

    let clientCertificateFile = "";
    let clientPrivateKeyFile = "";

    let certificateManager: OPCUACertificateManager;
    let clientCertificateManager: OPCUACertificateManager;

    before(async () => {
        _folder = await initializeHelpers("CC", 2);

        const fakeClientPKI = path.join(_folder, "FakeClientPKI");
        if (!fs.existsSync(fakeClientPKI)) {
            fs.mkdirSync(fakeClientPKI);
        }
        clientCertificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: fakeClientPKI
        });

        await clientCertificateManager.initialize();

        const fakePKI = path.join(_folder, "FakePKI");
        if (!fs.existsSync(fakePKI)) {
            fs.mkdirSync(fakePKI);
        }
        certificateManager = new OPCUACertificateManager({
            rootFolder: fakePKI
        });
        await certificateManager.initialize();

        clientCertificateFile = path.join(clientCertificateManager.rootDir, "own/certs/certificate.pem");
        // recreate certificate every time ! ( short date)
        await clientCertificateManager.createSelfSignedCertificate({
            applicationUri: makeApplicationUrn(hostname(), "NodeOPCUA-Client"),

            subject: "CN=Test",

            dns: [os.hostname()],
            ip: [],

            startDate: new Date(),
            validity: 12,

            outputFile: clientCertificateFile
        });
        clientPrivateKeyFile = clientCertificateManager.privateKey;

        // make sure that CA Certificate and revocation list are trusted in clientCertificateManager
        {
            const { certificate, crl } = await _getFakeAuthorityCertificate(_folder);
            clientCertificateManager.addIssuer(certificate);
            clientCertificateManager.addRevocationList(crl);
        }
    });

    after(async () => {
        await certificateManager.dispose();
        await clientCertificateManager.dispose();
    });

    it("SCT-1 should modify a server to support push certificate management", async () => {
        const server = new OPCUAServer({
            port,
            serverCertificateManager: certificateManager,
            userCertificateManager: certificateManager
        });

        await server.initialize();

        await installPushCertificateManagementOnServer(server);

        const privateKey1 = readPrivateKey(server.serverCertificateManager.privateKey);
        const privateKey2 = server.getPrivateKey();

        toPem2(privateKey1, "RSA PRIVATE KEY").should.eql(toPem2(privateKey2, "RSA PRIVATE KEY"));

        // now start the server
        await server.start();

        // now stop the server
        await server.shutdown();
    });

    function verifyServer(server: OPCUAServer) {
        debugLog("---------------------------------------------------------------");
        const certificateChain1 = server.getCertificateChain();
        debugLog(
            "server.getCertificateChain() =",
            makeSHA1Thumbprint(certificateChain1).toString("hex") + " l=" + certificateChain1.length
        );
        const privateKey1 = server.getPrivateKey();
        debugLog("server.getPrivateKey()       =", makePrivateKeyThumbPrint(privateKey1).toString("hex"));

        const match = certificateMatchesPrivateKey(certificateChain1, privateKey1);
        debugLog("math                         =", match);

        for (const endpoint of server.endpoints) {
            debugLog("endpoint ", endpoint.toString());

            for (const e of endpoint.endpointDescriptions()) {
                const certificateChain3 = e.serverCertificate;
                debugLog(
                    "endpoint certificate =",
                    makeSHA1Thumbprint(certificateChain3).toString("hex") + " l=" + certificateChain3.length
                );
                // xx console.log(e.toString());
            }
        }
        debugLog("---------------------------------------------------------------");
    }

    async function replaceServerCertificateUsingPushCertificateManagerMethod(endpointUrl: string): Promise<Certificate> {
        const client = OPCUAClient.create({
            clientCertificateManager,

            certificateFile: clientCertificateFile,

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });

        try {
            await client.connect(endpointUrl);

            const userIdentityToken: UserIdentityInfoUserName = {
                type: UserTokenType.UserName,

                password: (() => "secret")(),
                userName: "admin"
            };

            const session = await client.createSession(userIdentityToken);

            const pm = new ClientPushCertificateManagement(session);

            const response = await pm.createSigningRequest("DefaultApplicationGroup", NodeId.nullNodeId, "CN=MyApplication");

            debugLog(" cert request status", response.statusCode.toString());
            if (response.statusCode.isNotGood()) {
                throw new Error("Cannot get signing request from server : " + response.statusCode.toString());
            }
            debugLog(" cert signing request       ", response.certificateSigningRequest!.toString("base64"));
            const info = exploreCertificateSigningRequest(response.certificateSigningRequest!);
            debugLog(JSON.stringify(info, null, " "));

            const certificateFull = await produceCertificate(_folder, response.certificateSigningRequest!);

            const certificateChain = split_der(certificateFull);
            const certificate = certificateChain[0];
            const issuerCertificates = certificateChain.slice(1);

            // generate some certificate
            const response2 = await pm.updateCertificate(
                "DefaultApplicationGroup",
                NodeId.nullNodeId,
                certificate,
                issuerCertificates
            );
            debugLog(" updateCertificate  status", response2.statusCode.toString());
            if (response2.statusCode.isNotGood()) {
                throw new Error("Cannot updateCertificate " + response2.statusCode.toString());
            }

            await pm.applyChanges();

            await session.close();

            return certificateFull;
        } catch (err) {
            console.log("err =", err);
            throw err;
        } finally {
            await client.disconnect();
        }
    }

    async function withSecureClient<T>(endpointUrl: string, func: (session: ClientSession) => Promise<T>) {
        const client = OPCUAClient.create({
            clientCertificateManager,

            certificateFile: clientCertificateFile,

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });

        try {
            await client.connect(endpointUrl);

            const userIdentityToken: UserIdentityInfoUserName = {
                type: UserTokenType.UserName,
                password: (() => "secret")(),
                userName: "admin"
            };

            const session = await client.createSession(userIdentityToken);

            try {
                return await func(session);
            } catch (err) {
                console.log("err =", err);
                throw err;
            } finally {
                await session.close();
            }
        } catch (err) {
            console.log("err =", err);
            throw err;
        } finally {
            await client.disconnect();
        }
    }

    async function replaceServerCertificateAndPrivateKeyUsingPushCertificateManagerMethod(
        endpointUrl: string
    ): Promise<{ certificate: Certificate; privateKey: PrivateKey }> {
        // create a new key pair
        const { certificate, privateKey, privateKeyPEM } = await produceCertificateAndPrivateKey(_folder);

        const privateKeyFormat = "PEM"; // or PFX

        await withSecureClient(endpointUrl, async (session: ClientSession) => {
            const pm = new ClientPushCertificateManagement(session);

            const issuerCertificates: Certificate[] = [];
            // generate some certificate
            const response2 = await pm.updateCertificate(
                "DefaultApplicationGroup",
                NodeId.nullNodeId,
                certificate,
                issuerCertificates,
                privateKeyFormat,
                privateKeyPEM
            );
            debugLog(" updateCertificate  status", response2.statusCode.toString());

            if (response2.statusCode.isGood()) {
                await pm.applyChanges();
            }
            if (response2.statusCode.isNotGood()) {
                throw new Error("Cannot updateCertificate " + response2.statusCode.toString());
            }
        });
        return { certificate, privateKey };
    }

    async function createSigningRequestAndNewPrivateKey(endpointUrl: string): Promise<{ certificate: Certificate }> {
        return await withSecureClient(endpointUrl, async (session: ClientSession) => {
            const pm = new ClientPushCertificateManagement(session);

            const response = await pm.createSigningRequest(
                "DefaultApplicationGroup",
                NodeId.nullNodeId,
                null,
                true,
                randomBytes(32)
            );

            debugLog(" cert request status", response.statusCode.toString());
            if (response.statusCode.isNotGood()) {
                throw new Error("Cannot get signing request from server : " + response.statusCode.toString());
            }
            debugLog(" cert signing request       ", response.certificateSigningRequest!.toString("base64"));
            const info = exploreCertificateSigningRequest(response.certificateSigningRequest!);
            debugLog(JSON.stringify(info, null, " "));

            const certificateFull = await produceCertificate(_folder, response.certificateSigningRequest!);

            const certificateChain = split_der(certificateFull);
            const certificate = certificateChain[0];
            const issuerCertificates = certificateChain.slice(1);

            // generate some certificate
            const response2 = await pm.updateCertificate(
                "DefaultApplicationGroup",
                NodeId.nullNodeId,
                certificate,
                issuerCertificates
            );
            debugLog(" updateCertificate  status", response2.statusCode.toString());
            if (response2.statusCode.isNotGood()) {
                throw new Error("Cannot updateCertificate " + response2.statusCode.toString());
            }

            await pm.applyChanges();

            return { certificate };
        });
    }

    async function constructServerWithPushCertificate(): Promise<OPCUAServer> {
        // given that the server user manager is able to identify a  system administrator
        const mockUserManager = {
            isValidUser: (userName: string, password: string) => {
                if (userName === "admin" && password === "secret") {
                    return true;
                }
                return false;
            },

            // see OPCUA 1.04 part 3 4.8.2 Well know role
            // Anonymous          The Role has very limited access for use when a Session has anonymous credentials.
            // AuthenticatedUser  The Role has limited access for use when a Session has valid non-anonymous credentials
            //                    but has not been explicitly granted access to a Role.
            // Observer           The Role is allowed to browse, read live data, read historical data/events or subscribe to
            //                    data/events.
            // Operator           The Role is allowed to browse, read live data, read historical data/events or subscribe to
            //                    data/events.
            //                    In addition, the Session is allowed to write some live data and call some Methods.
            // Engineer           The Role is allowed to browse, read/write configuration data, read historical data/events,
            //                    call Methods or subscribe to data/events.
            // Supervisor         The Role is allowed to browse, read live data, read historical data/events, call Methods
            //                    or subscribe to data/events.
            // ConfigureAdmin     The Role is allowed to change the non-security related configuration settings.
            // SecurityAdmin      The Role is allowed to change security related settings.

            getUserRoles(username: string): NodeId[] {
                if (username === "anonymous") {
                    return makeRoles("Anonymous");
                }
                if (username === "admin") {
                    return makeRoles("AuthenticatedUser;SecurityAdmin");
                }
                return makeRoles("Anonymous");
            }
        };

        const server = new OPCUAServer({
            port,

            nodeset_filename: nodesets.standard,
            userManager: mockUserManager,

            serverCertificateManager: certificateManager,
            userCertificateManager: certificateManager
        });
        await server.initialize();

        verifyServer(server);

        await installPushCertificateManagementOnServer(server);
        debugLog("private key location =  ", server.serverCertificateManager.privateKey);

        verifyServer(server);

        // Given that the server is configured to trust client certificate
        const clientCertificatePEM = await readFile(clientCertificateFile, "utf8");
        const clientCertificateDER = convertPEMtoDER(clientCertificatePEM);
        await server.serverCertificateManager.trustCertificate(clientCertificateDER);

        // also trusted newest certificate

        return server;
    }

    let onGoingClient: OPCUAClient;
    let onGoingSession: ClientSession;
    let count = 0;

    async function testWithSimpleClient(endpointUri: string) {
        const client = OPCUAClient.create({
            clientCertificateManager,

            certificateFile: clientCertificateFile,

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });
        try {
            await client.connect(endpointUri);
            const session = await client.createSession();

            await session.close();
        } catch (err) {
            if (types.isNativeError(err)) {
                errorLog("Cannot reconnect a client !!!! ", err.message, "\n", err);
            }
        } finally {
            await client.disconnect();
        }
    }

    async function startOnGoingConnection(endpointUri: string) {
        onGoingClient = OPCUAClient.create({
            clientCertificateManager,

            certificateFile: clientCertificateFile,

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });
        onGoingClient.on("start_reconnection", () => {
            debugLog(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  Starting Reconnection !!!!!!!!!!!!!!!!!!!"));
        });
        onGoingClient.on("backoff", (retry: number, delay: number) => {
            debugLog(chalk.bgWhite.yellow("backoff  attempt #"), retry, " retrying in ", delay / 1000.0, " seconds");
        });
        onGoingClient.on("connection_reestablished", () => {
            debugLog(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
            debugLog("    Server certificate is now ", makeSHA1Thumbprint(onGoingClient.serverCertificate!).toString("hex"));
        });
        onGoingClient.on("connection_lost", () => {
            debugLog(chalk.bgWhite.red("Client has lost connection ..."));
            debugLog(
                chalk.bgWhite.red(
                    "    Server certificate was ",
                    makeSHA1Thumbprint(onGoingClient.serverCertificate!).toString("hex")
                )
            );
        });

        onGoingClient.on("close", () => {
            debugLog(chalk.bgWhite.red("client has closed the connection"));
        });

        await onGoingClient.connect(endpointUri);
        onGoingSession = await onGoingClient.createSession();

        const subscription = await onGoingSession.createSubscription2({
            requestedPublishingInterval: 500,

            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10
        });

        const monitoredItem = await subscription.monitor(
            {
                attributeId: AttributeIds.Value,
                nodeId: "i=2258" // Current Time
            },
            { samplingInterval: 500 },
            TimestampsToReturn.Both
        );

        count = 0;
        monitoredItem.on("changed", (dataValue: DataValue) => {
            debugLog(" ", chalk.cyan(dataValue.value.toString()));
            count++;
        });

        await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    async function stopOnGoingConnection() {
        debugLog("stopping");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        debugLog(
            "stopOnGoingConnection - Server certificate is now ",
            makeSHA1Thumbprint(onGoingClient.serverCertificate!).toString("hex")
        );
        await onGoingSession.close();
        await onGoingClient.disconnect();
    }

    function step(title: string) {
        if (doDebug) {
            console.log("-------------------- " + title);
        }
    }
    it("SCT-2 should be possible to change the certificate of a server that supports push certificate ", async () => {
        step("Given a server with push management");
        const server = await constructServerWithPushCertificate();

        step("Given that the server is started");
        await server.start();

        step("Given that we known the server key pair before it is changed");
        const privateKey1PEM = await readFile(server.serverCertificateManager.privateKey, "utf8");
        const certificateBefore = server.getCertificate();

        const d1 = exploreCertificate(certificateBefore);
        debugLog(d1);

        step("Given the server connection endpoint");
        const endpointUrl = server.getEndpointUrl()!;

        step("Given that the sever has some client connected to it");
        await startOnGoingConnection(endpointUrl);

        try {
            step("when an administrative client replaces the certificate");
            const newCertificate = await replaceServerCertificateUsingPushCertificateManagerMethod(endpointUrl);

            step("then I should verify that the server certificate has changed");
            const certificateAfter = server.getCertificate();
            certificateBefore.toString("base64").should.not.eql(certificateAfter.toString("base64"));

            step("I should also verify that the same certificate is given by the certificateFile property ");
            const certificateBefore2 = readCertificate(server.certificateFile);
            certificateBefore2.toString("base64").should.not.eql(certificateBefore.toString("base64"));

            step("I should also verify that the new certificate matches the server private key");
            certificateMatchesPrivateKey(certificateAfter, server.getPrivateKey()).should.eql(true);

            const d2 = exploreCertificate(certificateBefore2);
            debugLog(d2);

            step("and I should verify that the new server certificate matches the new certificate provided by the admin client");
            certificateAfter.toString("base64").should.not.eql(newCertificate.toString("base64"));

            await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (err) {
            console.log(err);
            throw err;
        } finally {
            await stopOnGoingConnection();
            // now stop the server
            await server.shutdown();
        }
    });

    async function simulateCertificateAndPrivateKeyChange(server: OPCUAServer) {
        const _server = server as any as OPCUAServerPartial;

        // create a new key pair
        const { certificate, privateKey } = await produceCertificateAndPrivateKey(_folder);

        _server.$$privateKey = privateKey;
        _server.$$certificateChain = certificate;
        _server.$$certificate = split_der(certificate)[0];
        await server.suspendEndPoints();
        await server.shutdownChannels();
        await server.resumeEndPoints();
    }

    it("SCT-3 - Client reconnection should work if server changes its private key", async () => {
        step("Given a server with push management");
        const server = await constructServerWithPushCertificate();
        step("Given that the server is started");
        await server.start();

        step("Given the server connection endpoint");
        const endpointUrl = server.getEndpointUrl()!;

        step("Given a connected client");
        const client = OPCUAClient.create({
            clientCertificateManager,

            certificateFile: clientCertificateFile,

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });

        client.on("start_reconnection", () => {
            debugLog(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  Starting Reconnection !!!!!!!!!!!!!!!!!!!"));
        });
        client.on("backoff", (retry: number, delay: number) => {
            debugLog(chalk.bgWhite.yellow("backoff  attempt #"), retry, " retrying in ", delay / 1000.0, " seconds");
        });
        client.on("connection_reestablished", () => {
            debugLog(chalk.bgWhite.red(" !!!!!!!!!!!!!!!!!!!!!!!!  CONNECTION RE-ESTABLISHED !!!!!!!!!!!!!!!!!!!"));
            debugLog("    Server certificate is now ", makeSHA1Thumbprint(client.serverCertificate!).toString("hex"));
        });
        client.on("connection_lost", () => {
            debugLog(chalk.bgWhite.red("Client has lost connection ..."));
            debugLog(
                chalk.bgWhite.red("    Server certificate was ", makeSHA1Thumbprint(client.serverCertificate!).toString("hex"))
            );
        });
        client.on("close", () => {
            debugLog(chalk.bgWhite.red("Client has closed the connection"));
        });

        await client.connect(endpointUrl);

        step("When Server changes certificates");
        const certificateBefore: Certificate = server.getCertificate();
        const privateKeyBefore = server.getPrivateKey();

        await simulateCertificateAndPrivateKeyChange(server);

        const certificateAfter: Certificate = server.getCertificate();
        const privateKeyAfter = server.getPrivateKey();

        makeSHA1Thumbprint(certificateBefore).should.not.eql(makeSHA1Thumbprint(certificateAfter));
        toPem2(privateKeyBefore, "RSA PRIVATE KEY").should.not.eql(toPem2(privateKeyAfter, "RSA PRIVATE KEY"));

        step("then I should see the client being reconnected");
        await new Promise((resolve) => setTimeout(resolve, 6000));

        client.isReconnecting.should.eql(false);

        // Tear down
        await client.disconnect();
        // now stop the server
        await server.shutdown();
    });

    it("SCT-4 should be possible to change the certificate and private key of the server", async () => {
        step("Given a server with push management");
        const server = await constructServerWithPushCertificate();

        step("Given that we known the server key pair before it is changed");
        const privateKey1PEM = await readFile(server.serverCertificateManager.privateKey, "utf8");
        const certificateBefore = server.getCertificate();
        const privateKeyBefore = server.getPrivateKey();

        step("Given that the server is started");
        await server.start();

        step("Given the server connection endpoint");
        const endpointUrl = server.getEndpointUrl()!;

        step("Given that the sever has some client connected to it");
        await startOnGoingConnection(endpointUrl);

        try {
            step("when an administrative client replaces the certificate & private key");
            const { certificate, privateKey } =
                await replaceServerCertificateAndPrivateKeyUsingPushCertificateManagerMethod(endpointUrl);

            step("then I should verify that the server certificate has changed");
            const certificateAfter = server.getCertificate();
            certificateBefore.toString("base64").should.not.eql(certificateAfter.toString("base64"));

            step("and I should verify that the new server certificate matches the new certificate provided by the admin client");
            certificateAfter.toString("base64").should.eql(certificate.toString("base64"));

            step("then I should verify that the server private key has changed");
            const privateKeyAfter = server.getPrivateKey();
            toPem2(privateKeyBefore, "RSA PRIVATE KEY").should.not.eql(toPem2(privateKeyAfter, "RSA PRIVATE KEY"));

            step("and I should verify that the new server private key matches the new private key provided by the admin client");
            toPem2(privateKeyAfter, "RSA PRIVATE KEY").should.eql(toPem2(privateKey, "RSA PRIVATE KEY"));

            if (!certificateMatchesPrivateKey(certificateAfter, privateKey)) {
                throw new Error("The new certificate doesn't match with the new private key");
            }

            await new Promise((resolve) => setTimeout(resolve, 3000));

            await testWithSimpleClient(endpointUrl);

            await new Promise((resolve) => setTimeout(resolve, 500));
            onGoingClient.isReconnecting.should.eql(false, "client shall not be reconnecting anymore");
        } catch (err) {
            errorLog("---------------------------------------------- ERROR ! in Test ");
            errorLog(err);
            throw err;
        } finally {
            await stopOnGoingConnection();
            // now stop the server
            await server.shutdown();
        }
    });

    it("SCT-5 create signing request and regnerate private key", async () => {
        step("Given a server with push management");
        const server = await constructServerWithPushCertificate();

        step("Given that we known the server key pair before it is changed");
        const privateKey1PEM = await readFile(server.serverCertificateManager.privateKey, "utf8");
        const certificateBefore = server.getCertificate();
        const privateKeyBefore = server.getPrivateKey();
        step("Given that the server is started");
        await server.start();

        step("Given the server connection endpoint");
        const endpointUrl = server.getEndpointUrl()!;

        step("Given that the sever has some client connected to it");
        await startOnGoingConnection(endpointUrl);

        try {
            step("when an administrative client replaces the certificate & private key");
            const { certificate } = await createSigningRequestAndNewPrivateKey(endpointUrl);

            step("then I should verify that the server certificate has changed");
            const certificateAfter = server.getCertificate();
            certificateBefore.toString("base64").should.not.eql(certificateAfter.toString("base64"));

            step("and I should verify that the new server certificate matches the new certificate provided by the admin client");
            certificateAfter.toString("base64").should.eql(certificate.toString("base64"));

            step("then I should verify that the server private key has changed");
            const privateKeyAfter = server.getPrivateKey();
            toPem2(privateKeyBefore, "RSA PRIVATE KEY").should.not.eql(toPem2(privateKeyAfter, "RSA PRIVATE KEY"));

            await new Promise((resolve) => setTimeout(resolve, 3000));

            await testWithSimpleClient(endpointUrl);

            onGoingClient.isReconnecting.should.eql(false, "client shall not be reconnected");
        } catch (err) {
            errorLog("---------------------------------------------- ERROR ! in Test ");
            errorLog(err);
            throw err;
        } finally {
            await stopOnGoingConnection();
            // now stop the server
            await server.shutdown();
        }
    });
});
