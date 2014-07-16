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

    it("should raise a close event once ",function(done) {

        var sinon = require("sinon");

        var close_counter = 0;
        client.on("close",function() {
            close_counter++;
        });


        async.series([
            function(callback) {
                client.connect(endpointUrl,callback);
            },
            function(callback) {
                close_counter.should.eql(0);
                client.disconnect(callback);
            },
            function(callback) {
                close_counter.should.eql(1);
                callback(null);
            }
        ],done);




    });

});
