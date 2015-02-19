require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");
var sinon = require("sinon");

var opcua = require("index");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var SignatureData = require("lib/datamodel/structures").SignatureData;

var port = 2000;

var empty_nodeset_filename = require("path").join(__dirname, "./fixtures/fixture_empty_nodeset2.xml");

var crypto_utils = require("lib/misc/crypto_utils");
if (!crypto_utils.isFullySupported()) {
    console.log(" SKIPPING TESTS ON SECURE CONNECTION because crypto, please check your installation".red.bold);
} else {
    describe("testing the server ability to deny client session request (server with maxAllowedSessionNumber = 1)", function () {


        var server = new OPCUAServer({
            port: port,
            nodeset_filename: empty_nodeset_filename
        });
        var serverCertificate = server.getCertificate();

        var options = {
            securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
            securityPolicy: opcua.SecurityPolicy.Basic256,
            serverCertificate: serverCertificate,
            defaultSecureTokenLifetime: 2000
        };


        var endpointUrl;
        before(function (done) {
            server.start(function () {
                endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
                done();
            });

        });

        after(function (done) {

            async.series([
                function (callback) {
                    server.shutdown(callback);
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
                        console.log(err);
                        try {
                            verif_after_create_session(err);
                        }
                        catch (err) {
                            console.log("verif_after_create_session :");
                            callback(err);
                        }
                        callback(null);

                    });
                },
                function (callback) {
                    client.disconnect(callback);
                },

            ], done);
        }

        it("Server shall accept a secure client connection with a valid clientSignature", function (done) {
            // this is the nominal case
            var client = new OPCUAClient(options);
            test_connection(client, function (err) {
                should(err).equal(null);
            }, done);

        });

        it("xxx Server shall reject a secure client connection if ActiveSession.clientSignature has the wrong algorithm", function (done) {

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


    });
}
