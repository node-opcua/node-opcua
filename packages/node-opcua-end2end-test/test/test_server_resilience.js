"use strict";
var should = require("should");
var async = require("async");
var _ = require("underscore");


var OPCUAServer = require("node-opcua-server").OPCUAServer;
var OPCUAClient = require("node-opcua-client").OPCUAClient;

var opcua = require("node-opcua");
var ObjectIds = opcua.ObjectIds;

var debugLog = require("node-opcua-debug").make_debugLog(__filename);

var empty_nodeset_filename = opcua.empty_nodeset_filename;

// a fake request type that is supposed to be correctly decoded on server side
// but that is not supported by the server engine

var ServerSideUnimplementedRequest_Schema = {
    name: "ServerSideUnimplementedRequest",
    id: ObjectIds.Annotation_Encoding_DefaultXml,
    fields: [
        {name: "requestHeader", fieldType: "RequestHeader"}
    ]
};

var generator = require("node-opcua-generator");
var path = require("path");
var temporary_folder = path.join(__dirname, "..", "_test_generated");

exports.ServerSideUnimplementedRequest_Schema = ServerSideUnimplementedRequest_Schema;
var ServerSideUnimplementedRequest = generator.registerObject(ServerSideUnimplementedRequest_Schema, temporary_folder);

var describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing Server resilience to unsupported request", function () {
    var server, client;
    var endpointUrl, g_session;


    this.timeout(Math.max(20000, this._timeout));

    before(function (done) {

        server = new OPCUAServer({port: 2000, nodeset_filename: empty_nodeset_filename});
        // we will connect to first server end point
        endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        debugLog("endpointUrl", endpointUrl);
        opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);

        client = new OPCUAClient();

        server.start(function () {
            setImmediate(function () {
                client.connect(endpointUrl, function (err) {
                    should(err).eql(null);
                    client.createSession(function (err, session) {
                        should(err).eql(null);
                        g_session = session;
                        done();
                    });
                });
            });
        });
    });

    after(function (done) {
        client.disconnect(function () {
            server.shutdown(function () {
                done();
            });
        });

    });

    it("server should return a ServiceFault if receiving a unsupported MessageType", function (done) {

        var bad_request = new ServerSideUnimplementedRequest(); // intentionally send a bad request

        g_session.performMessageTransaction(bad_request, function (err, response) {
            err.should.be.instanceOf(Error);
            done();
        });
    });
});


function abrupty_disconnect_client(client, callback) {
    client._secureChannel._transport.disconnect(callback);

}

describe("testing Server resilience with bad internet connection", function () {
    var server, client;
    var endpointUrl;

    this.timeout(Math.max(20000, this._timeout));

    before(function (done) {

        server = new OPCUAServer({port: 2000, nodeset_filename: empty_nodeset_filename});

        endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
        server.start(done);
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("server should discard session from abruptly disconnected client after the timeout has expired", function (done) {

        // ask for a very short session timeout
        client = new OPCUAClient({requestedSessionTimeout: 200});

        var the_session;

        async.series([
            // assert that server has 0 session
            function (callback) {
                server.currentSessionCount.should.eql(0);
                callback();
            },

            // connect
            function (callback) {

                client.connect(endpointUrl, function (err) {
                    callback(err);
                });
            },

            // create session
            function (callback) {
                client.createSession(function (err, session) {
                    if (!err) {
                        the_session = session;
                        the_session.timeout.should.eql(client.requestedSessionTimeout);
                    }
                    callback(err);
                });
            },

            // assert that server has 1 sessions
            function (callback) {
                server.currentSessionCount.should.eql(1);
                callback();
            },

            function (callback) {
                abrupty_disconnect_client(client, callback);
            },

            // assert that server has 1 sessions
            function (callback) {
                server.currentSessionCount.should.eql(1);
                callback();
            },

            // wait for time out
            function (callback) {
                setTimeout(callback, 4000);
            },

            // assert that server has no more session
            function (callback) {
                server.currentSessionCount.should.eql(0);
                callback();
            },
            function (callback) {
                client.disconnect(callback);
            }

        ], done);
        // client.disconnect(function(){
    });

});
