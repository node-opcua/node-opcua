// test issue 985
//

import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import "should";

import {
    nodesets,
    get_mini_nodeset_filename,
    OPCUACertificateManager,
    OPCUAServer,
    WellKnownRoles,
    OPCUAClient,
    UserTokenType,
    AttributeIds,
    MessageSecurityMode,
    SecurityPolicy,
    ClientSession,
    StatusCode,
    hexDump,
    ActivateSessionRequest,
    UserNameIdentityToken,
    UserIdentityToken,
    UserIdentityInfo,
    UserIdentityInfoX509,
} from "node-opcua";
import { readCertificate, readPrivateKey, readPrivateKeyPEM } from "node-opcua-crypto";
import should = require("should");


const doDebug = !!process.env.DEBUG;
// Given an established secure connection between a client and server
// Given a userName/password session.
//
// When the server stops, change it private key and certificate
//
// Then the sever should not crash when the client
// re-establish the connection.
//
async function pause(duration: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, duration));
}

const users = [
    { username: "user1", password: "1", role: [WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin].join(";") },
    { username: "user2", password: "2", role: [WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator].join(";") }
];

const certificateFolder = path.join(__dirname, "../../../node-opcua-samples/certificates");
fs.existsSync(certificateFolder).should.eql(true, "expecting certificate store at " + certificateFolder);

// simplistic user manager for test purpose only ( do not use in production !)
const userManager = {
    isValidUser: function (username: string, password: string) {
        const uIndex = users.findIndex(function (u) {
            return u.username === username;
        });
        if (uIndex < 0) {
            return false;
        }
        if (users[uIndex].password !== password) {
            return false;
        }
        return true;
    },

    getUserRole: function (username: string) {
        const uIndex = users.findIndex((x) => x.username === username);
        if (uIndex < 0) {
            return "";
        }
        const userRole = users[uIndex].role;
        return userRole;
    }
};

async function waitForDisconnection(session: ClientSession): Promise<void> {
    if (!session.isReconnecting) {
        await pause(1000);
        return await waitForDisconnection(session);
    }
}

async function waitForReconnection(session: ClientSession): Promise<void> {
    if (session.isReconnecting) {
        await pause(1000);
        return await waitForReconnection(session);
    }
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("test reconnection when server stops and change it privateKey and certificate then restart", function (this: any) {
    this.timeout(120 * 1000);

    const port = 2565;

    async function startServer() {
        const randomSeed = crypto.randomBytes(16).toString("hex");
        const rootFolder = path.join(os.tmpdir(), randomSeed);
        const serverCertificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder
        });

        await serverCertificateManager.initialize();

        const server = new OPCUAServer({
            port,
            serverCertificateManager,
            userManager,
            nodeset_filename: [get_mini_nodeset_filename()]
        });

        server.on("request", (request) => {
            if (request instanceof ActivateSessionRequest) {
                const a = request as ActivateSessionRequest;
                if (a.userIdentityToken && a.userIdentityToken instanceof UserNameIdentityToken) {
                    if (doDebug) {
                        console.log("password = ", hexDump(a.userIdentityToken.password));
                    }
                }
            }
        });
        await server.initialize();
        await server.start();
        return server;
    }
    async function createClient(
        endpointUrl: string,
        securityPolicy: SecurityPolicy,
        securityMode: MessageSecurityMode,
        sessionTimeout: number
    ) {
        const client = OPCUAClient.create({
            securityPolicy,
            securityMode,
            requestedSessionTimeout: sessionTimeout
        });

        await client.connect(endpointUrl);

        client.on("after_reconnection", () => {
            console.log("After Reconnection");
        });
        client.on("backoff", () => {
            console.log("Backoff isReconnecting = ", client.isReconnecting);
        });

        client.on("reconnection_attempt_has_failed", () => {
            console.log("reconnection_attempt_has_failed");
        });

        client.on("connection_lost", () => {
            console.log("connection_lost");
        });

        client.on("connection_reestablished", () => {
            console.log("connection_reestablished");
        });
        const session = await client.createSession({
            type: UserTokenType.UserName,
            userName: "user1",
            password: "1"
        });
        session.on("session_closed", (statusCode: StatusCode) => {
            console.log("Session Closed =>", statusCode.toString());
        });
        session.on("session_repaired", () => {
            console.log("session_repaired");
        });
        console.log("session timeout", session.timeout);

        return { client, session };
    }
    async function test(
        securityPolicy: SecurityPolicy,
        securityMode: MessageSecurityMode,
        sessionTimeout: number,
        waitDuration: number
    ) {
        let server = await startServer();

        const endpointUrl = server.getEndpointUrl();

        const { client, session } = await createClient(endpointUrl, securityPolicy, securityMode, sessionTimeout);

        try {
            const privateKeyBefore = readPrivateKey(server.privateKeyFile).toString("hex");

            await server.shutdown();

            await waitForDisconnection(session);

            await pause(waitDuration);
            console.log("restarting server");
            server = await startServer();

            const privateKeyAfter = readPrivateKey(server.privateKeyFile).toString("hex");
            privateKeyAfter.should.not.eql(privateKeyBefore);

            await waitForReconnection(session);

            console.log(" Client should now be reconnected");

            const dataValue = await session.read({ nodeId: "i=2258", attributeId: AttributeIds.Value });

            console.log(dataValue.toString());
        } catch (err) {
            console.log(err);
        } finally {
            await session.close();
            await client.disconnect();
            await server.shutdown();
        }
    }
    it("T1- server should not crash when client re-establishes the connection - encrypted", async () => {
        await test(SecurityPolicy.Basic256Sha256, MessageSecurityMode.SignAndEncrypt, 10000, 1000);
    });
    it("T2- server should not crash when client re-establishes the connection - clear", async () => {
        await test(SecurityPolicy.None, MessageSecurityMode.None, 10000, 1000);
    });

    it("T3- server should not crash when client re-establishes the connection - clear - session timeout", async () => {
        await test(SecurityPolicy.None, MessageSecurityMode.None, 500, 5000);
    });

    it("T4 - server shall not crash if password is wrongly encrypted by client in ActivateSession", async () => {

        let server = await startServer();

        const endpointUrl = server.getEndpointUrl();


        const wrongServerCertificateFile = path.join(certificateFolder, "discoveryServer_key_1024.pem");
        const wrongServerCertificate = readCertificate(wrongServerCertificateFile);
        // --- create a client that has a wrong serverCertificate
        const client = OPCUAClient.create({
            serverCertificate: wrongServerCertificate
        });

        await client.connect(endpointUrl);

        client.serverCertificate!.should.eql(wrongServerCertificate);

        let _capturedError: Error | undefined = undefined;
        try {
            const session = await client.createSession({
                type: UserTokenType.UserName,
                userName: "user1",
                password: "1"
            });
            await session.close();

        } catch (err) {
            _capturedError = err;
            console.log(_capturedError!.message)
        } finally {
            await client.disconnect();

            await server.shutdown();

        }
        //in this case it should work as the correct certificate has been received from the CreateSessionResponse
        should.not.exist(_capturedError, "expecting no error here");
        _capturedError?.message.should.match(/BadUserAccessDenied/);

    });
    it("T5 - server shall not crash if password is wrongly encrypted by client in ActivateSession", async () => {

        let server = await startServer();

        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({});

        await client.connect(endpointUrl);


        const p = (client as any).createUserIdentityToken;

        let hacked = false;
        (client as any).createUserIdentityToken = function (
            this: any,
            context: any,
            userIdentityInfo: UserIdentityInfo,
            callback: (err: Error | null, data?: any/*TokenAndSignature*/) => void
        ) {


            p.call(this, context, userIdentityInfo, (err: Error | null, data: any) => {

                if (data) {

                    if (userIdentityInfo.type === UserTokenType.UserName) {
                        console.log("Hacking with the password token");
                        const userIdentityToken: UserNameIdentityToken = data.userIdentityToken!;
                        const userTokenSignature: any /*SignatureDataOptions */ = data.userTokenSignature!;

                        // Hacking

                        userIdentityToken.password[0] = 0xA;
                        userIdentityToken.password[1] = 0xC;
                        userIdentityToken.password[2] = 0xC;

                        hacked = true;

                    }


                }
                callback(err, data);
            })
        }
        let _capturedError: Error | undefined = undefined;
        try {
            const session = await client.createSession({
                type: UserTokenType.UserName,
                userName: "user1",
                password: "1"
            });
            await session.close();

        } catch (err) {
            _capturedError = err;
            console.log(_capturedError!.message)
        } finally {
            await client.disconnect();

            await server.shutdown();

        }
        should.exist(_capturedError);
        _capturedError?.message.should.match(/BadUserAccessDenied|BadIdentityTokenRejected/);
        hacked.should.eql(true);

    });
    it("T6 - server shall not crash if the user identity token is corrupted ActivateSession", async () => {

        let server = await startServer();

        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({});

        await client.connect(endpointUrl);

        const p = (client as any).createUserIdentityToken;

        let hacked = false;
        (client as any).createUserIdentityToken = function (
            this: any,
            context: any,
            userIdentityInfo: UserIdentityInfo,
            callback: (err: Error | null, data?: any/*TokenAndSignature*/) => void
        ) {


            p.call(this, context, userIdentityInfo, (err: Error | null, data: any) => {

                if (data) {

                    if (userIdentityInfo.type === UserTokenType.Certificate) {
                        console.log("Hacking the X509 certificate signature");
                        const userTokenSignature: any /*SignatureDataOptions */ = data.userTokenSignature!;

                        if (userTokenSignature && userTokenSignature.signature) {
                            console.log(userTokenSignature);
                            // Hacking signature
                            userTokenSignature.signature[0] = 0xA;
                            userTokenSignature.signature[1] = 0xC;
                            userTokenSignature.signature[2] = 0xC;
                            hacked = true;
                        }
                    }
                }
                callback(err, data);
            })
        }
        let _capturedError: Error | undefined = undefined;

        const clientCertificateFilename = path.join(certificateFolder, "client_cert_2048.pem");
        const clientCertificate = readCertificate(clientCertificateFilename);
        const clientPrivateKeyFilename = path.join(certificateFolder, "client_key_2048.pem");
        const privateKey = readPrivateKeyPEM(clientPrivateKeyFilename);

        try {
            const userIdentity: UserIdentityInfoX509 = {
                certificateData: clientCertificate,
                privateKey,
                type: UserTokenType.Certificate,
            };

            const session = await client.createSession(userIdentity);
            await session.close();

        } catch (err) {
            _capturedError = err;
            console.log(_capturedError!.message)
        } finally {
            await client.disconnect();

            await server.shutdown();

        }
        should.exist(_capturedError, "expecting createSession to have thrown an exception");
        _capturedError?.message.should.match(/BadUserSignatureInvalid/);

        hacked.should.eql(true);

    });
    // signature
});
