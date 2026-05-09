"use strict";

const should = require("should");
const { assert} = require("node-opcua-assert");
const { 
    GetEndpointsResponse, 
    EndpointDescription , 
    ApplicationType, 
    UserTokenType 
} = require("node-opcua-service-endpoints");
const { 
    MessageSecurityMode  
} = require("node-opcua-service-secure-channel");

exports.fixture1 = (function () {
    // empty  GetEndpointsResponse
    return new GetEndpointsResponse();

})();

exports.makeEndPoint = function makeEndPoint() {
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


exports.fixture2 = (function () {


    const endPointResponse = new GetEndpointsResponse();
    endPointResponse.endpoints.length.should.equal(0);

    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.length.should.equal(1);

    endPointResponse.endpoints[0].server.gatewayServerUri.should.eql("gatewayServerUri");
    endPointResponse.endpoints[0].securityMode.should.eql(MessageSecurityMode.None);


    return endPointResponse;

})();

exports.fixture3 = (function () {


    const endPointResponse = new GetEndpointsResponse();
    endPointResponse.endpoints.length.should.equal(0);

    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.length.should.equal(3);

    endPointResponse.endpoints[0].server.gatewayServerUri.should.eql("gatewayServerUri");
    endPointResponse.endpoints[0].securityMode.should.eql(MessageSecurityMode.None);


    return endPointResponse;

})();


exports.fixture4 = (function () {


    const endPointResponse = new GetEndpointsResponse();
    endPointResponse.endpoints.length.should.equal(0);

    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.length.should.equal(20);

    endPointResponse.endpoints[0].server.gatewayServerUri.should.eql("gatewayServerUri");
    endPointResponse.endpoints[0].securityMode.should.eql(MessageSecurityMode.None);


    return endPointResponse;

})();
