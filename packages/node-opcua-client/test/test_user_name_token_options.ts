import { readCertificate } from "node-opcua-crypto";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { SecurityPolicy } from "node-opcua-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { EndpointDescription, MessageSecurityMode, type UserNameIdentityToken, UserTokenType } from "node-opcua-types";
import should from "should";

import { OPCUAClient } from "../source/index.js";
import { testPath } from "./paths.js";

/**
 * requireTrustedServerForUserName: with the option, a user name and password go only encrypted,
 * and only to a server whose CreateSession certificate passes the client certificate manager.
 * Without it, the client keeps its behavior.
 */
describe("OPCUAClient requireTrustedServerForUserName", () => {
    const serverCertificate = readCertificate(testPath("fixtures", "user1_certificate.pem"));

    /** a certificate manager that answers checkCertificate with the given status and counts the calls */
    function certificateManager(status: StatusCode) {
        const manager = {
            calls: 0,
            // read by the client constructor to name its own certificate files; no file is opened here
            rootDir: testPath("fixtures"),
            privateKey: testPath("fixtures", "private_key.pem"),
            async checkCertificate() {
                manager.calls++;
                return status;
            }
        };
        return manager;
    }

    /** the context of ActivateSession on a SecurityMode None channel, with the given user token policy */
    function context(userTokenSecurityPolicy: SecurityPolicy, certificate: Buffer | null = serverCertificate) {
        return {
            endpoint: new EndpointDescription({
                endpointUrl: "opc.tcp://localhost:4840",
                securityMode: MessageSecurityMode.None,
                securityPolicyUri: SecurityPolicy.None,
                userIdentityTokens: [
                    { policyId: "username", tokenType: UserTokenType.UserName, securityPolicyUri: userTokenSecurityPolicy }
                ]
            }),
            securityPolicy: SecurityPolicy.None,
            serverCertificate: certificate,
            serverNonce: Buffer.alloc(32, 1)
        };
    }

    type TokenCreator = {
        createUserIdentityToken(
            context: unknown,
            identity: unknown,
            callback: (err: Error | null, data?: { userIdentityToken: UserNameIdentityToken }) => void
        ): void;
    };

    async function userNameToken(client: OPCUAClient, ctx: ReturnType<typeof context>): Promise<UserNameIdentityToken> {
        return new Promise((resolve, reject) =>
            (client as unknown as TokenCreator).createUserIdentityToken(
                ctx,
                { type: UserTokenType.UserName, userName: "user1", password: "password1" },
                (err, data) => (err ? reject(err) : resolve(data?.userIdentityToken as UserNameIdentityToken))
            )
        );
    }

    function makeClient(requireTrustedServerForUserName: boolean, manager: ReturnType<typeof certificateManager>) {
        return OPCUAClient.create({
            endpointMustExist: false,
            requireTrustedServerForUserName,
            clientCertificateManager: manager as never
        });
    }

    it("PUT-1 without the option, a None user token policy still sends the password as it is", async () => {
        const manager = certificateManager(StatusCodes.Good);
        const client = makeClient(false, manager);
        const token = await userNameToken(client, context(SecurityPolicy.None));
        should(token.encryptionAlgorithm).eql(null);
        should(token.password.toString("utf-8")).eql("password1");
        should(manager.calls).eql(0);
        await client.disconnect();
    });

    it("PUT-2 with the option, a None user token policy fails before the password leaves the client", async () => {
        const manager = certificateManager(StatusCodes.Good);
        const client = makeClient(true, manager);
        await should(userNameToken(client, context(SecurityPolicy.None))).be.rejectedWith(/clear text/);
        await client.disconnect();
    });

    it("PUT-3 with the option, a missing server certificate fails", async () => {
        const manager = certificateManager(StatusCodes.Good);
        const client = makeClient(true, manager);
        await should(userNameToken(client, context(SecurityPolicy.Basic256Sha256, null))).be.rejectedWith(/clear text/);
        await client.disconnect();
    });

    it("PUT-4 with the option, a server certificate that the client does not trust fails", async () => {
        const manager = certificateManager(StatusCodes.BadCertificateUntrusted);
        const client = makeClient(true, manager);
        await should(userNameToken(client, context(SecurityPolicy.Basic256Sha256))).be.rejectedWith(/not trusted/);
        should(manager.calls).eql(1);
        await client.disconnect();
    });

    it("PUT-5 with the option, a trusted server certificate gets the encrypted token", async () => {
        const manager = certificateManager(StatusCodes.Good);
        const client = makeClient(true, manager);
        const token = await userNameToken(client, context(SecurityPolicy.Basic256Sha256));
        should(token.encryptionAlgorithm).not.eql(null);
        should(token.password.toString("utf-8")).not.containEql("password1");
        should(manager.calls).eql(1);
        await client.disconnect();
    });
});
