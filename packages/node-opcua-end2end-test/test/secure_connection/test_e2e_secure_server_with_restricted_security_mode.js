
"use strict";
const should = require("should");
const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;
const SecurityPolicy = opcua.SecurityPolicy;
const MessageSecurityMode = opcua.MessageSecurityMode;

const build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;


const crypto_utils = require("node-opcua-crypto");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing server with restricted securityModes - Given a server with a single end point SIGNANDENCRYPT/Basic128Rsa15 (and no discovery service on secure channel)", function () {

    let server, client, temperatureVariableId, endpointUrl, serverCertificate;

    const port = 2238;
    before(function (done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error

        const options = {
            port,
            securityPolicies: [SecurityPolicy.Basic128Rsa15],
            securityModes: [MessageSecurityMode.SignAndEncrypt],

            // in our case we also want to disable getEndpoint Service on unsecure connection:
            disableDiscovery: true
        };

        server = build_server_with_temperature_device(options, function (err) {
            endpointUrl = server.getEndpointUrl();
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
    it("should not connect with SecurityMode==None", function (done) {

        client = OPCUAClient.create();
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should not connect with SecurityMode==SIGN", function (done) {

        client = OPCUAClient.create({
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should not connect with  SecurityMode SIGNANDENCRYPT / Basic256 ", function (done) {
        client = OPCUAClient.create({
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic256,
            serverCertificate: serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should not connect with  SecurityMode SIGNANDENCRYPT / Basic256Sha256 ", function (done) {
        client = OPCUAClient.create({
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            serverCertificate: serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should connect with  SecurityMode SIGNANDENCRYPT / Basic128Rsa15 ", function (done) {

        client = OPCUAClient.create({
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate: serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(!!err).be.eql(false);
            client.disconnect(done);
        });
    });
});
