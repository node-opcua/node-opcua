require("requirish")._(module);
import crypto_utils from "lib/misc/crypto_utils";

var should = require("should");

var opcua = require("index.js");

var OPCUAServerEndPoint = require("lib/server/server_end_point").OPCUAServerEndPoint;
var MessageSecurityMode = opcua.MessageSecurityMode;
var SecurityPolicy = opcua.SecurityPolicy;
var EndpointDescription = opcua.EndpointDescription;

var it_with_crypto = (crypto_utils.isFullySupported()) ? it : xit;

var default_port = 1234;
var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;


describe("OPCUAServerEndpoint#addEndpointDescription", function () {

    before(function (done) {
        resourceLeakDetector.start();
        done();
    });
    after(function () {
        resourceLeakDetector.stop();
    });

    var server_endpoint;
    beforeEach(function () {

        server_endpoint = new OPCUAServerEndPoint({port: default_port, serverInfo: {}, certificateChain: null, privateKey: ""});
    });
    afterEach(function () {
        server_endpoint = null;
    });

    it("should  accept  to add endpoint endMessageSecurityMode.NONE and SecurityPolicy.None", function () {
        should(function () {
            server_endpoint.addEndpointDescription(MessageSecurityMode.NONE, SecurityPolicy.None);
        }).not.throwError();

    });

    it("should  accept  to add endpoint endMessageSecurityMode.NONE and SecurityPolicy.None twice", function () {
        server_endpoint.addEndpointDescription(MessageSecurityMode.NONE, SecurityPolicy.None);
        should(function () {
            server_endpoint.addEndpointDescription(MessageSecurityMode.NONE, SecurityPolicy.None);
        }).throwError();
    });


    it("should not accept to add endpoint with MessageSecurityMode.NONE and SecurityPolicy.Basic128", function () {

        should(function () {
            server_endpoint.addEndpointDescription(MessageSecurityMode.NONE, SecurityPolicy.Basic128);
        }).throwError();

    });
    it("should not accept  to add endpoint  MessageSecurityMode.SIGN and SecurityPolicy.None", function () {

        should(function () {
            server_endpoint.addEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.None);
        }).throwError();

    });

});

describe("OPCUAServerEndpoint#addStandardEndpointDescriptions", function () {

    before(function (done) {
        resourceLeakDetector.start();
        done();
    });
    after(function () {
        resourceLeakDetector.stop();
    });


    var server_endpoint;
    beforeEach(function () {
        server_endpoint = new OPCUAServerEndPoint({port: default_port, serverInfo: {}, certificateChain: null, privateKey: ""});
        server_endpoint.addStandardEndpointDescriptions();
    });
    afterEach(function () {
        server_endpoint = null;
    });


    it("should find a endpoint matching MessageSecurityMode.NONE", function () {

        var endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.NONE, SecurityPolicy.None);
        should(endpoint_desc).be.instanceOf(EndpointDescription);

    });

    it_with_crypto("should find a endpoint matching SIGNANDENCRYPT / Basic256", function () {

        var endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.Basic256);
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });
    it_with_crypto("should find a endpoint matching SIGN / Basic256", function () {

        var endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic256);
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });
});

describe("OPCUAServerEndpoint#addStandardEndpointDescriptions extra secure", function () {

    before(function (done) {
        resourceLeakDetector.start();
        done();
    });
    after(function () {
        resourceLeakDetector.stop();
    });

    var server_endpoint;
    beforeEach(function () {
        server_endpoint = new OPCUAServerEndPoint({port: default_port, serverInfo: {}, certificateChain: null, privateKey: ""});
        server_endpoint.addStandardEndpointDescriptions({securityModes: [MessageSecurityMode.SIGNANDENCRYPT]});
    });
    afterEach(function () {
        server_endpoint = null;
    });


    it("should not find a endpoint matching MessageSecurityMode.NONE", function () {

        var endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.NONE, SecurityPolicy.None);
        should(endpoint_desc).be.eql(null);

    });

    it_with_crypto("should not find a endpoint matching SIGN / Basic256", function () {

        var endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic256);
        should(endpoint_desc).be.eql(null);
    });

    it_with_crypto("should find a endpoint matching SIGNANDENCRYPT / Basic256", function () {

        var endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.Basic256);
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });

});


describe("OPCUAServerEndpoint#getEndpointDescription", function () {

    before(function (done) {
        resourceLeakDetector.start();
        done();
    });
    after(function () {
        resourceLeakDetector.stop();
    });

    var server_endpoint;
    beforeEach(function () {

        server_endpoint = new OPCUAServerEndPoint({port: default_port, serverInfo: {}, certificateChain: null, privateKey: ""});
    });
    afterEach(function () {
        server_endpoint = null;
    });


    it_with_crypto("should not find a endpoint matching MessageSecurityMode.SIGN and SecurityPolicy.Basic128", function () {

        var endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic128);
        should(endpoint_desc).be.eql(null);

        server_endpoint.addEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic128);
        server_endpoint.addEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic256);

        endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic128);
        should(endpoint_desc).be.instanceof(EndpointDescription);

        endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic256);
        should(endpoint_desc).be.instanceof(EndpointDescription);

    });

    it("should not find a endpoint matching MessageSecurityMode.SIGN and SecurityPolicy.None", function () {

        var endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.None);
        should(endpoint_desc).be.eql(null);

    });
    it("should not find a endpoint matching MessageSecurityMode.SIGNANDENCRYPT and SecurityPolicy.None", function () {

        var endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.None);
        should(endpoint_desc).be.eql(null);

    });


});
