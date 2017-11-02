"use strict";

var should = require("should");

var OPCUAServerEndPoint = require("../src/server_end_point").OPCUAServerEndPoint;

var MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;
var SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;
var EndpointDescription = require("node-opcua-service-endpoints").EndpointDescription;

var crypto_utils = require("node-opcua-crypto").crypto_utils;
var it_with_crypto = it;

var default_port = 1234;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("OPCUAServerEndpoint#addEndpointDescription", function () {


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

    var server_endpoint;
    beforeEach(function () {
        server_endpoint = new OPCUAServerEndPoint({
            port: default_port,
            serverInfo: {},
            certificateChain: null,
            privateKey: ""
        });
        server_endpoint.addStandardEndpointDescriptions({
            securityModes: [MessageSecurityMode.SIGNANDENCRYPT],
            disableDiscovery: true
        });
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
