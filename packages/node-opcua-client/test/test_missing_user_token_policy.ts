import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { SecurityPolicy } from "node-opcua-secure-channel";
import {
    type AnonymousIdentityToken,
    EndpointDescription,
    MessageSecurityMode,
    type UserTokenPolicyOptions,
    UserTokenType
} from "node-opcua-types";
import should from "should";

import { OPCUAClient } from "../source/index.js";

/**
 * When the endpoint has no UserTokenPolicy for the requested identity, the client refuses
 * before ActivateSession, and the error names what the endpoint offers instead.
 * The refusal itself is unchanged: no identity token is ever made up.
 */
describe("OPCUAClient missing user token policy", () => {
    function context(userIdentityTokens: UserTokenPolicyOptions[] | null) {
        const endpoint = new EndpointDescription({
            endpointUrl: "opc.tcp://plc:4840",
            securityMode: MessageSecurityMode.None,
            securityPolicyUri: SecurityPolicy.None,
            userIdentityTokens: userIdentityTokens ?? []
        });
        if (userIdentityTokens === null) {
            // as decoded from a server that sends a null array
            endpoint.userIdentityTokens = null;
        }
        return { endpoint, securityPolicy: SecurityPolicy.None, serverCertificate: null, serverNonce: Buffer.alloc(32, 1) };
    }

    type TokenCreator = {
        createUserIdentityToken(
            context: unknown,
            identity: unknown,
            callback: (err: Error | null, data?: { userIdentityToken: AnonymousIdentityToken }) => void
        ): void;
    };

    async function identityToken(identity: unknown, ctx: ReturnType<typeof context>): Promise<AnonymousIdentityToken> {
        const client = OPCUAClient.create({ endpointMustExist: false });
        try {
            return await new Promise((resolve, reject) =>
                (client as unknown as TokenCreator).createUserIdentityToken(ctx, identity, (err, data) =>
                    err ? reject(err) : resolve(data?.userIdentityToken as AnonymousIdentityToken)
                )
            );
        } finally {
            await client.disconnect();
        }
    }

    const anonymous = { type: UserTokenType.Anonymous };
    const userName = { type: UserTokenType.UserName, userName: "user1", password: "password1" };

    it("MUT-1 an endpoint with no user token policy at all refuses anonymous and says so", async () => {
        await should(identityToken(anonymous, context([]))).be.rejectedWith(
            /^Cannot find ANONYMOUS user token policy in end point description: .*opc\.tcp:\/\/plc:4840.*advertises no user token policy/
        );
    });

    it("MUT-2 a null userIdentityTokens is treated as an empty list, and still refused", async () => {
        await should(identityToken(anonymous, context(null))).be.rejectedWith(/advertises no user token policy/);
    });

    it("MUT-3 an endpoint without anonymous lists the identities it accepts", async () => {
        const ctx = context([
            { policyId: "u", tokenType: UserTokenType.UserName },
            { policyId: "u2", tokenType: UserTokenType.UserName, securityPolicyUri: SecurityPolicy.Basic256Sha256 },
            { policyId: "c", tokenType: UserTokenType.Certificate }
        ]);
        await should(identityToken(anonymous, ctx)).be.rejectedWith(/only accepts: UserName, Certificate; enable Anonymous/);
    });

    it("MUT-4 an endpoint without user name refuses the password: it never leaves the client", async () => {
        const ctx = context([{ policyId: "anon", tokenType: UserTokenType.Anonymous }]);
        await should(identityToken(userName, ctx)).be.rejectedWith(
            /^Cannot find USERNAME user token policy in end point description: .*only accepts: Anonymous/
        );
    });

    it("MUT-5 an endpoint that offers anonymous still gets a token with the server's policyId", async () => {
        const token = await identityToken(anonymous, context([{ policyId: "anon", tokenType: UserTokenType.Anonymous }]));
        should(token.policyId).eql("anon");
    });
});
