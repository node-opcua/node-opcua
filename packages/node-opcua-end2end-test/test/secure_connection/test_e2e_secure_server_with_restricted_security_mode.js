
"use strict";
var should = require("should");
var opcua = require("node-opcua");

var OPCUAClient = opcua.OPCUAClient;
var SecurityPolicy = opcua.SecurityPolicy;
var MessageSecurityMode = opcua.MessageSecurityMode;

var build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;


var crypto_utils = require("node-opcua-crypto").crypto_utils;
if (!crypto_utils.isFullySupported()) {
    console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
    return;
}

var describe = require("node-opcua-test-helpers/src/resource_leak_detector").describeWithLeakDetector;
describe("testing server with restricted securityModes - Given a server with a single end point SIGNANDENCRYPT/Basic128Rsa15", function () {

    var server, client, temperatureVariableId, endpointUrl, serverCertificate;

    var port = 2001;
    before(function (done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
        port += 1;

        var options = {
            port: port,
            securityPolicies: [SecurityPolicy.Basic128Rsa15],
            securityModes: [MessageSecurityMode.SIGNANDENCRYPT]
        };

        server = build_server_with_temperature_device(options, function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
            done(err);
        });
    });

    beforeEach(function (done) {
        client = null;
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });
    it("should not connect with SecurityMode==NONE", function (done) {

        client = new OPCUAClient();
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should not connect with SecurityMode==SIGN", function (done) {

        client = new OPCUAClient({
            securityMode: MessageSecurityMode.SIGN,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should not connect with  SecurityMode SIGNANDENCRYPT / Basic256 ", function (done) {
        client = new OPCUAClient({
            securityMode: MessageSecurityMode.SIGN,
            securityPolicy: SecurityPolicy.Basic256,
            serverCertificate: serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should connect with  SecurityMode SIGNANDENCRYPT / Basic128Rsa15 ", function (done) {

        client = new OPCUAClient({
            securityMode: MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(!!err).be.eql(false);
            client.disconnect(done);
        });
    });
});
