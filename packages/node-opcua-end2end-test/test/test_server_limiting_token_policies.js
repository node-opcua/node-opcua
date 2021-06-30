const {
    get_mini_nodeset_filename,
    OPCUAServer,
    MessageSecurityMode,
    SecurityPolicy,
    UserTokenPolicy,
    UserTokenType
} = require("node-opcua");
require("should");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Server shall only expose userIdentityTokens that matches securityPolicies", () => {
    it("should ony expose one endpoint if no security ", async () => {
        const server = new OPCUAServer({
            allowAnonymous: true,
            securityModes: [MessageSecurityMode.None],
            securityPolicies: [SecurityPolicy.None],
            nodeset_filename: [get_mini_nodeset_filename()]
        });
        await server.initialize();
        const endpoints = server._get_endpoints();
        // endpoints.length.should.eql(1);
        // console.log(endpoints[0].userIdentityTokens);
        endpoints[0].userIdentityTokens.length.should.eql(1);
        endpoints[0].userIdentityTokens[0].should.eql(
            new UserTokenPolicy({
                policyId: "anonymous",
                tokenType: 0,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            })
        );
        await server.shutdown();
    });
    it("should ony expose two endpoint if no security ", async () => {
        const server = new OPCUAServer({
            allowAnonymous: false,
            securityModes: [MessageSecurityMode.Sign],
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            nodeset_filename: [get_mini_nodeset_filename()]
        });
        await server.initialize();
        const endpoints = server._get_endpoints();
        endpoints.length.should.eql(2);
        // console.log(endpoints[0].userIdentityTokens);
        endpoints[0].userIdentityTokens.length.should.eql(2);
        endpoints[0].userIdentityTokens[0].should.eql(
            new UserTokenPolicy({
                policyId: "username_basic256Sha256",
                tokenType: UserTokenType.UserName,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: SecurityPolicy.Basic256Sha256
            })
        );
        endpoints[0].userIdentityTokens[1].should.eql(
            new UserTokenPolicy({
                policyId: "certificate_basic256Sha256",
                tokenType: UserTokenType.Certificate,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: SecurityPolicy.Basic256Sha256
            })
        );
        //
        endpoints[1].userIdentityTokens[0].should.eql(
            new UserTokenPolicy({
                policyId: "usernamePassword",
                tokenType: UserTokenType.UserName,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            })
        );
        endpoints[1].userIdentityTokens[1].should.eql(
            new UserTokenPolicy({
                policyId: "certificateX509",
                tokenType: UserTokenType.Certificate,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            })
        );
        await server.shutdown();
    });
});
