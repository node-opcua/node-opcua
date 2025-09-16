
import {
    get_mini_nodeset_filename,
    OPCUAServer,
    MessageSecurityMode,
    SecurityPolicy,
    UserTokenPolicy,
    UserTokenType
} from "node-opcua";
import "should";
import  { 
    createServerCertificateManager 
} from "../test_helpers/createServerCertificateManager";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const port = 1979;


describe("Server shall only expose userIdentityTokens that matches securityPolicies", () => {
    it("should ony expose one endpoint if no security ", async () => {
        const serverCertificateManager = await createServerCertificateManager(port);
        const server = new OPCUAServer({
            port,
            allowAnonymous: true,
            securityModes: [MessageSecurityMode.None],
            securityPolicies: [SecurityPolicy.None],
            serverCertificateManager,
            nodeset_filename: [get_mini_nodeset_filename()]
        });
        await server.initialize();
        const endpoints = server._get_endpoints();
        // endpoints.length.should.eql(1);
        // console.log(endpoints[0].userIdentityTokens);
        endpoints[0].userIdentityTokens!.length.should.eql(1);
        endpoints[0].userIdentityTokens![0].should.eql(
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
        const serverCertificateManager = await createServerCertificateManager(port);
        const server = new OPCUAServer({
            port,
            serverCertificateManager,
            allowAnonymous: false,
            securityModes: [MessageSecurityMode.Sign],
            securityPolicies: [SecurityPolicy.Basic256Sha256],
            nodeset_filename: [get_mini_nodeset_filename()]
        });
        await server.initialize();
        const endpoints = server._get_endpoints();
        endpoints.length.should.eql(2);
        // console.log(endpoints[0].userIdentityTokens);
        endpoints[0].userIdentityTokens!.length.should.eql(2);
        endpoints[0].userIdentityTokens![0].should.eql(
            new UserTokenPolicy({
                policyId: "username_basic256Sha256",
                tokenType: UserTokenType.UserName,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: SecurityPolicy.Basic256Sha256
            })
        );
        endpoints[0].userIdentityTokens![1].should.eql(
            new UserTokenPolicy({
                policyId: "certificate_basic256Sha256",
                tokenType: UserTokenType.Certificate,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: SecurityPolicy.Basic256Sha256
            })
        );
        //
        endpoints[1].userIdentityTokens![0].should.eql(
            new UserTokenPolicy({
                policyId: "usernamePassword",
                tokenType: UserTokenType.UserName,
                issuedTokenType: null,
                issuerEndpointUrl: null,
                securityPolicyUri: null
            })
        );
        endpoints[1].userIdentityTokens![1].should.eql(
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
