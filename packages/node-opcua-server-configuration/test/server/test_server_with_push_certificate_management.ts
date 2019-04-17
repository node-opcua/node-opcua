// tslint:disable:no-console
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import { should } from "should";

import {
    OPCUACertificateManager
} from "node-opcua-certificate-manager";
import {
    ClientSession,
    OPCUAClient,
    UserIdentityInfoUserName
} from "node-opcua-client";
import {
    Certificate,
    convertPEMtoDER,
    makeSHA1Thumbprint,
    split_der
} from "node-opcua-crypto";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, TimestampsToReturn } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { MessageSecurityMode, SecurityPolicy } from "node-opcua-secure-channel";
import {
    OPCUAServer, OPCUAServerEndPoint
} from "node-opcua-server";
import { StatusCodes } from "node-opcua-status-code";
import { UserTokenType } from "node-opcua-types";

import { _tempFolder, produceCertificate } from "../helpers/fake_certificate_authority";

import { installPushCertificateManagementOnServer } from "../..";
import { ClientPushCertificateManagement } from "../..";
import { certificateMatchesPrivateKey } from "../..";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing server configured with push certificate management", () => {

    const fakePKI = path.join(_tempFolder, "FakePKI");
    const certificateManager = new OPCUACertificateManager({
        rootFolder: fakePKI
    });

    const fakeClientPKI = path.join(_tempFolder, "FakeClientPKI");
    const clientCertificateManager = new OPCUACertificateManager({
        rootFolder: fakeClientPKI
    });
    let clientCertificateFile = "";
    let clientPrivateKeyFile = "";

    before(async () => {
        await certificateManager.initialize();
    });
    before(async () => {
        await clientCertificateManager.initialize();
        clientCertificateFile = path.join(clientCertificateManager.rootDir, "certificate.pem");
        await clientCertificateManager.createSelfSignedCertificate({
            applicationUri: "ClientApplication",
            subject: "CN=Test",

            dns: [os.hostname()],
            ip: [],

            startDate: new Date(),
            validity: 10,

            outputFile: clientCertificateFile
        });
        clientPrivateKeyFile = clientCertificateManager.privateKey;
    });

    it("should modify a server to support push certificate management", async () => {

        const server = new OPCUAServer({
            serverCertificateManager: certificateManager,
            userCertificateManager: certificateManager
        });

        await server.initialize();

        await installPushCertificateManagementOnServer(server);

        const privateKey1PEM = await promisify(fs.readFile)(server.serverCertificateManager.privateKey, "utf8");
        const privateKey1 = convertPEMtoDER(privateKey1PEM);
        const privateKey2 = convertPEMtoDER(server.getPrivateKey());
        privateKey1.toString("base64").should.eql(privateKey2.toString("base64"));

        // now start the server
        await server.start();

        // now stop the server
        await server.shutdown();
    });

    function verifyServer(server: OPCUAServer) {

        console.log("---------------------------------------------------------------");
        const certificateChain1 = server.getCertificateChain();
        console.log("server.getCertificateChain() =",
          makeSHA1Thumbprint(certificateChain1).toString("hex") + " l=" + certificateChain1.length);
        const privateKey1 = convertPEMtoDER(server.getPrivateKey());
        console.log("server.getPrivateKey()       =",
          makeSHA1Thumbprint(privateKey1).toString("hex"));

        const match = certificateMatchesPrivateKey(certificateChain1, privateKey1);
        console.log("math                         =", match);

        for (const endpoint of server.endpoints) {
            console.log("endpoint ", endpoint.toString());

            for (const e of endpoint.endpointDescriptions()) {
                const certificateChain3 = e.serverCertificate;
                console.log("endpont certificate =",
                  makeSHA1Thumbprint(certificateChain3).toString("hex") + " l=" + certificateChain3.length);
                // xx console.log(e.toString());
            }

        }
        console.log("---------------------------------------------------------------");

    }

    async function replaceServerCertificateUsingPushCertificateManagerMethod(endpointUrl: string): Promise<Certificate> {

        const client = OPCUAClient.create({
            certificateFile: clientCertificateFile,
            privateKeyFile: clientPrivateKeyFile,

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256

        });

        try {

            await client.connect(endpointUrl);

            const userIdentityToken: UserIdentityInfoUserName = {
                type: UserTokenType.UserName,

                password: "secret",
                userName: "admin"
            };

            const session = await client.createSession(userIdentityToken);

            const pm = new ClientPushCertificateManagement(session);

            const response = await pm.createSigningRequest(
              "DefaultApplicationGroup",
              NodeId.nullNodeId,
              "CN=MyApplication");

            debugLog(" cert request status",
              response.statusCode.toString());
            if (response.statusCode !== StatusCodes.Good) {
                throw new Error("Cannot get signing request from server");
            }
            debugLog(" cert request       ",
              response.certificateSigningRequest!.toString("base64"));

            const certificateFull = await produceCertificate(response.certificateSigningRequest!);

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
            if (response2.statusCode !== StatusCodes.Good) {
                throw new Error("Cannot updateCertificate ");
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

            getUserRole(username: string): string {
                if (username === "anonymous") {
                    return "Anonymous";
                }
                if (username === "admin") {
                    return "AuthenticatedUser;SecurityAdmin";
                }
                return "None";
            }

        };

        const server = new OPCUAServer({
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
        const clientCertificatePEM = await promisify(fs.readFile)(clientCertificateFile, "utf8");
        const clientCertificateDER = convertPEMtoDER(clientCertificatePEM);
        await server.serverCertificateManager.trustCertificate(clientCertificateDER);

        // also trusted newest certificate

        return server;
    }

    let onGoingClient: OPCUAClient;
    let onGoingSession: ClientSession;

    async function startOnGoingConnection(endpointUri: string) {
        onGoingClient = OPCUAClient.create({
            certificateFile: clientCertificateFile,
            privateKeyFile: clientPrivateKeyFile,

            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256
        });

        onGoingClient.on("connection_lost", () => {
            console.log("Client has lost connection ");
            console.log("Server certificate was ", makeSHA1Thumbprint(onGoingClient.serverCertificate!).toString("base64"));
        });

        onGoingClient.on("connection_reestablished", () => {
            console.log("Client has re-established connection ");
            console.log("Server certificate is now ", makeSHA1Thumbprint(onGoingClient.serverCertificate!).toString("base64"));
        });

        await onGoingClient.connect(endpointUri);
        onGoingSession = await onGoingClient.createSession();

        const subscription = await onGoingSession.createSubscription2({
            requestedPublishingInterval: 100,

            maxNotificationsPerPublish: 1000,
            publishingEnabled: true,
            requestedLifetimeCount: 100,
            requestedMaxKeepAliveCount: 10
        });

        const monitoredItem = await subscription.monitor({
              attributeId: AttributeIds.Value,
              nodeId: "i=2258" // Current Time
          },
          { samplingInterval: 100 }, TimestampsToReturn.Both);

        monitoredItem.on("changed", (dataValue: DataValue) => {
            console.log(" ", dataValue.value.toString());
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

    }

    async function stopOnGoingConnection() {

        await new Promise((resolve) => setTimeout(resolve, 5000));
        debugLog("stopOnGoingConnection - Server certificate is now ", onGoingClient.serverCertificate!.toString("base64"));
        await onGoingSession.close();
        await onGoingClient.disconnect();
    }

    it("should be possible to change the certificate of a server that supports push certificate ", async () => {

        // Given a server with push management
        const server = await constructServerWithPushCertificate();

        // Given that we known the server key pair before it is changed
        const privateKey1PEM = await promisify(fs.readFile)(server.serverCertificateManager.privateKey, "utf8");
        const certificateBefore = server.getCertificate();

        // Given the server connection endpoint
        const endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl!;

        // Given that the server is started
        await server.start();

        // Given that the sever has some client connected to it
        await startOnGoingConnection(endpointUrl);

        try {

            // when an administrative client replaces the certificate
            const newCertificate = await replaceServerCertificateUsingPushCertificateManagerMethod(endpointUrl);

            // then I should verify that the server certificate has changed
            const certificateAfter = server.getCertificate();
            certificateBefore.toString("base64").should.not.eql(certificateAfter.toString("base64"));

            // and I should verify that the new server certificate matches the new certificate provided by the admin client
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
});
