require("requirish")._(module);


var OPCUAServer = require("lib/server/opcua_server").OPCUAServer;
import OPCUAClient from "lib/client/OPCUAClient";

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var opcua = require("lib/nodeopcua");

var debugLog = require("lib/misc/utils").make_debugLog(__filename);
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;
import createObject from "lib/misc/create-factory";
import { ServerSideUnimplementedRequest_Schema } from './test_server_resilience_schema';
var _ = require("underscore");


var empty_nodeset_filename = require("path").join(__dirname, "../fixtures/fixture_empty_nodeset2.xml");


var factories = require("lib/misc/factories");


createObject(ServerSideUnimplementedRequest_Schema, "tmp", "_schema");
var ServerSideUnimplementedRequest = factories.registerObject(ServerSideUnimplementedRequest_Schema, "tmp");

describe("testing Server resilience to unsupported request", function () {
    var server, client;
    var endpointUrl, g_session;


    this.timeout(Math.max(20000,this._timeout));

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
        var s = require("lib/datamodel/structures");

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
    var endpointUrl, g_session;


    this.timeout(Math.max(20000,this._timeout));

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
                setTimeout(callback, 1000);
            },

            // assert that server has no more session
            function (callback) {

                server.currentSessionCount.should.eql(0);
                callback();
            }

        ], done);
        // client.disconnect(function(){
    });

});
