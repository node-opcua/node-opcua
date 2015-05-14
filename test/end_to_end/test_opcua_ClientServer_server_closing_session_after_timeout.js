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

var empty_nodeset_filename = require("path").join(__dirname, "../fixtures/fixture_empty_nodeset2.xml");

describe("testing server dropping session after timeout if no activity has been recorded", function () {


    this.timeout(20000);

    var server = new OPCUAServer({
        port: port,
        nodeset_filename: empty_nodeset_filename
    });
    var serverCertificate = server.getCertificate();

    var options = {
        //xx securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
        //xx securityPolicy: opcua.SecurityPolicy.Basic256,
        serverCertificate: serverCertificate,
        defaultSecureTokenLifetime: 2000
    };

    var nodeId = opcua.resolveNodeId("ns=0;i=2258");

    var readRequest = new opcua.read_service.ReadRequest({
        maxAge: 0,
        timestampsToReturn: opcua.read_service.TimestampsToReturn.Both,
        nodesToRead: [
            {
                nodeId: nodeId,
                attributeId: opcua.read_service.AttributeIds.Value,
            }
        ]
    });

    var endpointUrl;
    before(function (done) {
        server.start(function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            OPCUAServer.getRunningServerCount().should.eql(1);
            done(err);
        });

    });

    after(function (done) {

        async.series([
            function (callback) {
                server.shutdown(callback);
            },
            function(callback) {
                OPCUAServer.getRunningServerCount().should.eql(0);
                callback();
            }
        ], done);
    });

    it("should not be able to read a node if no session has been opened ", function (done) {

        var client = new OPCUAClient(options);

        async.series([
            // given that client1 is connected, and have a session
            function (callback) {
                client.connect(endpointUrl, callback);
            },

            // reading should fail with BadSessionIdInvalid
            function (callback) {

                client._secureChannel.performMessageTransaction(readRequest, function (err, response) {
                    response.responseHeader.serviceResult.should.equal(opcua.StatusCodes.BadSessionIdInvalid);
                    callback(err);
                });
            },
            function (callback) {
                client.disconnect(callback);
            },

        ], done);
    });

    it("should denied service call with BadSessionClosed on a timed out session", function (done) {
        var client = new OPCUAClient(options);

        var l_session = null;
        async.series([
            // given that client1 is connected, and have a session
            function (callback) {
                client.requestedSessionTimeout = 100;
                client.connect(endpointUrl, callback);
            },
            function (callback) {

                server.currentSessionCount.should.eql(0);
                client.createSession(function (err, session) {
                    if (err) {
                        return callback(err);
                    }
                    l_session = session;
                    session.timeout.should.equal(100);
                    server.currentSessionCount.should.eql(1);
                    callback(null);
                });


            },

            // now wait so that session times out on the server side
            function (callback) {
                setTimeout(callback, 1500);
            },

            // reading should fail with BadSessionIdInvalid
            function (callback) {

                server.currentSessionCount.should.eql(0);
                l_session.read(readRequest.nodesToRead,function(err,results){
                    err.message.should.match(/BadSessionIdInvalid/);
                    callback(null);
                });
            },
            function (callback) {

                callback();
                //xx client.disconnect(callback);
            },

        ], done);
    });

})