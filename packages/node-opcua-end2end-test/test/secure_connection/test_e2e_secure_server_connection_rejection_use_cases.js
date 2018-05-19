"use strict";

const should = require("should");
const async = require("async");
const _ = require("underscore");
const sinon = require("sinon");

const opcua = require("node-opcua");

const OPCUAServer = opcua.OPCUAServer;
const OPCUAClient = opcua.OPCUAClient;
const OPCUAClientBase = opcua.OPCUAClientBase;

const StatusCodes = opcua.StatusCodes;

const SignatureData = require("node-opcua-service-secure-channel").SignatureData;

const port = 2000;

const empty_nodeset_filename = opcua.empty_nodeset_filename;

const crypto_utils = require("node-opcua-crypto").crypto_utils;


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing the server ability to deny client session request (server with maxAllowedSessionNumber = 1)", function () {


    let server, endpointUrl, options;

    before(function (done) {

        server= new OPCUAServer({
            port: port,
            nodeset_filename: empty_nodeset_filename
        });
        const serverCertificate = server.getCertificateChain();

        options = {
            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: opcua.SecurityPolicy.Basic256,
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: 2000
        };

        server.start(function (err) {

            OPCUAServer.registry.count().should.eql(1);
            OPCUAClientBase.registry.count().should.eql(0);

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            done(err);
        });

    });

    after(function (done) {

        async.series([
            function (callback) {
                server.shutdown(function (err) {
                    OPCUAServer.registry.count().should.eql(0);
                    callback(err);
                });
            }
        ], done);
    });

    function test_connection(client, verif_after_create_session, done) {

        async.series([
            // given that client1 is connected, and have a session
            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {

                client.createSession(function (err) {

                    try {
                        verif_after_create_session(err);
                    }
                    catch (err) {
                        callback(err);
                    }
                    callback(null);

                });
            },
            function (callback) {
                client.disconnect(function (err) {
                    client = null;
                    callback(err);
                });
            }

        ], function (err) {
            if (client) {
                client.disconnect(done);
            } else {
                done(err);
            }
        });
    }

    it("Server shall accept a secure client connection with a valid clientSignature", function (done) {
        // this is the nominal case
        const client = new OPCUAClient(options);
        test_connection(client, function (err) {
            should(err).equal(null);
        }, done);

    });

    it("Server shall reject a secure client connection if ActiveSession.clientSignature has the wrong algorithm", function (done) {

        const client = new OPCUAClient(options);
        const old_computeClientSignature = client.computeClientSignature;
        const computeClientSignatureStub = sinon.stub();

        client.computeClientSignature = function () {
            const res = old_computeClientSignature.apply(this, arguments);
            res.algorithm = "<bad algorithm>";
        };

        test_connection(client, function (err) {
            err.message.should.match(/BadApplicationSignatureInvalid/);
        }, done);


    });
    it("Server shall reject a secure client connection if ActiveSession.clientSignature is missing", function (done) {

        const client = new OPCUAClient(options);
        const old_computeClientSignature = client.computeClientSignature;
        const computeClientSignatureStub = sinon.stub();
        computeClientSignatureStub.returns(null);

        client.computeClientSignature = computeClientSignatureStub;

        test_connection(client, function (err) {
            computeClientSignatureStub.callCount.should.eql(1);
            err.message.should.match(/BadApplicationSignatureInvalid/);

        }, done);


    });
    it("Server shall reject a secure client connection if ActiveSession.clientSignature is tampered", function (done) {


        const client = new OPCUAClient(options);
        const old_computeClientSignature = client.computeClientSignature;
        const computeClientSignatureStub = sinon.stub();

        client.computeClientSignature = function () {
            const res = old_computeClientSignature.apply(this, arguments);
            res.should.be.instanceOf(SignatureData);
            // alter 10th word
            res.signature.writeInt16BE(res.signature.readInt16BE(10), 10);
        };

        test_connection(client, function (err) {
            err.message.should.match(/BadApplicationSignatureInvalid/);
        }, done);


    });

    it("Client shall deny server session if server nonce is too small", function (done) {

        const crypto = require("crypto");
        let bad_nonce = 0;
        server.makeServerNonce = function () {
            bad_nonce += 1;
            return crypto.randomBytes(31); //<< instead of 32  !!!
        };
        const options = {
            endpoint_must_exist: true
        };
        const client = new OPCUAClient(options);
        test_connection(client, function (err) {
            err.message.should.match(/Invalid server Nonce/);
            bad_nonce.should.be.greaterThan(0);
        }, done);

    });


    it("TA -#createSession Server  shall return an error if requestHeader.clientNonce has less than 32 bytes", function (done) {

        const client = new OPCUAClient(options);

        async.series([

            function (callback) {
                client.endpoint_must_exist = true;
                client.connect(endpointUrl, callback);
            },

            function (callback) {

                const createSessionRequest = new opcua.session_service.CreateSessionRequest({
                    requestHeader: {},
                    clientNonce: Buffer.alloc(31)
                });
                client.performMessageTransaction(createSessionRequest, function (err, response) {
                    response.responseHeader.serviceResult.should.eql(StatusCodes.BadNonceInvalid);
                    callback(err);
                });
            },

            function (callback) {
                client.disconnect(callback);
            }

        ], done);
    });

    it("TB - a client shall be able to connect to a server using a SecureChannel without specifying the serverCertificate", function (done) {

        // in this case, server certificate will be extracted from the getPoint Information
        const options = {
            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: opcua.SecurityPolicy.Basic256,
            serverCertificate: null, // NOT KNOWN
            defaultSecureTokenLifetime: 2000
        };
        const client = new OPCUAClient(options);

        async.series([

            function (callback) {
                should(client.serverCertificate).eql(null);
                client.endpoint_must_exist = true;
                client.connect(endpointUrl, callback);
            },


            function (callback) {
                should.exist(client.serverCertificate);
                console.log(" Client has detected that server certificate is ", client.serverCertificate.toString("base64"));
                client.disconnect(callback);
            }

        ], done);


    });

});

