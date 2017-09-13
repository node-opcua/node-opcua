"use strict";

var should = require("should");
var async = require("async");
var _ = require("underscore");
var sinon = require("sinon");

var opcua = require("node-opcua");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var OPCUAClientBase = opcua.OPCUAClientBase;

var StatusCodes = opcua.StatusCodes;

var SignatureData = require("node-opcua-service-secure-channel").SignatureData;

var port = 2000;

var empty_nodeset_filename = opcua.empty_nodeset_filename;

var crypto_utils = require("node-opcua-crypto").crypto_utils;


if (!crypto_utils.isFullySupported()) {
    console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
    return;
}
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing the server ability to deny client session request (server with maxAllowedSessionNumber = 1)", function () {


    var server,endpointUrl,options;

    before(function (done) {

        server= new OPCUAServer({
            port: port,
            nodeset_filename: empty_nodeset_filename
        });
        var serverCertificate = server.getCertificateChain();

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
        var client = new OPCUAClient(options);
        test_connection(client, function (err) {
            should(err).equal(null);
        }, done);

    });

    it("Server shall reject a secure client connection if ActiveSession.clientSignature has the wrong algorithm", function (done) {

        var client = new OPCUAClient(options);
        var old_computeClientSignature = client.computeClientSignature;
        var computeClientSignatureStub = sinon.stub();

        client.computeClientSignature = function () {
            var res = old_computeClientSignature.apply(this, arguments);
            res.algorithm = "<bad algorithm>";
        };

        test_connection(client, function (err) {
            err.message.should.match(/BadApplicationSignatureInvalid/);
        }, done);


    });
    it("Server shall reject a secure client connection if ActiveSession.clientSignature is missing", function (done) {

        var client = new OPCUAClient(options);
        var old_computeClientSignature = client.computeClientSignature;
        var computeClientSignatureStub = sinon.stub();
        computeClientSignatureStub.returns(null);

        client.computeClientSignature = computeClientSignatureStub;

        test_connection(client, function (err) {
            computeClientSignatureStub.callCount.should.eql(1);
            err.message.should.match(/BadApplicationSignatureInvalid/);

        }, done);


    });
    it("Server shall reject a secure client connection if ActiveSession.clientSignature is tampered", function (done) {


        var client = new OPCUAClient(options);
        var old_computeClientSignature = client.computeClientSignature;
        var computeClientSignatureStub = sinon.stub();

        client.computeClientSignature = function () {
            var res = old_computeClientSignature.apply(this, arguments);
            res.should.be.instanceOf(SignatureData);
            // alter 10th word
            res.signature.writeInt16BE(res.signature.readInt16BE(10), 10);
        };

        test_connection(client, function (err) {
            err.message.should.match(/BadApplicationSignatureInvalid/);
        }, done);


    });

    it("Client shall deny server session if server nonce is too small", function (done) {

        var crypto = require("crypto");
        var bad_nonce = 0;
        server.makeServerNonce = function () {
            bad_nonce += 1;
            return crypto.randomBytes(31); //<< instead of 32  !!!
        };
        var options = {
            endpoint_must_exist: true
        };
        var client = new OPCUAClient(options);
        test_connection(client, function (err) {
            err.message.should.match(/Invalid server Nonce/);
            bad_nonce.should.be.greaterThan(0);
        }, done);

    });


    it("TA -#createSession Server  shall return an error if requestHeader.clientNonce has less than 32 bytes", function (done) {

        var client = new OPCUAClient(options);

        async.series([

            function (callback) {
                client.endpoint_must_exist = true;
                client.connect(endpointUrl, callback);
            },

            function (callback) {

                var createSessionRequest = new opcua.session_service.CreateSessionRequest({
                    requestHeader: {},
                    clientNonce: new Buffer(31)
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
        var options = {
            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: opcua.SecurityPolicy.Basic256,
            serverCertificate: null, // NOT KNOWN
            defaultSecureTokenLifetime: 2000
        };
        var client = new OPCUAClient(options);

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

