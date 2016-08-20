require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");
var sinon = require("sinon");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;

var browse_service = opcua.browse_service;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;
var empty_nodeset_filename = require("path").join(__dirname, "../fixtures/fixture_empty_nodeset2.xml");

describe("testing Client-Server -Event", function () {

    before(function() {
        resourceLeakDetector.start();
    });
    after(function() {
        resourceLeakDetector.stop();
    });


    this.timeout(Math.max(600000,this._timeout));

    var port = 2222;
    var server;
    var endpointUrl;

    function start_server(done) {
        server = new opcua.OPCUAServer({
            port: port,
            nodeset_filename: empty_nodeset_filename,
            maxAllowedSessionNumber: 10
        });

        server.start(function () {
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            done();
        });
    }

    function end_server(done) {
        if (server) {
            server.shutdown(function () {
                server = null;
                done();
            });
        } else {
            done();
        }
    }



    it("should raise a close event once on normal disconnection", function (done) {

        var close_counter = 0;

        var client = new OPCUAClient();
        client.on("close", function (err) {

            //xx console.log(" client.on('close') Stack ", (new Error()).stack);
            //xx console.log(" Error ", err);

            should(err).eql(null, "No error shall be transmitted when client initiates the disconnection");
            close_counter++;
        });

        async.series([

            function (callback) {
                debugLog(" --> Starting server");
                start_server(callback);
            },
            function (callback) {
                debugLog(" --> Connecting Client");
                client.connect(endpointUrl, callback);
            },
            function (callback) {
                close_counter.should.eql(0);
                debugLog(" --> Disconnecting Client");
                client.disconnect(callback);
            },
            function (callback) {
                close_counter.should.eql(1);
                callback(null);
            },
            function (callback) {
                debugLog(" --> Stopping server");
                end_server(callback);
            }
        ], done);


    });

    it("Client (not reconnecting) should raise a close event with an error when server initiates disconnection", function (done) {

        // note : client is not trying to reconnect
        var options ={
            connectionStrategy: {
                maxRetry:    0,  // <= no retry
                initialDelay:10,
                maxDelay:    20,
                randomisationFactor: 0
            }
        };
        var client = new OPCUAClient(options);


        var _client_received_close_event = sinon.spy();
        client.on("close", _client_received_close_event);

        async.series([
            function (callback) {
                debugLog(" --> Starting server");
                start_server(callback);
            },
            function (callback) {
                debugLog(" --> Connecting Client");
                client.connect(endpointUrl, callback);
            },
            function (callback) {

                _client_received_close_event.callCount.should.eql(0);

                debugLog(" --> Stopping server");
                end_server(function() {
                    callback();
                });
            },

            // wait a little bit , to relax client
            function (callback) { setTimeout(callback,100); },

            function (callback) {
                _client_received_close_event.callCount.should.eql(1);
                _client_received_close_event.getCall(0).args[0].message.should.match(/disconnected by third party/);
                callback();
            }

        ], done);
    });
    it("Client (reconnecting)  should raise a close event with an error when server initiates disconnection (after reconnecting has failed)", function (done) {

        // note : client will  try to reconnect and eventually fail ..s
        var options ={
            connectionStrategy: {
                maxRetry:    1,  // <= RETRY
                initialDelay:10,
                maxDelay:    20,
                randomisationFactor: 0
            }
        };
        var client = new OPCUAClient(options);


        var _client_received_close_event = sinon.spy();
        client.on("close", _client_received_close_event);

        async.series([
            function (callback) {
                debugLog(" --> Starting server");
                start_server(callback);
            },
            function (callback) {
                debugLog(" --> Connecting Client");
                client.connect(endpointUrl, callback);
            },
            function (callback) {

                _client_received_close_event.callCount.should.eql(0);

                client.on("close", function(err){
                    callback();
                });
                
                debugLog(" --> Stopping server");
                end_server(function() { });
            },


            function (callback) {
                _client_received_close_event.callCount.should.eql(1);
                _client_received_close_event.getCall(0).args[0].message.should.match(/CONNREFUSED/);
                callback();
            }

        ], done);
    });

});
