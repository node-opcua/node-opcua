import {
    MessageSecurityMode,
    OPCUAServer,
    OPCUAClient,
    UserTokenPolicy,
    UserTokenType,
    SecurityPolicy,
    s,
    ActivateSessionRequest,
    UserNameIdentityToken
} from "node-opcua";
import "should";

const port = 2242;
describe("issue #1334 - client should avoid using userToken that have deprecated security policy like 192Rsa256 ", () => {
    const buildSecureServer = async () => {
        const server = new OPCUAServer({
            port,
            userManager: {
                isValidUser: (userName: string, password: string) => {
                    return userName === "user" && password === "password";
                }
            },
            securityModes: [MessageSecurityMode.SignAndEncrypt],
            securityPolicies: [SecurityPolicy.Basic256Sha256]
        });

        await server.initialize();
        const endpoints = server._get_endpoints();

        const encryptedEndpoint = endpoints.find((e) => e.securityMode === MessageSecurityMode.SignAndEncrypt)!;

        // reproduce what S7 1500 will provide
        encryptedEndpoint.userIdentityTokens = [
            new UserTokenPolicy({
                policyId: "UserName_Basic128Rsa15_Token",
                tokenType: UserTokenType.UserName,
                issuedTokenType: null,
                securityPolicyUri: SecurityPolicy.Basic128Rsa15
            }),
            new UserTokenPolicy({
                policyId: "UserName_Basic256_Token",
                tokenType: UserTokenType.UserName,
                issuedTokenType: null,
                securityPolicyUri: SecurityPolicy.Basic256
            }),
            new UserTokenPolicy({
                policyId: "UserName_Basic256Sha256_Token",
                tokenType: UserTokenType.UserName,
                issuedTokenType: null,
                securityPolicyUri: SecurityPolicy.Basic256Sha256
            })
        ];
        console.log(encryptedEndpoint.userIdentityTokens!.map((x) => x.toString()).join("\n"));

        await server.start();
        return server;
    };

    let server: OPCUAServer;
    before(async () => {
        server = await buildSecureServer();
    });
    after(async () => {
        await server.shutdown();
    });
    it("OPCUAClient should avoid using deprecated securityPolicy for identity tokens ", async () => {
        const client = OPCUAClient.create({
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic256Sha256
        });
        await client.connect(server.getEndpointUrl());

        let activeSessionRequest: ActivateSessionRequest;
        client.on("send_request", (message) => {
            if (message instanceof ActivateSessionRequest) {
                activeSessionRequest = message;
                console.log(message.toString());
            }
        });
        const session = await client.createSession({
            type: UserTokenType.UserName,
            userName: "user",
            password: "password"
        });

        await session.close();

        await client.disconnect();

        const userToken = activeSessionRequest!.userIdentityToken! as UserNameIdentityToken;
        userToken.policyId!.should.eql("UserName_Basic256Sha256_Token");
    });
});
