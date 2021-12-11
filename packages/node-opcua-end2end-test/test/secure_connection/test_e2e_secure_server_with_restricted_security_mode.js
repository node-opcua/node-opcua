"use strict";
const should = require("should");
const { OPCUAClient, SecurityPolicy, MessageSecurityMode } = require("node-opcua");
const sinon = require("sinon");

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");

const port = 2238;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing server with restricted securityModes - Given a server with a single end point SignAndEncrypt/Basic128Rsa15 (and no discovery service on secure channel)", function () {
    let server, client, endpointUrl, serverCertificate;

    before(async () => {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error

        const options = {
            port,
            securityPolicies: [SecurityPolicy.Basic128Rsa15],
            securityModes: [MessageSecurityMode.SignAndEncrypt],

            // in our case we also want to disable getEndpoint Service on unsecure connection:
            disableDiscovery: true
        };

        server = await build_server_with_temperature_device(options);
        endpointUrl = server.getEndpointUrl();
        serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
    });

    beforeEach(() => {
        client = null;
    });

    afterEach(() => {
        client = null;
    });

    after(async () => {
        await server.shutdown();
    });

    it("should not connect with SecurityMode==None", function (done) {
        client = OPCUAClient.create();
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });

    it("should not connect with SecurityMode==Sign", function (done) {
        client = OPCUAClient.create({
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should not connect with  SecurityMode SignAndEncrypt / Basic256 ", function (done) {
        client = OPCUAClient.create({
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic256,
            serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should not connect with  SecurityMode SignAndEncrypt / Basic256Sha256 ", function (done) {
        client = OPCUAClient.create({
            securityMode: MessageSecurityMode.Sign,
            securityPolicy: SecurityPolicy.Basic256Sha256,
            serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(err).not.be.eql(null);
            client.disconnect(done);
        });
    });
    it("should connect with  SecurityMode SignAndEncrypt / Basic128Rsa15 ", function (done) {
        client = OPCUAClient.create({
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate
        });
        client.connect(endpointUrl, function (err) {
            should(!!err).be.eql(false);
            client.disconnect(done);
        });
    });
});

describe("testing server with restricted securityModes -#933", function () {
    let server, client, endpointUrl, serverCertificate;

    before(async () => {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error

        const options = {
            port,
            securityPolicies: [SecurityPolicy.Basic128Rsa15],
            securityModes: [MessageSecurityMode.SignAndEncrypt],

            // in our case we also want to **enable** getEndpoint Service on unsecure connection:
            disableDiscovery: false
        };

        server = await build_server_with_temperature_device(options);
        endpointUrl = server.getEndpointUrl();
        serverCertificate = server.endpoints[0].endpointDescriptions()[0].serverCertificate;
    });

    beforeEach(() => {
        client = null;
    });

    afterEach(() => {
        client = null;
    });

    after(async () => {
        await server.shutdown();
    });

    it("should not get restricted endpoint (from the discovery endpoint) inside  createSession #933", async () => {
        client = OPCUAClient.create({
            securityMode: MessageSecurityMode.SignAndEncrypt,
            securityPolicy: SecurityPolicy.Basic128Rsa15,
            serverCertificate
        });

        const spyResponse = sinon.spy();
        client.on("receive_response", spyResponse);
        await client.connect(endpointUrl);

        const session = await client.createSession();
        await session.close();
        await client.disconnect();

        console.log(spyResponse.callCount);
        const getEndpointsResponse = spyResponse.getCall(0).args[0];
        const createSessionResponse = spyResponse.getCall(1).args[0];
        const activateSessionResponse = spyResponse.getCall(2).args[0];

        getEndpointsResponse.constructor.name.should.eql("GetEndpointsResponse");
        createSessionResponse.constructor.name.should.eql("CreateSessionResponse");
        activateSessionResponse.constructor.name.should.eql("ActivateSessionResponse");

        if (false) {
            console.log(getEndpointsResponse.toString());
            console.log(createSessionResponse.toString());
            console.log("serverEndpoints = ", createSessionResponse.serverEndpoints.length);
            console.log("getEndpointsResponse = ", getEndpointsResponse.endpoints.length);
        }
        createSessionResponse.serverEndpoints.length.should.eql(1);
        getEndpointsResponse.endpoints.length.should.eql(1);
    });
});
