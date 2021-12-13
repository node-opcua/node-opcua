// test issue 985
//

import * as path from "path";
import * as fs from "fs";
import "should";
import { make_warningLog } from "node-opcua-debug";

import {
    get_mini_nodeset_filename,
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
    UserIdentityInfo,
    UserIdentityInfoX509,
    makeRoles,
    NodeId,
    UserManagerOptions
} from "node-opcua";
import { readCertificate, readPrivateKey, readPrivateKeyPEM } from "node-opcua-crypto";
import should = require("should");
import { createServerCertificateManager } from "../../test_helpers/createServerCertificateManager";
const warningLog = make_warningLog("TEST");

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
    { username: "user1", password: "1", role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin]) },
    { username: "user2", password: "2", role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator]) }
];

const certificateFolder = path.join(__dirname, "../../../node-opcua-samples/certificates");
fs.existsSync(certificateFolder).should.eql(true, "expecting certificate store at " + certificateFolder);

// simplistic user manager for test purpose only ( do not use in production !)
const userManager: UserManagerOptions = {
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

    getUserRoles: function (username: string): NodeId[] {
        const uIndex = users.findIndex((x) => x.username === username);
        if (uIndex < 0) {
            return [];
        }
        const userRole = users[uIndex].role;
        return userRole;
    }
};

async function waitForDisconnection(session: ClientSession): Promise<void> {
    while (!session.isReconnecting) {
        doDebug && warningLog("session.isReconnecting  ", session.isReconnecting);
        await pause(100);
    }
    doDebug && warningLog("session.isReconnecting  ", session.isReconnecting);
}

async function waitForReconnection(session: ClientSession): Promise<void> {
    while (session.isReconnecting) {
        doDebug && warningLog("session.isReconnecting  ", session.isReconnecting);
        await pause(100);
    }
    doDebug && warningLog("session.isReconnecting  ", session.isReconnecting);
}
async function startServer() {
    const port = 2565;

    const serverCertificateManager = await createServerCertificateManager(port);

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
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("test reconnection when server stops and change it privateKey and certificate then restart #985", function (this: any) {
    this.timeout(120 * 1000);

    async function test(
        securityPolicy: SecurityPolicy,
        securityMode: MessageSecurityMode,
        sessionTimeout: number,
        waitDuration: number
    ) {
        let server = await startServer();

        const endpointUrl = server.getEndpointUrl();

        const { client, session } = await createClient(endpointUrl, securityPolicy, securityMode, sessionTimeout);

        let _err: Error | undefined;

        const privateKeyBefore = readPrivateKey(server.privateKeyFile).toString("hex");
        const privateKeyAfter = await (async () => {
            try {
                await server.shutdown();
                warningLog("server has shutdown");

                await waitForDisconnection(session);
                warningLog("client lost connection");

                await pause(waitDuration);

                // make sure private key is deleted so it can be regenerated automatically
                fs.unlinkSync(server.privateKeyFile);
                fs.unlinkSync(server.certificateFile);

                warningLog("restarting server - with a different private key");
                server = await startServer();
                warningLog("server restarted");

                const privateKeyAfter = readPrivateKey(server.privateKeyFile).toString("hex");

                warningLog("waiting for client session to be back and running");
                await waitForReconnection(session);
                warningLog(" Client should now be reconnected");
                const dataValue = await session.read({ nodeId: "i=2258", attributeId: AttributeIds.Value });

                console.log(dataValue.toString());
                return privateKeyAfter;
            } catch (err) {
                console.log(err);
                _err = err as Error;
            } finally {
                await session.close();
                await client.disconnect();
                await server.shutdown();
            }
        })();

        should.not.exist(_err);
        privateKeyAfter.should.not.eql(privateKeyBefore, "expecting a different server private key");
    }
    it("T1- server should not crash when client re-establishes the connection - encrypted", async () => {
        await test(SecurityPolicy.Basic256Sha256, MessageSecurityMode.SignAndEncrypt, 10000, 5000);
    });
    it("T2- server should not crash when client re-establishes the connection - clear", async () => {
        await test(SecurityPolicy.None, MessageSecurityMode.None, 10000, 5000);
    });

    it("T3- server should not crash when client re-establishes the connection - clear - session timeout", async () => {
        await test(SecurityPolicy.None, MessageSecurityMode.None, 500, 5000);
    });

    it("T4 - server shall not crash if password is wrongly encrypted by client in ActivateSession", async () => {
        const server = await startServer();

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
            _capturedError = err as Error;
            console.log(_capturedError!.message);
        } finally {
            await client.disconnect();

            await server.shutdown();
        }
        //in this case it should work as the correct certificate has been received from the CreateSessionResponse
        should.not.exist(_capturedError, "expecting no error here");
        _capturedError?.message.should.match(/BadUserAccessDenied/);
    });
    it("T5 - server shall not crash if password is wrongly encrypted by client in ActivateSession", async () => {
        const server = await startServer();

        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({});

        await client.connect(endpointUrl);

        const p = (client as any).createUserIdentityToken;

        let hacked = false;
        (client as any).createUserIdentityToken = function (
            this: any,
            context: any,
            userIdentityInfo: UserIdentityInfo,
            callback: (err: Error | null, data?: any /*TokenAndSignature*/) => void
        ) {
            p.call(this, context, userIdentityInfo, (err: Error | null, data: any) => {
                if (data) {
                    if (userIdentityInfo.type === UserTokenType.UserName) {
                        console.log("Hacking with the password token");
                        const userIdentityToken: UserNameIdentityToken = data.userIdentityToken!;
                        const userTokenSignature: any /*SignatureDataOptions */ = data.userTokenSignature!;

                        // Hacking

                        userIdentityToken.password[0] = 0xa;
                        userIdentityToken.password[1] = 0xc;
                        userIdentityToken.password[2] = 0xc;

                        hacked = true;
                    }
                }
                callback(err, data);
            });
        };
        let _capturedError: Error | undefined = undefined;
        try {
            const session = await client.createSession({
                type: UserTokenType.UserName,
                userName: "user1",
                password: "1"
            });
            await session.close();
        } catch (err) {
            _capturedError = err as Error;
            console.log(_capturedError!.message);
        } finally {
            await client.disconnect();

            await server.shutdown();
        }
        should.exist(_capturedError);
        _capturedError?.message.should.match(/BadUserAccessDenied|BadIdentityTokenRejected/);
        hacked.should.eql(true);
    });
    it("T6 - server shall not crash if the user identity token is corrupted ActivateSession", async () => {
        const server = await startServer();

        const endpointUrl = server.getEndpointUrl();

        const client = OPCUAClient.create({});

        await client.connect(endpointUrl);

        const p = (client as any).createUserIdentityToken;

        let hacked = false;
        (client as any).createUserIdentityToken = function (
            this: any,
            context: any,
            userIdentityInfo: UserIdentityInfo,
            callback: (err: Error | null, data?: any /*TokenAndSignature*/) => void
        ) {
            p.call(this, context, userIdentityInfo, (err: Error | null, data: any) => {
                if (data) {
                    if (userIdentityInfo.type === UserTokenType.Certificate) {
                        console.log("Hacking the X509 certificate signature");
                        const userTokenSignature: any /*SignatureDataOptions */ = data.userTokenSignature!;

                        if (userTokenSignature && userTokenSignature.signature) {
                            console.log(userTokenSignature);
                            // Hacking signature
                            userTokenSignature.signature[0] = 0xa;
                            userTokenSignature.signature[1] = 0xc;
                            userTokenSignature.signature[2] = 0xc;
                            hacked = true;
                        }
                    }
                }
                callback(err, data);
            });
        };
        let _capturedError: Error | undefined = undefined;

        const clientCertificateFilename = path.join(certificateFolder, "client_cert_2048.pem");
        const clientCertificate = readCertificate(clientCertificateFilename);
        const clientPrivateKeyFilename = path.join(certificateFolder, "client_key_2048.pem");
        const privateKey = readPrivateKeyPEM(clientPrivateKeyFilename);

        try {
            const userIdentity: UserIdentityInfoX509 = {
                certificateData: clientCertificate,
                privateKey,
                type: UserTokenType.Certificate
            };

            const session = await client.createSession(userIdentity);
            await session.close();
        } catch (err) {
            _capturedError = err as Error;
            console.log(_capturedError!.message);
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
