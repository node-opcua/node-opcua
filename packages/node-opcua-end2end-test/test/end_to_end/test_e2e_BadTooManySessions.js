

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var _ = require("underscore");

var opcua = require("node-opcua");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;

var port = 2000;

var empty_nodeset_filename =opcua.empty_nodeset_filename;

var resourceLeakDetector = require("node-opcua-test-helpers/src/resource_leak_detector").resourceLeakDetector;

describe("testing the server ability to deny client session request (server with maxAllowedSessionNumber = 1)", function () {


    this.timeout(Math.max(300000,this._timeout));

    // Given a server with only one allowed Session

    var server = new OPCUAServer({
        port: port,
        nodeset_filename: empty_nodeset_filename,
        maxAllowedSessionNumber: 1
    });

    var client1 = new OPCUAClient();
    var client2 = new OPCUAClient();

    var endpointUrl;
    before(function (done) {

        resourceLeakDetector.start();

        server.start(function () {

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            done();
        });

    });

    after(function (done) {

        async.series([
            function (callback) {
                client2.disconnect(callback);
            },
            function (callback) {
                client1.disconnect(callback);
            },
            function (callback) {
                server.shutdown(callback);
            },
            function (callback) {
                OPCUAServer.registry.count().should.eql(0);
                callback();
                resourceLeakDetector.stop();
            }

        ], done);
    });

    it("should accept only one session at a time", function (done) {

        server.currentChannelCount.should.eql(0);

        async.series([
            // given that client1 is connected, and have a session
            function (callback) {
                client1.connect(endpointUrl, callback);
            },
            function (callback) {
                client1.createSession(callback);
            },


            function (callback) {
                client2.connect(endpointUrl, callback);
            },
            //  when client2 try to create a session
            function (callback) {
                client2.createSession(function (err) {
                    // it should failed
                    should(err).be.instanceOf(Error);
                    console.log(err.message);
                    err.message.should.match(/BadTooManySessions/);
                    callback(null);
                });
            },


            // now if client1 disconnect ...
            function (callback) {
                client1.disconnect(callback);
            },
            // it should be possible to connect client 2
            function (callback) {
                client2.createSession(callback);
            }
        ], done);

    });


});
