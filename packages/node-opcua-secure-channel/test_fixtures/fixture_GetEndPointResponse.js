"use strict";
var should = require("should");
var assert = require("node-opcua-assert").assert;


var endpoints_service = require("node-opcua-service-endpoints");

var GetEndpointsResponse = endpoints_service.GetEndpointsResponse;


var EndpointDescription = require("node-opcua-service-endpoints").EndpointDescription;
var ApplicationType = require("node-opcua-service-endpoints").ApplicationType;
var UserTokenType = require("node-opcua-service-endpoints").UserTokenType;
var MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;

exports.fixture1 = (function () {
    // empty  GetEndpointsResponse
    return new GetEndpointsResponse();

})();

exports.makeEndPoint = function () {

    var data = {
        endpointUrl: "toto",

        server: {

            applicationUri: "OPCUA  node-js",
            productUri: "some product uri",
            applicationName: {text: "Localised application name"},
            applicationType: ApplicationType.ClientAndServer,
            gatewayServerUri: "gatewayServerUri",
            discoveryProfileUri: "discoveryProfileUri",
            discoveryUrls: [
                "discoveryUrls1",
                "discoveryUrls2",
                "discoveryUrls3",
                "discoveryUrls4",
                "discoveryUrls5"
            ]
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
    var value = new EndpointDescription(data);
    assert(value.server);
    return value;
};


exports.fixture2 = (function () {


    var endPointResponse = new GetEndpointsResponse();
    endPointResponse.endpoints.length.should.equal(0);

    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.length.should.equal(1);

    endPointResponse.endpoints[0].server.gatewayServerUri.should.eql("gatewayServerUri");
    endPointResponse.endpoints[0].securityMode.should.eql(MessageSecurityMode.None);


    return endPointResponse;

})();

exports.fixture3 = (function () {


    var endPointResponse = new GetEndpointsResponse();
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


    var endPointResponse = new GetEndpointsResponse();
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
