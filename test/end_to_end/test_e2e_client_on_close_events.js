require("requirish")._(module);

var should = require("should");
var assert = require("better-assert");
var async = require("async");
var util = require("util");
var _ = require("underscore");

var opcua = require("index");

var OPCUAClient = opcua.OPCUAClient;
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var browse_service = opcua.browse_service;
var BrowseDirection = browse_service.BrowseDirection;

var debugLog = require("lib/misc/utils").make_debugLog(__filename);

var resourceLeakDetector = require("test/helpers/resource_leak_detector").resourceLeakDetector;
var empty_nodeset_filename = require("path").join(__dirname, "../fixtures/fixture_empty_nodeset2.xml");

describe("testing Client-Server -Event", function () {


    this.timeout(Math.max(600000,this._timeout));

    var port = 2222;
    var server;
    var endpointUrl;

    function start_server(done) {
        //xx resourceLeakDetector.start();
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
                //xx resourceLeakDetector.stop();
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
                start_server(callback);
            },
            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {
                close_counter.should.eql(0);
                client.disconnect(callback);
            },
            function (callback) {
                close_counter.should.eql(1);
                callback(null);
            },
            function (callback) {
                end_server(callback);
            }
        ], done);


    });

    it("Client should raise a close event with an error when server initiates disconnection", function (done) {

        var close_counter = 0;
        var client = new OPCUAClient();

        var the_pending_callback = null;

        function on_close_func(err) {

            close_counter++;
            if (the_pending_callback) {
                close_counter.should.eql(1);
                var callback = the_pending_callback;
                the_pending_callback = null;

                should(err).be.instanceOf(Error);

                assert(_.isFunction(on_close_func));
                client.removeListener("close", on_close_func);

                setImmediate(callback);
            }

        }

        client.on("close", on_close_func);

        async.series([
            function (callback) {
                start_server(callback);
            },
            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {

                close_counter.should.eql(0);

                // client is connected but server initiate a immediate shutdown , closing all connections
                // delegate the call of the callback function of this step to when client has closed
                the_pending_callback = callback;

                end_server(function() {

                });
            },
            function (callback) {
                close_counter.should.eql(1);
                callback();
            }

        ], done);
    });
});
