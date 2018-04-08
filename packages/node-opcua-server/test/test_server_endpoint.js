"use strict";

const should = require("should");

const OPCUAServerEndPoint = require("../src/server_end_point").OPCUAServerEndPoint;

const MessageSecurityMode = require("node-opcua-service-secure-channel").MessageSecurityMode;
const SecurityPolicy = require("node-opcua-secure-channel").SecurityPolicy;
const EndpointDescription = require("node-opcua-service-endpoints").EndpointDescription;

const crypto_utils = require("node-opcua-crypto").crypto_utils;
const it_with_crypto = it;

const default_port = 1234;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("OPCUAServerEndpoint#addEndpointDescription", function () {


    let server_endpoint;
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

    let server_endpoint;
    beforeEach(function () {
        server_endpoint = new OPCUAServerEndPoint({port: default_port, serverInfo: {}, certificateChain: null, privateKey: ""});
        server_endpoint.addStandardEndpointDescriptions();
    });
    afterEach(function () {
        server_endpoint = null;
    });


    it("should find a endpoint matching MessageSecurityMode.NONE", function () {

        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.NONE, SecurityPolicy.None);
        should(endpoint_desc).be.instanceOf(EndpointDescription);

    });

    it_with_crypto("should find a endpoint matching SIGNANDENCRYPT / Basic256", function () {

        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.Basic256);
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });
    it_with_crypto("should find a endpoint matching SIGN / Basic256", function () {

        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic256);
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });
});

describe("OPCUAServerEndpoint#addStandardEndpointDescriptions extra secure", function () {

    let server_endpoint;
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

        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.NONE, SecurityPolicy.None);
        should(endpoint_desc).be.eql(null);

    });

    it_with_crypto("should not find a endpoint matching SIGN / Basic256", function () {

        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic256);
        should(endpoint_desc).be.eql(null);
    });

    it_with_crypto("should find a endpoint matching SIGNANDENCRYPT / Basic256", function () {

        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.Basic256);
        should(endpoint_desc).be.instanceof(EndpointDescription);
    });

});


describe("OPCUAServerEndpoint#getEndpointDescription", function () {

    let server_endpoint;
    beforeEach(function () {

        server_endpoint = new OPCUAServerEndPoint({port: default_port, serverInfo: {}, certificateChain: null, privateKey: ""});
    });
    afterEach(function () {
        server_endpoint = null;
    });


    it_with_crypto("should not find a endpoint matching MessageSecurityMode.SIGN and SecurityPolicy.Basic128", function () {

        let endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic128);
        should(endpoint_desc).be.eql(null);

        server_endpoint.addEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic128);
        server_endpoint.addEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic256);

        endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic128);
        should(endpoint_desc).be.instanceof(EndpointDescription);

        endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.Basic256);
        should(endpoint_desc).be.instanceof(EndpointDescription);

    });

    it("should not find a endpoint matching MessageSecurityMode.SIGN and SecurityPolicy.None", function () {

        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGN, SecurityPolicy.None);
        should(endpoint_desc).be.eql(null);

    });
    it("should not find a endpoint matching MessageSecurityMode.SIGNANDENCRYPT and SecurityPolicy.None", function () {

        const endpoint_desc = server_endpoint.getEndpointDescription(MessageSecurityMode.SIGNANDENCRYPT, SecurityPolicy.None);
        should(endpoint_desc).be.eql(null);

    });


});
