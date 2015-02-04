require("requirish")._(module);

var should = require("should");

var opcua  = require(".");

var OPCUAServerEndPoint = require("lib/server/server_end_point").OPCUAServerEndPoint;
var MessageSecurityMode = opcua.MessageSecurityMode;
var SecurityPolicy = opcua.SecurityPolicy;

var crypto_utils = require("lib/misc/crypto_utils");
var it_with_crypto =  (crypto_utils.isFullySupported())  ? it: xit;

var default_port = 1234;

describe("OPCUAServerEndpoint#addEndpointDescription",function() {
    var server_endpoint;
    beforeEach(function() {

        server_endpoint = new OPCUAServerEndPoint({port: default_port,serverInfo: {},serverCertificate:""});
    });
    afterEach(function() { server_endpoint = null; });

    it("should  accept  to add endpoint endMessageSecurityMode.NONE and SecurityPolicy.None",function(){
        should(function(){
            server_endpoint.addEndpointDescription(MessageSecurityMode.NONE,SecurityPolicy.None);
        }).not.throwError();

    });

    it("should  accept  to add endpoint endMessageSecurityMode.NONE and SecurityPolicy.None twice",function(){
        server_endpoint.addEndpointDescription(MessageSecurityMode.NONE,SecurityPolicy.None);
        should(function(){
            server_endpoint.addEndpointDescription(MessageSecurityMode.NONE,SecurityPolicy.None);
        }).throwError();
    });


    it("should not accept to add endpoint with MessageSecurityMode.NONE and SecurityPolicy.Basic128",function(){

        should(function(){
            server_endpoint.addEndpointDescription(MessageSecurityMode.NONE,SecurityPolicy.Basic128);
        }).throwError();

    });
    it("should not accept  to add endpoint  MessageSecurityMode.SIGN and SecurityPolicy.None",function(){

        should(function(){
            server_endpoint.addEndpointDescription(MessageSecurityMode.SIGN,SecurityPolicy.None);
        }).throwError();

    });

});

describe("OPCUAServerEndpoint#addStandardEndpointDescription",function(){

    var server_endpoint;
    beforeEach(function() {
        server_endpoint = new OPCUAServerEndPoint({port: default_port,serverInfo: {}});
        server_endpoint.addStandardEndpointDescription();
    });
    afterEach(function() { server_endpoint = null; });


    it("should find a endpoint matching MessageSecurityMode.NONE",function() {

        var endpoints = server_endpoint.get_endpoint_for_security_mode_and_policy(MessageSecurityMode.NONE,SecurityPolicy.None);
        endpoints.length.should.equal(1);

    });

    it_with_crypto("should find a endpoint matching SIGNANDENCRYPT / Basic256",function() {

        var endpoints = server_endpoint.get_endpoint_for_security_mode_and_policy(MessageSecurityMode.SIGNANDENCRYPT,SecurityPolicy.Basic256);
        endpoints.length.should.equal(1);
    });

});
describe("OPCUAServerEndpoint#get_endpoint_for_security_mode_and_policy",function() {

    var server_endpoint;
    beforeEach(function() {

        server_endpoint = new OPCUAServerEndPoint({port:default_port,serverInfo: {}});
    });
    afterEach(function() { server_endpoint = null; });



    it_with_crypto("should not find a endpoint matching MessageSecurityMode.SIGN and SecurityPolicy.Basic128",function() {

        server_endpoint.addEndpointDescription(MessageSecurityMode.SIGN,SecurityPolicy.Basic128);
        server_endpoint.addEndpointDescription(MessageSecurityMode.SIGN,SecurityPolicy.Basic256);
        var endpoints = server_endpoint.get_endpoint_for_security_mode_and_policy(MessageSecurityMode.SIGN,SecurityPolicy.Basic128);
        endpoints.length.should.equal(1);

    });

    it("should not find a endpoint matching MessageSecurityMode.SIGN and SecurityPolicy.None",function() {

        var endpoints = server_endpoint.get_endpoint_for_security_mode_and_policy(MessageSecurityMode.SIGN,SecurityPolicy.None);
        endpoints.length.should.equal(0);

    });
    it("should not find a endpoint matching MessageSecurityMode.SIGNANDENCRYPT and SecurityPolicy.None",function() {

        var endpoints = server_endpoint.get_endpoint_for_security_mode_and_policy(MessageSecurityMode.SIGNANDENCRYPT,SecurityPolicy.None);
        endpoints.length.should.equal(0);

    });


});
