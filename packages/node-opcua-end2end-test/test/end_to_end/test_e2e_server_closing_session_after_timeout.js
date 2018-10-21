"use strict";
const should = require("should");
const async = require("async");

const opcua = require("node-opcua");
const OPCUAServer = opcua.OPCUAServer;
const OPCUAClient = opcua.OPCUAClient;
const empty_nodeset_filename = opcua.empty_nodeset_filename;

const port = 2000;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing server dropping session after timeout if no activity has been recorded", function () {


    this.timeout(Math.max(200000, this._timeout));

    let server;

    const nodeId = opcua.resolveNodeId("ns=0;i=2258");

    const readRequest = new opcua.ReadRequest({
        maxAge: 0,
        timestampsToReturn: opcua.TimestampsToReturn.Both,
        nodesToRead: [
            {
                nodeId: nodeId,
                attributeId: opcua.AttributeIds.Value
            }
        ]
    });

    let endpointUrl, serverCertificateChain;

    const options = {
        //xx securityMode: opcua.MessageSecurityMode.SIGNANDENCRYPT,
        //xx securityPolicy: opcua.SecurityPolicy.Basic256,
        serverCertificate: serverCertificateChain,
        defaultSecureTokenLifetime: 2000
    };

    before(function (done) {

        server = new OPCUAServer({
            port: port,
            nodeset_filename: empty_nodeset_filename
        });
        serverCertificateChain = server.getCertificateChain();

        server.start(function (err) {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            OPCUAServer.registry.count().should.eql(1);
            done(err);
        });

    });

    after(function (done) {

        async.series([
            function (callback) {
                server.shutdown(callback);
            },
            function (callback) {
                OPCUAServer.registry.count().should.eql(0);
                callback();
            }
        ], done);
    });

    it("should not be able to read a node if no session has been opened ", function (done) {

        const client = OPCUAClient.create(options);

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

        const client = OPCUAClient.create(options);

        let l_session = null;
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
                l_session.read(readRequest.nodesToRead, function (err, dataValues) {
                    should.exist(err, "read should end up with an error ");
                    should.exist(dataValues, "results should exists");
                    err.message.should.match(/BadSessionIdInvalid/);
                    callback(null);
                });
            },
            function (callback) {

                client.disconnect(callback);
            }

        ], done);
    });

});
