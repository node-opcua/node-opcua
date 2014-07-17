var OPCUAServer = require("../lib/server/opcua_server").OPCUAServer;
var OPCUAClient = require("../lib/client/opcua_client").OPCUAClient;
var should = require("should");
var assert = require('better-assert');
var async = require("async");
var util = require("util");
var opcua = require("../");

var debugLog = require("../lib/misc/utils").make_debugLog(__filename);
var StatusCodes = require("../lib/datamodel/opcua_status_code").StatusCodes;
var browse_service = require("../lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;

var _ = require("underscore");

var port = 2000;

var build_server_with_temperature_device = require("./helpers/build_server_with_temperature_device").build_server_with_temperature_device;


describe("testing basic Client-Server communication", function () {

    var server, client, temperatureVariableId, endpointUrl;

    before(function (done) {
        // we use a different port for each tests to make sure that there is
        // no left over in the tcp pipe that could generate an error
//xx        port+=1;
        server = build_server_with_temperature_device({ port: port}, function () {
            endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();
        });
    });

    beforeEach(function (done) {
        client = new OPCUAClient();
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("should raise a close event once on normal disconnection", function (done) {

        var close_counter = 0;
        client.on("close", function (err) {

            //xx console.log(" client.on('close') Stack ", (new Error()).stack);
            //xx console.log(" Error ", err);

            should(err).eql(null, "No error shall be transmitted when client initiates the disconnection");
            close_counter ++;
        });

        async.series([
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
            } ,
        ], done);


    });


});


describe("testing Client-Server : client behavior upon server disconnection", function () {

    var server, client, temperatureVariableId, endpointUrl;


    beforeEach(function (done) {

        client = new OPCUAClient();

        server = build_server_with_temperature_device({ port: port}, function () {

            endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done();

        });
    });

    afterEach(function (done) {
        client.disconnect(function(err){
            client = null;
            done(err);
        });
    });


    it("Client should raise a close event with an error when server initiates disconnection", function (done) {

        var close_counter = 0;

        var the_pending_callback = null;

        function on_close_func(err) {

            console.log(" xxx received close event from client".yellow,err);

            close_counter++;
            if (the_pending_callback) {
                close_counter.should.eql(1);
                var callback = the_pending_callback;
                the_pending_callback = null;

                should(err).be.instanceOf(Error);

                assert(_.isFunction(on_close_func));
                client.removeListener("close",on_close_func);

                setImmediate(callback);
            }

        }
        client.on("close", on_close_func);

        async.series([
            function (callback) {
                client.connect(endpointUrl, callback);
            },
            function (callback) {
                close_counter.should.eql(0);

                // client is connected but server initiate a immediate shutdown , closing all connections
                console.log("shutting down server");
                the_pending_callback = callback;
                server.shutdown( function() {
                    console.log("Server is now down");
                });

            },
            function (callback) {

                callback(null);
                close_counter.should.eql(1);
            },

        ], done);


    });

});
