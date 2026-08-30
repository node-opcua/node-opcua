import { assert } from "node-opcua-assert";
import { ApplicationType, EndpointDescription, GetEndpointsResponse, UserTokenType } from "node-opcua-service-endpoints";
import { MessageSecurityMode } from "node-opcua-service-secure-channel";
import should from "should";

export const fixture1 = (() => {
    // empty  GetEndpointsResponse
    return new GetEndpointsResponse();
})();

export const makeEndPoint = function makeEndPoint() {
    const data = {
        endpointUrl: "toto",

        server: {
            applicationUri: "OPCUA  node-js",
            productUri: "some product uri",
            applicationName: { text: "Localized application name" },
            applicationType: ApplicationType.ClientAndServer,
            gatewayServerUri: "gatewayServerUri",
            discoveryProfileUri: "discoveryProfileUri",
            discoveryUrls: ["discoveryUrls1", "discoveryUrls2", "discoveryUrls3", "discoveryUrls4", "discoveryUrls5"]
        },

        serverCertificate: Buffer.alloc(256),

        securityMode: MessageSecurityMode.None,

        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
        userIdentityTokens: [
            {
                policyId: "policyId",
                tokenType: UserTokenType.Anonymous,
                issuedTokenType: "issuedTokenType",
                issuerEndpointUrl: "qdqsdq",
                securityPolicyUri: "String"
            }
        ],
        transportProfileUri: "",
        securityLevel: 36
    };
    const value = new EndpointDescription(data);
    assert(value.server);
    return value;
};

export const fixture2 = (() => {
    const endPointResponse = new GetEndpointsResponse();
    should(endPointResponse.endpoints?.length).equal(0);

    endPointResponse.endpoints?.push(makeEndPoint());
    should(endPointResponse.endpoints?.length).equal(1);

    should(endPointResponse.endpoints?.[0].server.gatewayServerUri).eql("gatewayServerUri");
    should(endPointResponse.endpoints?.[0].securityMode).eql(MessageSecurityMode.None);

    return endPointResponse;
})();

export const fixture3 = (() => {
    const endPointResponse = new GetEndpointsResponse();
    should(endPointResponse.endpoints?.length).equal(0);

    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    should(endPointResponse.endpoints?.length).equal(3);

    should(endPointResponse.endpoints?.[0].server.gatewayServerUri).eql("gatewayServerUri");
    should(endPointResponse.endpoints?.[0].securityMode).eql(MessageSecurityMode.None);

    return endPointResponse;
})();

export const fixture4 = (() => {
    const endPointResponse = new GetEndpointsResponse();
    should(endPointResponse.endpoints?.length).equal(0);

    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    endPointResponse.endpoints?.push(makeEndPoint());
    should(endPointResponse.endpoints?.length).equal(20);

    should(endPointResponse.endpoints?.[0].server.gatewayServerUri).eql("gatewayServerUri");
    should(endPointResponse.endpoints?.[0].securityMode).eql(MessageSecurityMode.None);

    return endPointResponse;
})();
