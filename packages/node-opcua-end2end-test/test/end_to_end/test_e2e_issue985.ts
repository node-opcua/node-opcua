// test issue 985
//

import * as os from "os";
import * as path from "path";
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
    UserNameIdentityToken
} from "node-opcua";
import { readPrivateKey } from "node-opcua-crypto";

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
                    console.log("password = ", hexDump(a.userIdentityToken.password));
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
});
