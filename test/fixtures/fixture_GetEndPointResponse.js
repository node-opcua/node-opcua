
var s = require("../../lib/datamodel/structures");
var should = require("should");
var assert = require("better-assert");

exports.fixture1 = (function(){
    // empty  GetEndpointsResponse
    return new s.GetEndpointsResponse();

})();

exports.makeEndPoint = function(){

    var data=    {
        endpointUrl: "toto",

        server: {

            applicationUri :  "OPCUA  node-js",
            productUri:       "some product uri",
            applicationName:  { text: "Localised application name"},
            applicationType:   s.ApplicationType.CLIENTANDSERVER,
            gatewayServerUri:  "gatewayServerUri",
            discoveryProfileUri: "discoveryProfileUri",
            discoveryUrls: [
                "discoveryUrls1",
                "discoveryUrls2",
                "discoveryUrls3",
                "discoveryUrls4",
                "discoveryUrls5"
            ]
        },

        serverCertificate: new Buffer(256),

        securityMode: s.MessageSecurityMode.NONE,

        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
        userIdentityTokens: [
            {
                policyId: "policyId",
                tokenType: s.UserIdentityTokenType.ANONYMOUS,
                issuedTokenType: "issuedTokenType",
                issuerEndpointUrl: "qdqsdq",
                securityPolicyUri: "String"
            }
        ],
        transportProfileUri: "",
        securityLevel:    36
    };
    var value =  new s.EndpointDescription(data);
    assert(value.server);
    return value;
};


exports.fixture2 = (function(){


    var endPointResponse = new s.GetEndpointsResponse();
    endPointResponse.endpoints.length.should.equal(0);

    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.length.should.equal(1);

    endPointResponse.endpoints[0].server.gatewayServerUri.should.eql("gatewayServerUri");
    endPointResponse.endpoints[0].securityMode.should.eql(s.MessageSecurityMode.NONE);


    return endPointResponse;

})();

exports.fixture3 = (function(){


    var endPointResponse = new s.GetEndpointsResponse();
    endPointResponse.endpoints.length.should.equal(0);

    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.push(exports.makeEndPoint());
    endPointResponse.endpoints.length.should.equal(3);

    endPointResponse.endpoints[0].server.gatewayServerUri.should.eql("gatewayServerUri");
    endPointResponse.endpoints[0].securityMode.should.eql(s.MessageSecurityMode.NONE);


    return endPointResponse;

})();


exports.fixture4 = (function(){


    var endPointResponse = new s.GetEndpointsResponse();
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
    endPointResponse.endpoints[0].securityMode.should.eql(s.MessageSecurityMode.NONE);


    return endPointResponse;

})();