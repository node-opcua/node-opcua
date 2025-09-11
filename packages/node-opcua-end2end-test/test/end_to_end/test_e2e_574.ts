import "should";
import {
    OPCUAServer,
    OPCUAClient,
    MessageSecurityMode,
    SecurityPolicy,
    UserTokenPolicy,
    UserTokenType
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

// require("node-opcua-service-session").UserNameIdentityToken;  (kept reference to original commented import)

describe("Testing bug #574", function (this: Mocha.Context) {

    const port = 2222;
    let server: OPCUAServer | null = null;
    let endpointUrl = "";


    before(async () => {
        server = new OPCUAServer({
            port,
            securityModes: [MessageSecurityMode.None],
            securityPolicies: [SecurityPolicy.None],
            userManager: {
                isValidUser: (username: string, password: string) => username === "user1" && password === "password1"
            }
        });
        await server.start();
        // note: Some OPCUA servers (such as Softing) allow user token policies that
        //       send password in clear text on the TCP un-encrypted channel.
        //       This behavior is not recommended by the OPCUA specification but
        //       exists in many server on the field.
        //       On our side, node opcua doesn't allow password to be send un-securely.
        //       We need to tweak the server to allow this for the purpose
        //       of this test.
        //       Let's remove all but policy and add a single
        //       userIdentityTokens policy for username and un-encrypted password
        let endpoints = (server as any)._get_endpoints(); // internal accessor
        endpointUrl = endpoints[0].endpointUrl;

        endpoints = endpoints.filter((e: any) => e.securityMode === MessageSecurityMode.None);
        endpoints.length.should.eql(1);
        // Replace identity tokens with a single insecure username/password policy (for test only!)
        endpoints[0].userIdentityTokens = [
            new UserTokenPolicy({
                policyId: "usernamePassword_unsecure",
                tokenType: UserTokenType.UserName,
                issuedTokenType: null as any,
                issuerEndpointUrl: null as any,
                securityPolicyUri: null as any
            })
        ];
    });
    after(async () => {
        if (server) {
            await server.shutdown();
            server = null;
        }
    });
    it("should create a session with user/password on unsecured connection", async () => {
        // user1/password1 credentials (insecure on purpose for this regression test)
        const client = OPCUAClient.create({ endpointMustExist: false, requestedSessionTimeout: 60_000 });
        const userIdentity = { userName: "user1", password: (() => "password1")() };
        try {
            await client.connect(endpointUrl);
            console.log("connected !");
            const session = await client.createSession(userIdentity as any);
            await session.close();
        } finally {
            await client.disconnect();
        }
    });
});

