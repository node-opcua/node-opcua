"use strict";

var should = require("should");
var assert = require("node-opcua-assert");
var async = require("async");
var _ = require("underscore");

var opcua = require("node-opcua");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;

var port = 2000;

var empty_nodeset_filename = opcua.empty_nodeset_filename;

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing the server ability to deny client session request (server with maxAllowedSessionNumber = 1)", function () {


    this.timeout(Math.max(300000, this._timeout));

    var server, client1, client2;

    var endpointUrl;
    before(function (done) {
        opcua.OPCUAClientBase.registry.count().should.eql(0);
        server = new OPCUAServer({
            port: port,
            nodeset_filename: empty_nodeset_filename,
            maxAllowedSessionNumber: 1
        });

        client1 = new OPCUAClient();
        client2 = new OPCUAClient();

        server.start(function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            done();
        });

    });

    // Given a server with only one allowed Session

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
            },
            function (callback) {
                client2.disconnect(callback);
            }
        ], done);

    });


});
